// An in-memory server with the same push / pull behaviour as the SQL
// (supabase/migrations/…_sync.sql): role checks (rules.checkChange mirrors
// the row-level security + approval trigger), conflict rules
// (conflict.pickWinner), the per-batch chain of a device's own versions,
// and an append-only change log. The SQL itself is tested by
// supabase/tests/database (npm run test:db).

import { can } from '../../utils/permissions.js';
import { pickWinner } from '../conflict.js';
import { checkChange } from '../rules.js';

const clone = (v) => (v === undefined ? undefined : structuredClone(v));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * roles: { [userId]: { org: role, projects: { [projectId]: role } } }
 * Returns { transportFor(userId), items, changes, setRole, offline(bool) }.
 */
export const createFakeServer = (roles) => {
  const items = new Map();
  const changes = [];
  const blobs = new Map();
  let seq = 0;
  let down = false;

  const keyOf = (org, project, collection, item) => `${org}|${project || ''}|${collection}|${item}`;
  const roleIn = (user, org, project) => (project ? roles[user]?.projects?.[project] : roles[user]?.org) || null;
  const offlineError = () => Object.assign(new Error('Failed to fetch'), { offline: true });
  const rowJson = (row) => (row ? clone(row) : null);

  const push = (user, payloads) => {
    if (down) throw offlineError();
    const chain = new Map();
    return payloads.map((p) => {
      const key = keyOf(p.org_id, p.project_id, p.collection, p.item_id);
      const deleted = Boolean(p.deleted);
      const data = deleted ? null : p.data;
      let base = p.base_rev || 0;
      const rev = p.rev ?? base + 1;
      const link = chain.get(key);
      if (link && link.claimed === base) base = link.actual;
      const cur = items.get(key) || null;
      const role = roleIn(user, p.org_id, p.project_id);
      const record = (outcome, note, before, after, row) =>
        changes.push({ id: changes.length + 1, key, collection: p.collection, item_id: p.item_id, op: p.op, outcome, note, before, after, rev: row?.rev ?? rev, actor: user, device_id: p.device_id, client_at: p.client_at, restored_from: p.restored_from ?? null });
      const deny = (reason) => {
        chain.delete(key);
        if (role) record('rejected', `denied:${reason}`, null, data);
        return { k: p.k, status: 'denied', code: 'P0001', message: `pm_${reason}`, item: rowJson(cur) };
      };
      if (!role) return deny('not_member');
      if (p.op === 'import' && !can(role, 'plan.signOff')) return deny('import_denied');
      const verdict = checkChange(
        { id: user, role },
        { collection: p.collection, key: p.item_id, before: cur && !cur.deleted ? cur.data : null, after: data ?? (deleted ? null : cur?.data), recordedBy: cur?.recorded_by ?? null, importing: p.op === 'import' }
      );
      const write = (row, note = '') => {
        seq += 1;
        const next = { ...row, txid: '1', seq, updated_by: user };
        items.set(key, next);
        record('applied', note, cur && !cur.deleted ? cur.data : null, next.deleted ? null : next.data, next);
        chain.set(key, { claimed: rev, actual: next.rev });
        return { k: p.k, status: 'applied', item: rowJson(next) };
      };
      if (!cur) {
        if (deleted) return { k: p.k, status: 'same', item: null };
        if (!verdict.ok) return deny(verdict.reason);
        return write({ collection: p.collection, item_id: p.item_id, org_id: p.org_id, project_id: p.project_id, data: clone(data), pos: p.pos ?? null, rev: 1, deleted: false, recorded_by: p.op === 'import' ? null : user });
      }
      if ((deleted && cur.deleted) || (!deleted && !cur.deleted && same(cur.data, data))) {
        chain.set(key, { claimed: rev, actual: cur.rev });
        return { k: p.k, status: 'same', item: rowJson(cur) };
      }
      if (!verdict.ok) return deny(verdict.reason);
      const ff = cur.rev === base;
      const won = ff ? { winner: 'incoming', reason: 'fast-forward' } : pickWinner(cur, { data, deleted, rev });
      if (won.winner === 'incoming') {
        return write({ ...cur, data: deleted ? cur.data : clone(data), deleted, pos: p.pos ?? cur.pos, rev: cur.rev + 1 }, ff ? '' : `conflict-won:${won.reason}`);
      }
      chain.delete(key);
      record('rejected', `conflict-lost:${won.reason}`, cur.deleted ? null : cur.data, data, { rev });
      return { k: p.k, status: 'rejected', item: rowJson(cur) };
    });
  };

  const pull = (user, scope, cursor, limit) => {
    if (down) throw offlineError();
    if (!roleIn(user, scope.orgId, scope.projectId)) return [];
    return [...items.values()]
      .filter((r) => r.org_id === scope.orgId && (r.project_id || null) === (scope.projectId || null) && r.seq > (Number(cursor?.seq) || 0))
      .sort((a, b) => a.seq - b.seq)
      .slice(0, limit)
      .map(clone);
  };

  return {
    items,
    changes,
    blobs,
    setRole: (user, project, role) => {
      roles[user] = roles[user] || { projects: {} };
      if (project) roles[user].projects[project] = role;
      else roles[user].org = role;
    },
    setOffline: (value) => {
      down = value;
    },
    item: (org, project, collection, item) => items.get(keyOf(org, project, collection, item)) || null,
    transportFor: (user) => ({
      push: async (payloads) => push(user, clone(payloads)),
      pull: async (scope, cursor, limit) => pull(user, scope, cursor, limit),
      upload: async (path, blob) => {
        if (down) throw offlineError();
        blobs.set(path, blob);
      },
      download: async (path) => {
        if (down) throw offlineError();
        if (!blobs.has(path)) throw new Error('not found');
        return blobs.get(path);
      },
    }),
  };
};

/** A localStorage-like object in memory. */
export const memoryStorage = (data = {}) => ({
  data,
  getItem: (k) => (k in data ? data[k] : null),
  setItem: (k, v) => {
    data[k] = String(v);
  },
  removeItem: (k) => {
    delete data[k];
  },
});
