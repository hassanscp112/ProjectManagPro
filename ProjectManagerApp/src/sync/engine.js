// ─────────────────────────────────────────────────────────────
// engine — offline-first sync of every registered store, item by item.
//
// The local stores stay the read model: screens read and write them exactly
// as before. The engine watches them and
//   diff   compares each store with its base (what the server had) and
//          queues every changed record in the outbox, stamped with the
//          actor, the device and the time — after checking the role may make
//          that change (a refused change is undone on the spot);
//   push   sends the outbox; the server applies each change or keeps the
//          winning version (conflict rules: src/sync/conflict.js) and says
//          which — a lost or refused version comes back and is written
//          into the local store;
//   pull   fetches what changed on the server since the scope's cursor and
//          writes it into the local stores (then announces the store, so
//          the screens refresh).
// A scope is the organization (shared stores: people, templates, rates) or
// one shared project. Everything here is injected (storage, local db,
// transport, events), so the engine runs the same in the browser and in
// node tests; src/sync/runtime.js wires the browser.
// ─────────────────────────────────────────────────────────────

import { keyFor } from '../utils/Projects.js';
import { SYNCED_STORES } from '../utils/storeRegistry.js';
import { ABSENT, DOC_ITEM, applyItems, diffItems, explodeStore, hashOf, materialize } from './itemDiff.js';
import { FILES_COLLECTION, PROJECTS_COLLECTION, checkChange, entryFor } from './rules.js';

// Stores whose screens show a remote change as soon as it is written (the
// project store re-reads orders, people and activity on every change, and
// their owners write by merging into what is stored), so writing an older
// version there is a real edit, not a screen writing back what it loaded
// earlier. Every other store gets the stale-write check (itemDiff `sup`).
export const LIVE_STORES = new Set(['pm-orders', 'pm-registries', 'pm-activity']);

/**
 * Stores the project store holds in memory: ProjectGate remounts it when
 * the engine rewrites them (until then the stale-write check covers them).
 */
export const PLAN_STORES = new Set(['project-manager-gantt-tasks', 'project-manager-project-meta']);

const PUSH_BATCH = 150;
const PUSH_MAX = 480;
const PULL_PAGE = 500;
const MAX_ATTEMPTS = 5;
// A store whose records all vanished at once is treated as a screen or a
// storage problem, not as a person deleting everything: below this many
// records it is believed.
const MASS_DELETE_MIN = 5;

/** The synced stores of a scope kind ('org' | 'project'). */
export const storesForScope = (kind) =>
  SYNCED_STORES.filter((s) => s.key !== PROJECTS_COLLECTION && (kind === 'org' ? s.scope === 'global' : s.scope === 'project'));

export const orgScopeKey = (orgId) => `org:${orgId}`;
export const projectScopeKey = (serverId) => `project:${serverId}`;
export const shadowIdOf = (scopeKey, collection) => `${scopeKey}|${collection}`;
const entryId = (e) => `${e.scopeKey}|${e.collection}|${e.key}`;

/** A base item from a server row ({ data, rev, pos, deleted, recorded_by }). */
export const fromServer = (row) => ({
  h: hashOf(row.data ?? null),
  rev: Number(row.rev) || 0,
  pos: row.pos ?? null,
  data: row.data ?? null,
  deleted: Boolean(row.deleted),
  by: row.recorded_by ?? null,
});

/** An outbox entry as push_changes expects it. */
export const toPushPayload = (e) => ({
  k: e.seq,
  org_id: e.orgId,
  project_id: e.projectId,
  collection: e.collection,
  item_id: e.key,
  op: e.op,
  data: e.deleted ? null : e.data,
  deleted: Boolean(e.deleted),
  pos: e.pos ?? null,
  base_rev: e.baseRev,
  rev: e.rev,
  device_id: e.deviceId,
  client_at: e.clientAt,
  restored_from: e.restoredFrom ?? null,
});

/**
 * The entries to push next: the oldest PUSH_BATCH, plus any later entry of
 * a record already in the batch (a record's versions travel together, so
 * the server can chain them), capped at PUSH_MAX.
 */
export const selectBatch = (entries) => {
  const first = entries.slice(0, PUSH_BATCH);
  const ids = new Set(first.map(entryId));
  const extra = entries.slice(PUSH_BATCH).filter((e) => ids.has(entryId(e)));
  return [...first, ...extra].slice(0, PUSH_MAX);
};

/**
 * Sort the push results. Returns
 *   done     seqs to remove from the outbox
 *   retry    entries to keep (attempts + 1; failed after MAX_ATTEMPTS)
 *   finals   Map entryId → { entry, result } — the last result per record
 *   counts   { applied, same, rejected, denied, error }
 */
export const sortResults = (batch, results) => {
  const byK = new Map((Array.isArray(results) ? results : []).map((r) => [String(r?.k), r]));
  const done = [];
  const retry = [];
  const finals = new Map();
  const counts = { applied: 0, same: 0, rejected: 0, denied: 0, error: 0 };
  batch.forEach((entry) => {
    const result = byK.get(String(entry.seq));
    const status = result?.status;
    if (status === 'applied' || status === 'same' || status === 'rejected' || status === 'denied') {
      counts[status] += 1;
      done.push(entry.seq);
      finals.set(entryId(entry), { entry, result });
      return;
    }
    counts.error += 1;
    const attempts = (entry.attempts || 0) + 1;
    retry.push({ ...entry, attempts, failed: attempts >= MAX_ATTEMPTS, lastError: result?.message || 'no result' });
  });
  return { done, retry, finals, counts };
};

/**
 * deps:
 *   db         localDb (kv / shadow / outbox)
 *   transport  { push(payloads) → results, pull(scope, cursor, limit) → rows }
 *   storage    localStorage-like
 *   notify     (baseKey) => announce a store change to the screens
 *   emit       (event) => sync events: { type: 'denied' | 'overruled' |
 *              'ignored' | 'applied', scopeKey, collection, count, … }
 *   now        () => ISO time
 *   deviceId   () => this device's id
 */
export const createEngine = ({ db, transport, storage, notify = () => {}, emit = () => {}, now = () => new Date().toISOString(), deviceId = () => '' }) => {
  const lastRaw = new Map();
  const staleShadows = new Set();

  const storageKeyFor = (scope, entry) => (scope.kind === 'org' ? entry.key : keyFor(scope.local, entry.key));

  const readValue = (scope, entry) => {
    const raw = storage.getItem(storageKeyFor(scope, entry));
    if (raw === null || raw === undefined) return { raw: null, value: null, ok: true };
    try {
      return { raw, value: JSON.parse(raw), ok: true };
    } catch {
      return { raw, value: null, ok: false };
    }
  };

  const writeValue = (scope, entry, value) => {
    const key = storageKeyFor(scope, entry);
    const raw = value === null || value === undefined ? null : JSON.stringify(value);
    if (storage.getItem(key) === raw) return false;
    if (raw === null) storage.removeItem(key);
    else storage.setItem(key, raw);
    lastRaw.set(shadowIdOf(scope.key, entry.key), raw);
    notify(entry.key);
    emit({ type: 'applied', scopeKey: scope.key, collection: entry.key, localProjectId: scope.local?.id || null });
    return true;
  };

  const loadShadow = async (scope, collection) => {
    const shadow = await db.shadowGet(shadowIdOf(scope.key, collection));
    return shadow && shadow.items ? shadow : null;
  };
  const saveShadow = (scope, collection, shadow) => db.shadowSet(shadowIdOf(scope.key, collection), shadow);

  const posFrom = (shadow) => (key) => shadow.items[key]?.pos;
  const baseVersion = (key, b) => (b && !b.deleted && !b.lo ? { key, data: b.data, deleted: false, pos: b.pos } : { key, deleted: true });
  const liveListCount = (items) => Object.entries(items).filter(([k, b]) => k !== DOC_ITEM && !b.deleted && !b.lo).length;

  const makeEntry = (scope, collection, change, extra = {}) => ({
    scopeKey: scope.key,
    orgId: scope.orgId,
    projectId: scope.projectId || null,
    collection,
    key: change.key,
    op: change.op,
    data: change.after ?? null,
    before: change.before ?? null,
    deleted: change.op === 'delete',
    pos: change.pos ?? null,
    baseRev: change.baseRev || 0,
    rev: (change.baseRev || 0) + 1,
    actorId: scope.actor?.id || null,
    deviceId: deviceId(),
    clientAt: now(),
    attempts: 0,
    ...extra,
  });

  const provisional = (b, change, rev) => ({
    h: change.op === 'delete' ? b?.h ?? null : change.hash,
    rev,
    pos: change.pos ?? b?.pos ?? null,
    data: change.op === 'delete' ? b?.data ?? null : change.after,
    deleted: change.op === 'delete',
    by: b?.by ?? null,
    pending: true,
  });

  /**
   * Queue this device's changes to one store. Returns { queued, reverted }.
   * `force` re-reads the store even when its text did not change.
   */
  const diffStore = async (scope, entry, { force = false } = {}) => {
    const id = shadowIdOf(scope.key, entry.key);
    const { raw, value, ok } = readValue(scope, entry);
    if (!force && lastRaw.has(id) && lastRaw.get(id) === raw) return { queued: 0, reverted: 0 };
    if (!ok) {
      lastRaw.set(id, raw); // unreadable JSON: leave it (and the server) alone
      return { queued: 0, reverted: 0 };
    }
    const existing = await loadShadow(scope, entry.key);
    const firstLink = !existing;
    const shadow = existing || { items: {} };

    // A store that vanished (cleared, or removed by a restore) is put back
    // from the base rather than deleting everything on the server.
    if (raw === null) {
      if (liveListCount(shadow.items) > 0 || (shadow.items[DOC_ITEM] && !shadow.items[DOC_ITEM].deleted)) {
        writeValue(scope, entry, materialize(entry, shadow.items));
        emit({ type: 'ignored', scopeKey: scope.key, collection: entry.key, reason: 'missing' });
      } else {
        lastRaw.set(id, raw);
      }
      if (firstLink) await saveShadow(scope, entry.key, shadow);
      return { queued: 0, reverted: 0 };
    }

    const current = explodeStore(entry, value);
    const { changes, stale, localOnly } = diffItems(shadow.items, current, { staleCheck: !LIVE_STORES.has(entry.key) });

    const listDeletes = changes.filter((c) => c.op === 'delete' && c.key !== DOC_ITEM).length;
    const currentListCount = [...current.keys()].filter((k) => k !== DOC_ITEM).length;
    if (currentListCount === 0 && listDeletes >= MASS_DELETE_MIN && listDeletes === liveListCount(shadow.items)) {
      writeValue(scope, entry, materialize(entry, shadow.items));
      emit({ type: 'ignored', scopeKey: scope.key, collection: entry.key, reason: 'emptied', count: listDeletes });
      return { queued: 0, reverted: listDeletes };
    }

    const importing = Boolean(scope.importing);
    const entries = [];
    const revert = [...stale];
    const denied = [];
    changes.forEach((change) => {
      const b = shadow.items[change.key];
      const verdict = checkChange(scope.actor, {
        collection: entry.key,
        key: change.key,
        before: change.before,
        after: change.after,
        recordedBy: b?.by ?? null,
        importing,
      });
      if (!verdict.ok) {
        if (firstLink && change.op === 'insert') {
          // data this device had before it was linked: stays here, unsynced
          shadow.items[change.key] = { lo: true, h: change.hash };
          return;
        }
        revert.push(change.key);
        denied.push({ key: change.key, reason: verdict.reason });
        return;
      }
      const op = importing && change.op === 'insert' ? 'import' : change.op;
      const queued = makeEntry(scope, entry.key, { ...change, op });
      entries.push(queued);
      shadow.items[change.key] = provisional(b, change, queued.rev);
    });
    localOnly.forEach((key) => {
      if (current.has(key)) shadow.items[key] = { lo: true, h: hashOf(current.get(key).data) };
      else delete shadow.items[key];
    });

    await db.outboxAdd(entries);
    await saveShadow(scope, entry.key, shadow);
    lastRaw.set(id, raw);
    if (revert.length > 0) {
      const next = applyItems(entry, value, revert.map((key) => baseVersion(key, shadow.items[key])), posFrom(shadow));
      writeValue(scope, entry, next);
    }
    if (denied.length > 0) emit({ type: 'denied', scopeKey: scope.key, collection: entry.key, count: denied.length, reasons: denied });
    if (stale.length > 0) emit({ type: 'ignored', scopeKey: scope.key, collection: entry.key, reason: 'stale', count: stale.length });
    return { queued: entries.length, reverted: revert.length };
  };

  /** Diff every store of a scope. Returns the number of changes queued. */
  const diffScope = async (scope, options = {}) => {
    let queued = 0;
    for (const entry of storesForScope(scope.kind)) {
      queued += (await diffStore(scope, entry, options)).queued;
    }
    return queued;
  };

  /** Queue changes the engine itself found (files): [{ key, op, before, after, pos, hash }]. */
  const queueChanges = async (scope, collection, changes) => {
    if (changes.length === 0) return 0;
    const existing = await loadShadow(scope, collection);
    const shadow = existing || { items: {} };
    const entries = changes.map((change) => {
      const b = shadow.items[change.key];
      const queued = makeEntry(scope, collection, { ...change, baseRev: b && !b.lo ? b.rev : 0 });
      shadow.items[change.key] = provisional(b, { ...change, hash: change.hash ?? hashOf(change.after ?? null) }, queued.rev);
      return queued;
    });
    await db.outboxAdd(entries);
    await saveShadow(scope, collection, shadow);
    return entries.length;
  };

  /**
   * Write server versions into a scope's local store and its base. Rows:
   * [{ item_id, data, deleted, pos, rev, recorded_by }]. Records with a
   * queued local change are left to the push (the server resolves them).
   * `supersede` marks replaced versions so a screen writing them back is
   * not mistaken for an edit.
   */
  const applyServerRows = async (scope, collection, rows, { pendingKeys = new Set(), supersede = true } = {}) => {
    const entry = entryFor(collection);
    const isStore = Boolean(entry) && collection !== FILES_COLLECTION && SYNCED_STORES.some((s) => s.key === collection);
    if (isStore) await diffStore(scope, entry); // queue local edits first
    const shadow = (await loadShadow(scope, collection)) || { items: {} };
    const updates = [];
    rows.forEach((row) => {
      const key = row.item_id;
      if (pendingKeys.has(key) || shadow.items[key]?.pending) return;
      const b = shadow.items[key];
      const next = fromServer(row);
      if (b && !b.lo && b.rev === next.rev && b.h === next.h && Boolean(b.deleted) === next.deleted) return;
      if (supersede && isStore && !LIVE_STORES.has(collection)) {
        next.sup = b && !b.deleted && !b.lo ? b.h : ABSENT;
        staleShadows.add(shadowIdOf(scope.key, collection));
      }
      shadow.items[key] = next;
      updates.push({ key, data: next.data, deleted: next.deleted, pos: next.pos });
    });
    await saveShadow(scope, collection, shadow);
    if (!isStore || updates.length === 0) return updates.length;
    const { value, ok } = readValue(scope, entry);
    if (!ok) return 0;
    const next = value === null ? materialize(entry, shadow.items) : applyItems(entry, value, updates, posFrom(shadow));
    writeValue(scope, entry, next);
    return updates.length;
  };

  const outboxKeys = async (scopeKey) => {
    const all = await db.outboxAll();
    return all.filter((e) => e.scopeKey === scopeKey);
  };

  /**
   * Fetch what changed in a scope since its cursor and apply it.
   * Returns the number of records written.
   */
  const pullScope = async (scope) => {
    const cursorKey = `cursor:${scope.key}`;
    let cursor = (await db.kvGet(cursorKey)) || { txid: '0', seq: 0 };
    const pending = await outboxKeys(scope.key);
    let applied = 0;
    for (;;) {
      const rows = await transport.pull(scope, cursor, PULL_PAGE);
      if (!Array.isArray(rows) || rows.length === 0) break;
      const byCollection = new Map();
      rows.forEach((row) => {
        if (!byCollection.has(row.collection)) byCollection.set(row.collection, []);
        byCollection.get(row.collection).push(row);
      });
      for (const [collection, list] of byCollection) {
        const pendingKeys = new Set(pending.filter((e) => e.collection === collection).map((e) => e.key));
        applied += await applyServerRows(scope, collection, list, { pendingKeys });
      }
      const last = rows[rows.length - 1];
      cursor = { txid: String(last.txid), seq: Number(last.seq) || 0 };
      await db.kvSet(cursorKey, cursor);
      if (rows.length < PULL_PAGE) break;
    }
    return applied;
  };

  /**
   * Send queued changes of `actorId` (another person's queued changes wait
   * for them to sign in again). `scopes` maps scope keys to scopes, so lost
   * or refused versions can be written back. Throws when the server cannot
   * be reached (nothing is lost: the outbox stays).
   */
  const push = async (actorId, scopes) => {
    const total = { applied: 0, same: 0, rejected: 0, denied: 0, error: 0 };
    for (let round = 0; round < 20; round += 1) {
      const all = await db.outboxAll();
      const ready = all.filter((e) => !e.failed && e.actorId === actorId && scopes.has(e.scopeKey));
      if (ready.length === 0) break;
      const batch = selectBatch(ready);
      const results = await transport.push(batch.map(toPushPayload));
      const { done, retry, finals, counts } = sortResults(batch, results);
      Object.keys(total).forEach((k) => {
        total[k] += counts[k];
      });
      await db.outboxDelete(done);
      await db.outboxPut(retry);
      await settle(finals, scopes, new Set(retry.map(entryId)));
      if (counts.error > 0 && done.length === 0) break; // nothing moved: try again next cycle
    }
    if (total.rejected > 0) emit({ type: 'overruled', count: total.rejected });
    if (total.denied > 0) emit({ type: 'denied', count: total.denied, fromServer: true });
    return total;
  };

  // The server's answers → bases, and lost / refused versions back into the
  // local stores (when the person has not changed that record again since).
  const settle = async (finals, scopes, retrying) => {
    const groups = new Map();
    finals.forEach((final, id) => {
      if (retrying.has(id)) return;
      const groupId = shadowIdOf(final.entry.scopeKey, final.entry.collection);
      if (!groups.has(groupId)) groups.set(groupId, []);
      groups.get(groupId).push(final);
    });
    for (const finalsOfStore of groups.values()) {
      const { scopeKey, collection } = finalsOfStore[0].entry;
      const scope = scopes.get(scopeKey);
      const shadow = (await loadShadow(scope, collection)) || { items: {} };
      const entry = entryFor(collection);
      const isStore = Boolean(entry) && collection !== FILES_COLLECTION && SYNCED_STORES.some((s) => s.key === collection);
      const local = isStore ? readValue(scope, entry) : { ok: false };
      const current = local.ok ? explodeStore(entry, local.value) : new Map();
      const updates = [];
      finalsOfStore.forEach(({ entry: e, result }) => {
        const item = result.item;
        if (result.status === 'applied' || result.status === 'same') {
          if (item) shadow.items[e.key] = fromServer(item);
          else delete shadow.items[e.key];
          return;
        }
        // rejected / denied: the server's version stands
        if (item) shadow.items[e.key] = fromServer(item);
        else delete shadow.items[e.key];
        if (!local.ok) return;
        const pushedHash = e.deleted ? null : hashOf(e.data);
        const localHash = current.has(e.key) ? hashOf(current.get(e.key).data) : null;
        if (localHash !== pushedHash) return; // edited again since: the next push goes on top
        updates.push(item ? { key: e.key, data: item.data, deleted: Boolean(item.deleted), pos: item.pos } : { key: e.key, deleted: true });
        if (shadow.items[e.key] && !LIVE_STORES.has(collection)) {
          shadow.items[e.key].sup = e.deleted ? ABSENT : pushedHash;
          staleShadows.add(shadowIdOf(scopeKey, collection));
        }
      });
      await saveShadow(scope, collection, shadow);
      if (updates.length > 0 && local.ok) writeValue(scope, entry, applyItems(entry, local.value, updates, posFrom(shadow)));
    }
  };

  /**
   * Put one version of a record into the local store as this person's own
   * change (restoring a version from the history). Returns { ok, reason? }.
   */
  const applyLocalVersion = async (scope, collection, key, { data, deleted = false }, { op = 'restore', restoredFrom = null } = {}) => {
    const entry = entryFor(collection);
    if (!entry || collection === FILES_COLLECTION) return { ok: false, reason: 'collection' };
    await diffStore(scope, entry, { force: true });
    const shadow = (await loadShadow(scope, collection)) || { items: {} };
    const b = shadow.items[key];
    const before = b && !b.deleted && !b.lo ? b.data : null;
    const verdict = checkChange(scope.actor, { collection, key, before, after: deleted ? null : data, recordedBy: b?.by ?? null });
    if (!verdict.ok) return verdict;
    const { value, ok } = readValue(scope, entry);
    if (!ok) return { ok: false, reason: 'unreadable' };
    const positions = Object.values(shadow.items).map((it) => it.pos).filter((p) => typeof p === 'number');
    const pos = b?.pos ?? (positions.length ? Math.max(...positions) + 1 : 0);
    const change = { key, op: deleted ? 'delete' : op, before, after: deleted ? null : data, pos, baseRev: b && !b.lo ? b.rev : 0, hash: deleted ? null : hashOf(data) };
    const queued = makeEntry(scope, collection, change, { op: deleted ? 'delete' : op, restoredFrom });
    shadow.items[key] = provisional(b, change, queued.rev);
    await db.outboxAdd([queued]);
    await saveShadow(scope, collection, shadow);
    writeValue(scope, entry, applyItems(entry, value, [{ key, data, deleted, pos }], posFrom(shadow)));
    return { ok: true };
  };

  /** After navigation every screen has re-read its store: replaced versions are no longer suspicious. */
  const clearStaleMarks = async () => {
    const ids = [...staleShadows];
    staleShadows.clear();
    for (const id of ids) {
      const shadow = await db.shadowGet(id);
      if (!shadow?.items) continue;
      let changed = false;
      Object.values(shadow.items).forEach((b) => {
        if (b.sup !== undefined) {
          delete b.sup;
          changed = true;
        }
      });
      if (changed) await db.shadowSet(id, shadow);
    }
  };

  /** Forget a scope (a project removed from this device or no longer shared). */
  const dropScope = async (scopeKey) => {
    const ids = (await db.shadowKeys()).filter((id) => id.startsWith(`${scopeKey}|`));
    await db.shadowDelete(ids);
    await db.kvDelete(`cursor:${scopeKey}`);
    const doomed = (await db.outboxAll()).filter((e) => e.scopeKey === scopeKey).map((e) => e.seq);
    await db.outboxDelete(doomed);
    ids.forEach((id) => lastRaw.delete(id));
  };

  return {
    diffStore,
    diffScope,
    queueChanges,
    applyServerRows,
    pullScope,
    push,
    applyLocalVersion,
    clearStaleMarks,
    dropScope,
    loadShadow,
    storageKeyFor,
  };
};
