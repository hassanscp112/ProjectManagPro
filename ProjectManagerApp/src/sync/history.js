// ─────────────────────────────────────────────────────────────
// history — who changed what, and bringing a version back.
//
// Reads the server's append-only `changes` log (every applied write, plus
// every version that lost a conflict or was refused — outcome 'rejected').
// A history row:
//   { id, collection, itemId, op: insert | update | delete | restore | import,
//     before, after, rev, outcome: 'applied' | 'rejected', note,
//     actor: { id, name }, deviceId, clientAt, serverAt, restoredFrom,
//     pending: false }
// Changes still waiting on this device come first with pending: true
// (offline, or not pushed yet).
//
// restoreVersion never rewrites history: it writes the old version as a new
// change of the person restoring it (op 'restore', naming the row it
// brought back), through the same queue as any other edit.
// ─────────────────────────────────────────────────────────────

import { currentProject } from '../utils/Projects.js';
import { storeFor } from '../utils/storeRegistry.js';
import { DOC_ITEM, itemKey } from './itemDiff.js';
import { FILES_ENTRY, FILES_COLLECTION } from './rules.js';
import { getEngine, connect, pendingChanges, requestSync, scopeFor, withSyncLock } from './runtime.js';
import { loadSession } from './session.js';
import { toSyncError } from './transport.js';

const entryOf = (collection) => (collection === FILES_COLLECTION ? FILES_ENTRY : storeFor(collection));

/**
 * The item keys a record id may have in a collection: '<path>/<id>' for
 * each list (a key that already has a path, or '$doc', is used as is).
 */
export const itemKeysFor = (collection, itemId) => {
  const id = String(itemId ?? '');
  const entry = entryOf(collection);
  if (!entry || id === DOC_ITEM) return [id];
  const lists = entry.lists || [];
  if (lists.some((l) => l.path && id.startsWith(`${l.path}/`))) return [id];
  if (lists.length === 0) return [DOC_ITEM];
  return lists.map((l) => itemKey(l.path, id));
};

const fromRow = (row) => ({
  id: row.id,
  collection: row.collection,
  itemId: row.item_id,
  op: row.op,
  before: row.before ?? null,
  after: row.after ?? null,
  rev: row.rev ?? null,
  outcome: row.outcome,
  note: row.note || '',
  actor: { id: row.actor || null, name: row.actor_name || '' },
  deviceId: row.device_id || '',
  clientAt: row.client_at || null,
  serverAt: row.server_at || null,
  restoredFrom: row.restored_from ?? null,
  pending: false,
});

const fromPending = (e) => ({
  id: `local-${e.seq}`,
  collection: e.collection,
  itemId: e.key,
  op: e.op,
  before: e.before ?? null,
  after: e.deleted ? null : e.data,
  rev: e.rev,
  outcome: e.failed ? 'failed' : 'pending',
  note: e.lastError || '',
  actor: { id: e.actorId, name: loadSession().user?.name || '' },
  deviceId: e.deviceId,
  clientAt: e.clientAt,
  serverAt: null,
  restoredFrom: e.restoredFrom ?? null,
  pending: true,
});

const scopeIds = (collection, project) => {
  const session = loadSession();
  const entry = entryOf(collection);
  const orgId = session.org?.id || null;
  if (entry?.scope === 'global') return { orgId, projectId: null, scopeKey: orgId ? `org:${orgId}` : null };
  const projectId = project?.serverId || null;
  return { orgId, projectId, scopeKey: projectId ? `project:${projectId}` : null };
};

/**
 * Every version of one record, newest first (this device's queued changes
 * on top). `project` defaults to the open project.
 * Returns { ok, rows } — ok false (with `code`, `offline`) when the server
 * could not be read; `rows` then still has the queued changes.
 */
export const getHistory = async (collection, itemId, { project = currentProject(), limit = 200 } = {}) => {
  const keys = itemKeysFor(collection, itemId);
  const { orgId, projectId, scopeKey } = scopeIds(collection, project);
  const local = (await pendingChanges()).filter((e) => e.scopeKey === scopeKey && e.collection === collection && keys.includes(e.key)).reverse().map(fromPending);
  if (!orgId || !scopeKey) return { ok: true, rows: local, offline: false, notShared: true };
  try {
    const connection = await connect();
    if (!connection) return { ok: true, rows: local, offline: true };
    const rows = await connection.transport.changes({ orgId, projectId, collection, itemIds: keys, limit });
    return { ok: true, rows: [...local, ...(rows || []).map(fromRow)] };
  } catch (error) {
    const e = toSyncError(error);
    return { ok: false, rows: local, offline: e.offline, code: e.offline ? 'unreachable' : 'unknown' };
  }
};

/**
 * The project's timeline, newest first. filters: { project, actor (user id),
 * collection, from / to (ISO), beforeId (next page), limit, shared (true =
 * the organization's shared lists instead of the project) }.
 * Returns { ok, rows, next } — `next` is the beforeId of the following page.
 */
export const getProjectTimeline = async ({ project = currentProject(), actor, collection, from, to, beforeId, limit = 100, shared = false } = {}) => {
  const session = loadSession();
  const orgId = session.org?.id || null;
  const projectId = shared ? null : project?.serverId || null;
  const scopeKey = shared ? (orgId ? `org:${orgId}` : null) : projectId ? `project:${projectId}` : null;
  const local = beforeId
    ? []
    : (await pendingChanges())
        .filter((e) => e.scopeKey === scopeKey && (!collection || e.collection === collection) && (!actor || e.actorId === actor))
        .reverse()
        .map(fromPending);
  if (!orgId || !scopeKey) return { ok: true, rows: local, next: null, notShared: true };
  try {
    const connection = await connect();
    if (!connection) return { ok: true, rows: local, next: null, offline: true };
    const rows = ((await connection.transport.changes({ orgId, projectId, collection, actor, from, to, beforeId, limit })) || []).map(fromRow);
    return { ok: true, rows: [...local, ...rows], next: rows.length >= limit ? rows[rows.length - 1].id : null };
  } catch (error) {
    const e = toSyncError(error);
    return { ok: false, rows: local, next: null, offline: e.offline, code: e.offline ? 'unreachable' : 'unknown' };
  }
};

/**
 * Bring back the version a history row recorded (its `after`; for a
 * deletion, the version it deleted). Applied on this device at once and
 * queued like any edit. Returns { ok } or { ok: false, code }:
 * 'unreachable' | 'notFound' | 'notShared' | 'files' | 'role' | 'ownRecord'
 * | 'notApprover' | 'unknown'.
 */
export const restoreVersion = async (changeId) => {
  let change;
  try {
    const connection = await connect();
    if (!connection) return { ok: false, code: 'unreachable' };
    change = await connection.transport.change(changeId);
  } catch (error) {
    return { ok: false, code: toSyncError(error).offline ? 'unreachable' : 'unknown' };
  }
  if (!change) return { ok: false, code: 'notFound' };
  if (change.collection === FILES_COLLECTION) return { ok: false, code: 'files' };
  const version = change.after ?? change.before;
  if (version === null || version === undefined) return { ok: false, code: 'notFound' };

  const result = await withSyncLock(async () => {
    const scope = await scopeFor(change.collection, change.project_id ? { serverId: change.project_id } : null);
    if (!scope) return { ok: false, reason: 'notShared' };
    return getEngine().applyLocalVersion(scope, change.collection, change.item_id, { data: version }, { op: 'restore', restoredFrom: change.id });
  });
  if (!result.ok) return { ok: false, code: result.reason || 'unknown' };
  requestSync({ delay: 0 });
  return { ok: true };
};
