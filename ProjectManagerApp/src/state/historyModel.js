// ─────────────────────────────────────────────────────────────
// historyModel — history and accountability rules as pure functions.
//
// Per item: a history row's before / after as a list of labelled field
// changes (nested values, lists of records matched by id, keyed items such
// as diary days 'days/2026-10-26'), the "recorded / approved / issued /
// last edited by" stamps of a record, and whether a row's version may be
// restored (src/sync/history.js restoreVersion — always a NEW change).
// Project timeline: the query a filter set sends to getProjectTimeline,
// the filters the server cannot apply (order family, variation orders,
// pending rows' dates), the people in it and a per-person summary.
// History rows: src/sync/history.js. Tested in __tests__/historyModel.test.js.
// ─────────────────────────────────────────────────────────────

import { checkChange, FILES_COLLECTION } from '../sync/rules.js';
import { DOC_ITEM, stableStringify } from '../sync/itemDiff.js';

const asArray = (v) => (Array.isArray(v) ? v : []);
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const same = (a, b) => stableStringify(a) === stableStringify(b);
const isBlank = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0) || (isObject(v) && Object.keys(v).length === 0);

/* ─────────────── items ─────────────── */

/** Dictionary key naming each synced collection (history.collection.*). */
export const COLLECTION_KEYS = {
  'pm-orders': 'history.collection.orders',
  'project-manager-gantt-tasks': 'history.collection.tasks',
  'project-manager-project-meta': 'history.collection.meta',
  'pm-registries': 'history.collection.people',
  'pm-certificates': 'history.collection.certificates',
  'pm-site-diary': 'history.collection.diary',
  'pm-delays': 'history.collection.delays',
  'pm-plans': 'history.collection.plans',
  'pm-activity': 'history.collection.activity',
  'pm-rate-library': 'history.collection.rates',
  'pm-templates': 'history.collection.templates',
  'pm-work-types': 'history.collection.workTypes',
  'project-manager-finance-data': 'history.collection.finance',
  'project-manager-finance-config': 'history.collection.finance',
  'pm-calculator-templates': 'history.collection.calculator',
  'project-manager-daily-reports': 'history.collection.notes',
  [FILES_COLLECTION]: 'history.collection.files',
};

/** '#/history/<collection>/<item>' — both parts encoded ('days/2026-10-26' keeps its slash inside the id). */
export const historyHref = (collection, itemId) => `#/history/${encodeURIComponent(collection)}/${encodeURIComponent(String(itemId ?? ''))}`;

/**
 * An item id as { list, key }: 'days/2026-10-26' → { list: 'days', key:
 * '2026-10-26' }, '$doc' → { list: '', key: '$doc', doc: true }, a bare
 * record id → { list: '', key }.
 */
export const splitItemId = (itemId) => {
  const id = String(itemId ?? '');
  if (id === DOC_ITEM) return { list: '', key: DOC_ITEM, doc: true };
  const slash = id.indexOf('/');
  return slash < 0 ? { list: '', key: id, doc: false } : { list: id.slice(0, slash), key: id.slice(slash + 1), doc: false };
};

/** A short name for a record version (name, title, WBS + name …), else the item's key. */
export const recordName = (version, itemId = '') => {
  const v = isObject(version) ? version : {};
  const wbsName = [v.wbs, v.name].filter(Boolean).join(' ');
  return String(wbsName || v.title || v.label || v.summary || v.taskName || splitItemId(itemId).key || '').trim();
};

/* ─────────────── field diff ─────────────── */

/** The record's id and the bookkeeping every save rewrites: the row already says which, who and when. */
export const HIDDEN_FIELDS = ['id', 'updatedAt', 'updatedBy', 'updatedById', 'recordedById', 'createdAt', 'recordedAt'];

const ID_FIELDS = ['id', 'taskId', 'key'];
const hasId = (r, f) => r[f] !== undefined && r[f] !== null && r[f] !== '';
const uniqueIds = (list, f) => new Set(list.map((r) => String(r[f]))).size === list.length;

/** The field both lists' records are identified by (unique in each), or null. */
const commonIdField = (before, after) => {
  const all = [...before, ...after];
  if (all.length === 0 || !all.every(isObject)) return null;
  return ID_FIELDS.find((f) => all.every((r) => hasId(r, f)) && uniqueIds(before, f) && uniqueIds(after, f)) || null;
};

const itemLabel = (record, id) => String(record?.name || record?.title || record?.label || record?.trade || record?.type || record?.wbs || id);

const pathText = (segments) =>
  segments.reduce((text, seg) => (seg.field !== undefined ? (text ? `${text}.${seg.field}` : seg.field) : `${text}[${seg.id}]`), '');

const entry = (segments, change, before, after, extra = {}) => ({ path: pathText(segments), segments, change, before, after, ...extra });

function diffValue(before, after, segments, out, hidden) {
  if (same(before, after) || (isBlank(before) && isBlank(after))) return;
  if (isObject(before) && isObject(after)) {
    diffObject(before, after, segments, out, hidden);
    return;
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    diffArray(before, after, segments, out, hidden);
    return;
  }
  if (isBlank(before)) out.push(entry(segments, 'added', before ?? null, after));
  else if (isBlank(after)) out.push(entry(segments, 'removed', before, after ?? null));
  else out.push(entry(segments, 'changed', before, after));
}

function diffObject(before, after, segments, out, hidden) {
  const keys = [...Object.keys(after), ...Object.keys(before).filter((k) => !(k in after))];
  keys.forEach((k) => {
    if (hidden.includes(k) || typeof after[k] === 'function') return;
    diffValue(before[k], after[k], [...segments, { field: k }], out, hidden);
  });
}

function diffArray(before, after, segments, out, hidden) {
  const field = commonIdField(before, after);
  if (!field) {
    // Plain values (or records without ids): the whole list, plus what came and went.
    const b = before.map(stableStringify);
    const a = after.map(stableStringify);
    out.push(
      entry(segments, 'changed', before, after, {
        list: { added: after.filter((_, i) => !b.includes(a[i])), removed: before.filter((_, i) => !a.includes(b[i])) },
      })
    );
    return;
  }
  const beforeById = new Map(before.map((r) => [String(r[field]), r]));
  const afterById = new Map(after.map((r) => [String(r[field]), r]));
  after.forEach((r) => {
    const id = String(r[field]);
    const seg = [...segments, { id, item: itemLabel(r, id) }];
    if (!beforeById.has(id)) out.push(entry(seg, 'added', null, r));
    else diffValue(beforeById.get(id), r, seg, out, hidden);
  });
  before.forEach((r) => {
    const id = String(r[field]);
    if (!afterById.has(id)) out.push(entry([...segments, { id, item: itemLabel(r, id) }], 'removed', r, null));
  });
}

/**
 * The fields a change touched, in order:
 *   [{ path: 'who.kind' | 'manpower[m1].count', segments: [{ field } | { id, item }],
 *      change: 'added' | 'removed' | 'changed', before, after, list? }]
 * Nested objects give one entry per leaf; lists of records are matched by
 * id (or taskId / key) — an added or removed record is one entry; lists of
 * plain values are one entry with `list: { added, removed }`. A first
 * version (before null) lists its non-empty fields as added, a deletion
 * its fields as removed. HIDDEN_FIELDS are left out unless
 * { hidden: [] } is passed.
 */
export const diffFields = (before, after, { hidden = HIDDEN_FIELDS } = {}) => {
  const out = [];
  const b = before ?? null;
  const a = after ?? null;
  if (isObject(b) || isObject(a)) {
    const from = isObject(b) ? b : {};
    const to = isObject(a) ? a : {};
    const keys = [...Object.keys(to), ...Object.keys(from).filter((k) => !(k in to))];
    keys.forEach((k) => {
      if (hidden.includes(k)) return;
      if (!isObject(b) && isBlank(to[k])) return; // a first version: only what was filled in
      if (!isObject(a) && isBlank(from[k])) return; // a deletion: only what was there
      diffValue(from[k], to[k], [{ field: k }], out, hidden);
    });
    return out;
  }
  if (Array.isArray(b) || Array.isArray(a)) {
    diffArray(asArray(b), asArray(a), [], out, hidden);
    return out;
  }
  if (!same(b, a)) out.push(entry([], isBlank(b) ? 'added' : isBlank(a) ? 'removed' : 'changed', b, a));
  return out;
};

/**
 * A value as short text: '' / null → empty, true / false → yes / no,
 * numbers through `num`, lists joined, records by their name.
 * words = { empty, yes, no, sep, num? (n), items? (count), date? (iso) —
 * for 'YYYY-MM-DD' and ISO date-time strings }.
 */
export const valueText = (value, words = {}) => {
  const { empty = '—', yes = 'yes', no = 'no', sep = ', ', num = (n) => String(n), items = (n) => `${n}`, date = (s) => s } = words;
  if (value === undefined || value === null || value === '') return empty;
  if (typeof value === 'boolean') return value ? yes : no;
  if (typeof value === 'number') return num(value);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/.test(value)) return date(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return empty;
    if (value.every((v) => !isObject(v) && !Array.isArray(v))) return value.map((v) => valueText(v, words)).join(sep);
    // Records by their names ("Steel fixer × 6"), when every one has a name.
    if (value.every((v) => isObject(v) && (recordName(v) || v.trade || v.type))) return value.map((v) => valueText(v, words)).join(sep);
    return items(value.length);
  }
  if (isObject(value)) {
    const name = recordName(value) || value.trade || value.type || '';
    if (name && typeof value.count === 'number') return `${name} × ${num(value.count)}`;
    return name || items(Object.keys(value).length);
  }
  return String(value);
};

/* ─────────────── stamps ─────────────── */

const nameOf = (v) => (isObject(v) ? v.name || '' : typeof v === 'string' ? v : '');

/**
 * "Recorded by / approved by / issued by / last edited by" for a record:
 *   [{ kind: 'recorded' | 'approved' | 'issued' | 'edited', name, at }]
 * from its own fields (recordedBy / createdBy, approvedBy, issuedBy,
 * updatedBy). `last` — the newest history row ({ op, actor: { name },
 * serverAt, clientAt }) — names the last editor when the server knows
 * better than the record (not when it is the record's first version). An
 * edit that is only the first save is left out.
 */
export const recordStamps = (record, { last = null } = {}) => {
  const r = isObject(record) ? record : {};
  const stamps = [];
  const recorded = nameOf(r.recordedBy) || nameOf(r.createdBy);
  const recordedAt = r.recordedAt || r.createdAt || '';
  if (recorded) stamps.push({ kind: 'recorded', name: recorded, at: recordedAt });
  if (nameOf(r.approvedBy)) stamps.push({ kind: 'approved', name: nameOf(r.approvedBy), at: r.approvedAt || '' });
  if (nameOf(r.issuedBy)) stamps.push({ kind: 'issued', name: nameOf(r.issuedBy), at: r.issuedAt || '' });
  let edited = nameOf(r.updatedBy) ? { name: nameOf(r.updatedBy), at: r.updatedAt || '' } : null;
  // The record's first version (insert / upload) is its recording, not an edit.
  if (last && last.actor?.name && last.op !== 'insert' && last.op !== 'import') {
    const at = last.serverAt || last.clientAt || '';
    if (!edited || !edited.at || (at && at > edited.at)) edited = { name: last.actor.name, at };
  }
  if (edited && !(edited.name === recorded && (!edited.at || edited.at === recordedAt))) stamps.push({ kind: 'edited', ...edited });
  return stamps;
};

/** The newest row that changed the record (pending first: this device's own edit), or null. */
export const lastChange = (rows = []) => asArray(rows).find((r) => r && (r.outcome === 'applied' || r.outcome === 'pending')) || null;

/* ─────────────── restore ─────────────── */

/**
 * What restoreVersion(row.id) writes: the row's version (its `after`; for a
 * deletion, the version it deleted). { ok: true, changeId, version } or
 * { ok: false, code: 'pending' (not on the server yet) | 'files' | 'notFound' }.
 */
export const restorePayload = (row) => {
  if (!row || row.id === undefined || row.id === null) return { ok: false, code: 'notFound' };
  if (row.pending) return { ok: false, code: 'pending' };
  if (row.collection === FILES_COLLECTION) return { ok: false, code: 'files' };
  const version = row.after ?? row.before;
  if (version === null || version === undefined) return { ok: false, code: 'notFound' };
  return { ok: true, changeId: row.id, version };
};

/**
 * May `actor` ({ id, role }) restore this row, and should the button show?
 *   { show: false, code: 'pending' | 'files' | 'notFound' | 'current' }
 *   { show: true, ok: false, code: 'role' | 'notApprover' | 'ownRecord' | … }
 *   { show: true, ok: true, payload }
 * `current` is the record as it is now (undefined = unknown: the newest
 * applied row's version stands in; null = deleted). The newest version and
 * a version equal to the current one have nothing to restore. The role
 * check is the sync rule for writing `version` over `current`
 * (src/sync/rules checkChange — the server applies the same one).
 */
export const restoreGate = ({ row, rows = [], current, actor }) => {
  const payload = restorePayload(row);
  if (!payload.ok) return { show: false, code: payload.code };
  const newest = asArray(rows).find((r) => r && !r.pending && r.outcome === 'applied') || null;
  const now = current !== undefined ? current : newest ? (newest.op === 'delete' ? null : newest.after) : null;
  if (newest && newest.id === row.id && row.op !== 'delete') return { show: false, code: 'current' };
  if (now !== null && now !== undefined && same(now, payload.version)) return { show: false, code: 'current' };
  const check = checkChange(actor, { collection: row.collection, key: row.itemId, before: now ?? null, after: payload.version });
  if (!check.ok) return { show: true, ok: false, code: check.reason };
  return { show: true, ok: true, payload };
};

/* ─────────────── project timeline ─────────────── */

/** Type filters of the timeline: the collection asked of the server, and what is filtered here. */
export const TIMELINE_TYPES = {
  all: {},
  value: { collection: 'pm-orders', family: 'value' },
  expense: { collection: 'pm-orders', family: 'expense' },
  variation: { collection: 'project-manager-project-meta', list: 'variations' },
  plan: { collection: 'project-manager-gantt-tasks' },
  diary: { collection: 'pm-site-diary' },
  delays: { collection: 'pm-delays' },
  certificates: { collection: 'pm-certificates' },
  photos: { collection: FILES_COLLECTION },
  events: { collection: 'pm-activity' },
  shared: { shared: true }, // the organization's lists: people, templates, rates
};

const pad = (n) => String(n).padStart(2, '0');

/** An ISO time → its local day 'YYYY-MM-DD' ('' if none). */
export const localDay = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** The start of a local day 'YYYY-MM-DD' as an ISO time. */
export const dayStartISO = (day) => new Date(`${day}T00:00:00`).toISOString();

const nextDay = (day) => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return localDay(d.toISOString());
};

/**
 * The getProjectTimeline arguments for a filter set { type, actor (user
 * id), from, to (local days, both included), beforeId, limit }.
 */
export const timelineQuery = ({ type = 'all', actor = '', from = '', to = '', beforeId = null, limit = 100 } = {}) => {
  const spec = TIMELINE_TYPES[type] || TIMELINE_TYPES.all;
  const query = { limit };
  if (spec.collection) query.collection = spec.collection;
  if (spec.shared) query.shared = true;
  if (actor) query.actor = actor;
  if (from) query.from = dayStartISO(from);
  if (to) query.to = dayStartISO(nextDay(to));
  if (beforeId !== null && beforeId !== undefined) query.beforeId = beforeId;
  return query;
};

const rowTime = (row) => row?.serverAt || row?.clientAt || '';
const versionOf = (row) => row?.after ?? row?.before ?? null;

/**
 * The rows matching the filters the server cannot apply: an order's family,
 * variation orders only, and (for the rows waiting on this device, which
 * come back unfiltered) person, type and dates.
 */
export const filterTimeline = (rows = [], { type = 'all', actor = '', from = '', to = '' } = {}) => {
  const spec = TIMELINE_TYPES[type] || TIMELINE_TYPES.all;
  return asArray(rows).filter((row) => {
    if (!row) return false;
    if (spec.collection && row.collection !== spec.collection) return false;
    if (spec.family && versionOf(row)?.family !== spec.family) return false;
    if (spec.list && splitItemId(row.itemId).list !== spec.list) return false;
    if (actor && row.actor?.id !== actor) return false;
    const day = localDay(rowTime(row));
    if (from && day && day < from) return false;
    if (to && day && day > to) return false;
    return true;
  });
};

/** Everyone in the rows (and the members list), by name: [{ id, name }]. */
export const timelineActors = (rows = [], members = []) => {
  const byId = new Map();
  asArray(members).forEach((m) => m?.userId && byId.set(m.userId, m.name || m.email || ''));
  asArray(rows).forEach((r) => {
    const id = r?.actor?.id;
    if (id && !byId.get(id)) byId.set(id, r.actor.name || '');
  });
  return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
};

/**
 * One person's rows at a glance: { total, days (distinct local days),
 * byCollection: { [collection]: n }, byOp: { [op]: n }, waiting (not
 * synced yet), refused (rejected / failed), first, last (ISO times) }.
 */
export const personSummary = (rows = []) => {
  const list = asArray(rows).filter(Boolean);
  const byCollection = {};
  const byOp = {};
  const days = new Set();
  let first = '';
  let last = '';
  list.forEach((r) => {
    byCollection[r.collection] = (byCollection[r.collection] || 0) + 1;
    byOp[r.op] = (byOp[r.op] || 0) + 1;
    const at = rowTime(r);
    if (at) {
      days.add(localDay(at));
      if (!first || at < first) first = at;
      if (!last || at > last) last = at;
    }
  });
  return {
    total: list.length,
    days: days.size,
    byCollection,
    byOp,
    waiting: list.filter((r) => r.pending).length,
    refused: list.filter((r) => r.outcome === 'rejected' || r.outcome === 'failed').length,
    first,
    last,
  };
};

/** The days a period covers up to `today` (both included): 'today' | 'week' (7 days) | 'month' (30 days). */
export const periodDays = (period, today) => {
  const back = { today: 0, week: 6, month: 29 }[period];
  if (back === undefined || !today) return { from: '', to: '' };
  const d = new Date(`${today}T12:00:00`);
  d.setDate(d.getDate() - back);
  return { from: localDay(d.toISOString()), to: today };
};
