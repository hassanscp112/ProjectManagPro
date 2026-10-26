import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  diffFields,
  filterTimeline,
  historyHref,
  lastChange,
  localDay,
  periodDays,
  personSummary,
  recordName,
  recordStamps,
  restoreGate,
  restorePayload,
  splitItemId,
  timelineActors,
  timelineQuery,
  valueText,
} from '../historyModel.js';

const paths = (changes) => changes.map((c) => `${c.change}:${c.path}`);

/* ─────────────── diff ─────────────── */

test('diffFields: changed, added and removed fields', () => {
  const changes = diffFields({ quantity: 10, unit: 'm3', note: 'old' }, { quantity: 12, unit: 'm3', location: 'km 4' });
  assert.deepEqual(paths(changes), ['changed:quantity', 'added:location', 'removed:note']);
  assert.deepEqual(changes[0], { path: 'quantity', segments: [{ field: 'quantity' }], change: 'changed', before: 10, after: 12 });
  assert.equal(changes[1].before, null);
  assert.equal(changes[2].after, null);
});

test('diffFields: nested values give one entry per leaf', () => {
  const changes = diffFields(
    { who: { kind: 'contractor', contractorId: 'k1' }, details: { note: 'a' } },
    { who: { kind: 'team', teamId: 't1' }, details: { note: 'a' } }
  );
  assert.deepEqual(paths(changes), ['changed:who.kind', 'added:who.teamId', 'removed:who.contractorId']);
  assert.deepEqual(changes[0].segments, [{ field: 'who' }, { field: 'kind' }]);
});

test('diffFields: lists of plain values say what came and went', () => {
  const [change] = diffFields({ taskIds: ['a', 'b'] }, { taskIds: ['a', 'c', 'd'] });
  assert.equal(change.path, 'taskIds');
  assert.equal(change.change, 'changed');
  assert.deepEqual(change.list, { added: ['c', 'd'], removed: ['b'] });
});

test('diffFields: lists of records are matched by id', () => {
  const before = { manpower: [{ id: 'm1', trade: 'Steel fixer', count: 4 }, { id: 'm2', trade: 'Helper', count: 2 }] };
  const after = { manpower: [{ id: 'm1', trade: 'Steel fixer', count: 6 }, { id: 'm3', trade: 'Driver', count: 1 }] };
  const changes = diffFields(before, after);
  assert.deepEqual(paths(changes), ['changed:manpower[m1].count', 'added:manpower[m3]', 'removed:manpower[m2]']);
  assert.deepEqual(changes[0].segments, [{ field: 'manpower' }, { id: 'm1', item: 'Steel fixer' }, { field: 'count' }]);
  assert.deepEqual(changes[1].after, { id: 'm3', trade: 'Driver', count: 1 });
  assert.equal(changes[2].segments[1].item, 'Helper');
});

test('diffFields: reordering a list of records is not a change; certificate lines match by taskId', () => {
  assert.deepEqual(diffFields({ rows: [{ id: 'a', n: 1 }, { id: 'b', n: 2 }] }, { rows: [{ id: 'b', n: 2 }, { id: 'a', n: 1 }] }), []);
  const changes = diffFields({ lines: [{ taskId: 't1', thisQty: 5 }] }, { lines: [{ taskId: 't1', thisQty: 7 }] });
  assert.deepEqual(paths(changes), ['changed:lines[t1].thisQty']);
});

test('diffFields: a keyed diary day (item days/2026-10-26)', () => {
  const itemId = 'days/2026-10-26';
  assert.deepEqual(splitItemId(itemId), { list: 'days', key: '2026-10-26', doc: false });
  const before = { weather: 'sunny', hours: 8, manpower: [{ id: 'm1', trade: '', count: 10 }], issues: '', updatedBy: 'Ali', updatedAt: '2026-10-26T08:00:00Z' };
  const after = { weather: 'dusty', hours: 8, manpower: [{ id: 'm1', trade: '', count: 12 }], issues: 'Pump broke', updatedBy: 'Sara', updatedAt: '2026-10-26T15:00:00Z' };
  const changes = diffFields(before, after);
  // updatedBy / updatedAt are bookkeeping (the row names who and when).
  assert.deepEqual(paths(changes), ['changed:weather', 'changed:manpower[m1].count', 'added:issues']);
  // A record without a name is labelled by its id.
  assert.equal(changes[1].segments[1].item, 'm1');
  assert.deepEqual(paths(diffFields(before, after, { hidden: [] })), ['changed:weather', 'changed:manpower[m1].count', 'added:issues', 'changed:updatedBy', 'changed:updatedAt']);
  // Inside a record list the ids are what match records, never a change of their own.
  assert.deepEqual(paths(diffFields({ rows: [{ id: 'a', n: 1 }] }, { rows: [{ id: 'a', n: 1, extra: 2 }] })), ['added:rows[a].extra']);
});

test('diffFields: a first version lists what was filled in, a deletion what was there', () => {
  // The id never changes and the row says which record: it is left out with the bookkeeping.
  assert.deepEqual(paths(diffFields(null, { id: 'o1', quantity: 5, note: '', evidence: [], recordedAt: 'x' })), ['added:quantity']);
  assert.deepEqual(paths(diffFields({ id: 'o1', quantity: 5, note: '' }, null)), ['removed:quantity']);
});

test('diffFields: empty to empty is no change; plain values and lists at the top', () => {
  assert.deepEqual(diffFields({ note: undefined, tags: [] }, { note: '', tags: [], extra: null }), []);
  assert.deepEqual(paths(diffFields(3, 4)), ['changed:']);
  assert.deepEqual(diffFields('same', 'same'), []);
  assert.deepEqual(paths(diffFields([{ id: 'a', n: 1 }], [{ id: 'a', n: 2 }])), ['changed:[a].n']);
});

test('valueText: empty, yes/no, numbers, lists and records', () => {
  const words = { empty: '—', yes: 'Yes', no: 'No', num: (n) => `#${n}`, items: (n) => `${n} items` };
  assert.equal(valueText('', words), '—');
  assert.equal(valueText(null, words), '—');
  assert.equal(valueText(true, words), 'Yes');
  assert.equal(valueText(12, words), '#12');
  assert.equal(valueText(['a', 'b'], words), 'a, b');
  assert.equal(valueText([{ x: 1 }, { x: 2 }], words), '2 items');
  assert.equal(valueText([{ id: 'm1', trade: 'Steel fixer', count: 6 }, { id: 'm2', name: 'Ali' }], words), 'Steel fixer × #6, Ali');
  assert.equal(valueText({ id: 'm3', trade: 'Driver', count: 2 }, words), 'Driver × #2');
  assert.equal(valueText({ name: 'Concrete', wbs: '2.1' }, words), '2.1 Concrete');
  assert.equal(valueText({ a: 1, b: 2 }, words), '2 items');
  // Dates and times go through `date`; other strings as they are.
  const date = (s) => `<${s}>`;
  assert.equal(valueText('2026-10-26', { date }), '<2026-10-26>');
  assert.equal(valueText('2026-10-26T08:00:00.000Z', { date }), '<2026-10-26T08:00:00.000Z>');
  assert.equal(valueText('2026-10-26 notes', { date }), '2026-10-26 notes');
  assert.equal(valueText('2026-10-26'), '2026-10-26');
});

test('recordName, historyHref and splitItemId', () => {
  assert.equal(recordName({ wbs: '1.2', name: 'Fill' }), '1.2 Fill');
  assert.equal(recordName({ title: 'Rain' }), 'Rain');
  assert.equal(recordName(null, 'days/2026-10-26'), '2026-10-26');
  assert.equal(historyHref('pm-site-diary', 'days/2026-10-26'), '#/history/pm-site-diary/days%2F2026-10-26');
  assert.deepEqual(splitItemId('$doc'), { list: '', key: '$doc', doc: true });
  assert.deepEqual(splitItemId('abc'), { list: '', key: 'abc', doc: false });
});

/* ─────────────── stamps ─────────────── */

test('recordStamps: recorded, approved, issued and last edited', () => {
  assert.deepEqual(recordStamps({ recordedBy: 'Ali', recordedAt: '2026-10-01T08:00:00Z', approvedBy: 'Sara' }), [
    { kind: 'recorded', name: 'Ali', at: '2026-10-01T08:00:00Z' },
    { kind: 'approved', name: 'Sara', at: '' },
  ]);
  // A certificate: createdBy (a name) and issuedBy (an actor).
  assert.deepEqual(
    recordStamps({ createdBy: 'Ali', createdAt: 'a', issuedBy: { id: 'u2', name: 'Sara', role: 'pm' }, issuedAt: 'b' }).map((s) => `${s.kind}:${s.name}`),
    ['recorded:Ali', 'issued:Sara']
  );
  // The first save is not an edit; a later one is.
  assert.deepEqual(recordStamps({ recordedBy: 'Ali', recordedAt: 't1', updatedBy: 'Ali', updatedAt: 't1' }).map((s) => s.kind), ['recorded']);
  assert.deepEqual(recordStamps({ recordedBy: 'Ali', recordedAt: 't1', updatedBy: 'Omar', updatedAt: 't2' }).at(-1), { kind: 'edited', name: 'Omar', at: 't2' });
  // The server's newest row wins when it is newer than the record's own stamp.
  const last = { actor: { id: 'u3', name: 'Huda' }, serverAt: '2026-10-05T00:00:00Z' };
  assert.deepEqual(recordStamps({ recordedBy: 'Ali', updatedBy: 'Omar', updatedAt: '2026-10-02T00:00:00Z' }, { last }).at(-1), { kind: 'edited', name: 'Huda', at: '2026-10-05T00:00:00Z' });
  // The first version on the server is the recording itself, not an edit.
  const created = { op: 'insert', actor: { id: 'u1', name: 'Ali' }, clientAt: '2026-10-05T00:00:00Z' };
  assert.deepEqual(recordStamps({ createdBy: 'Ali', createdAt: '2026-10-04T23:59:59Z' }, { last: created }).map((s) => s.kind), ['recorded']);
  assert.deepEqual(recordStamps(null), []);
});

test('lastChange: the newest applied or pending row', () => {
  const rows = [{ id: 'r', outcome: 'rejected' }, { id: 'p', outcome: 'pending' }, { id: 'a', outcome: 'applied' }];
  assert.equal(lastChange(rows).id, 'p');
  assert.equal(lastChange([{ outcome: 'failed' }]), null);
});

/* ─────────────── restore ─────────────── */

const orderV1 = { id: 'o1', family: 'value', tier: 'formal', status: 'recorded', quantity: 10 };
const orderV2 = { ...orderV1, quantity: 12 };
const orderV3 = { ...orderV2, status: 'approved' };
const row = (id, op, before, after, extra = {}) => ({ id, collection: 'pm-orders', itemId: 'orders/o1', op, before, after, outcome: 'applied', pending: false, ...extra });
const history = [row(3, 'update', orderV2, orderV3), row(2, 'update', orderV1, orderV2), row(1, 'insert', null, orderV1)];

test('restorePayload: the version a row brings back', () => {
  assert.deepEqual(restorePayload(history[1]), { ok: true, changeId: 2, version: orderV2 });
  // A deletion brings back the version it deleted.
  assert.deepEqual(restorePayload(row(4, 'delete', orderV3, null)), { ok: true, changeId: 4, version: orderV3 });
  assert.deepEqual(restorePayload({ ...history[0], id: 'local-7', pending: true, outcome: 'pending' }), { ok: false, code: 'pending' });
  assert.deepEqual(restorePayload({ ...history[0], collection: 'files' }), { ok: false, code: 'files' });
  assert.deepEqual(restorePayload(row(5, 'delete', null, null)), { ok: false, code: 'notFound' });
  assert.deepEqual(restorePayload(null), { ok: false, code: 'notFound' });
});

test('restoreGate: the newest version and pending rows have no button', () => {
  const admin = { id: 'u1', role: 'admin' };
  assert.deepEqual(restoreGate({ row: history[0], rows: history, actor: admin }), { show: false, code: 'current' });
  const pending = { ...history[0], id: 'local-1', pending: true, outcome: 'pending' };
  assert.deepEqual(restoreGate({ row: pending, rows: [pending, ...history], actor: admin }), { show: false, code: 'pending' });
  // A version equal to the record as it is now has nothing to restore.
  assert.deepEqual(restoreGate({ row: history[1], rows: history, current: orderV2, actor: admin }), { show: false, code: 'current' });
});

test('restoreGate: role rules are the sync rules (approved formal orders need an approver)', () => {
  const gate = restoreGate({ row: history[2], rows: history, actor: { id: 'u1', role: 'admin' } });
  assert.equal(gate.show, true);
  assert.equal(gate.ok, true);
  assert.deepEqual(gate.payload, { ok: true, changeId: 1, version: orderV1 });
  // A site engineer may write orders, but not replace an approved formal one.
  assert.deepEqual(restoreGate({ row: history[2], rows: history, actor: { id: 'u2', role: 'site' } }), { show: true, ok: false, code: 'notApprover' });
  assert.deepEqual(restoreGate({ row: history[2], rows: history, actor: { id: 'u3', role: 'viewer' } }), { show: true, ok: false, code: 'role' });
  // The record as it is now (from this device) beats the newest row.
  assert.equal(restoreGate({ row: history[2], rows: history, current: orderV2, actor: { id: 'u2', role: 'site' } }).ok, true);
});

test('restoreGate: a deleted record can be brought back', () => {
  const rows = [row(4, 'delete', orderV2, null), ...history.slice(1)];
  const gate = restoreGate({ row: rows[0], rows, actor: { id: 'u2', role: 'site' } });
  assert.equal(gate.ok, true);
  assert.deepEqual(gate.payload.version, orderV2);
});

/* ─────────────── timeline ─────────────── */

test('timelineQuery: type, person and local days → getProjectTimeline arguments', () => {
  assert.deepEqual(timelineQuery(), { limit: 100 });
  assert.deepEqual(timelineQuery({ type: 'value', actor: 'u1', limit: 50 }), { limit: 50, collection: 'pm-orders', actor: 'u1' });
  assert.deepEqual(timelineQuery({ type: 'shared', beforeId: 120 }), { limit: 100, shared: true, beforeId: 120 });
  const q = timelineQuery({ type: 'diary', from: '2026-10-20', to: '2026-10-26' });
  assert.equal(q.collection, 'pm-site-diary');
  assert.equal(q.from, new Date('2026-10-20T00:00:00').toISOString());
  // `to` is the day after (the server compares server_at < to).
  assert.equal(q.to, new Date('2026-10-27T00:00:00').toISOString());
  assert.equal(timelineQuery({ type: 'nope' }).collection, undefined);
});

const at = (day, h = 10) => new Date(`${day}T${String(h).padStart(2, '0')}:00:00`).toISOString();
const tl = [
  { id: 'local-2', collection: 'pm-orders', itemId: 'orders/e1', op: 'insert', after: { family: 'expense' }, actor: { id: 'u1', name: 'Ali' }, clientAt: at('2026-10-26'), outcome: 'pending', pending: true },
  { id: 9, collection: 'pm-orders', itemId: 'orders/o1', op: 'update', before: { family: 'value' }, after: { family: 'value' }, actor: { id: 'u2', name: 'Sara' }, serverAt: at('2026-10-25'), outcome: 'applied' },
  { id: 8, collection: 'project-manager-project-meta', itemId: 'variations/v1', op: 'insert', after: { field: 'quantity' }, actor: { id: 'u1', name: 'Ali' }, serverAt: at('2026-10-20'), outcome: 'applied' },
  { id: 7, collection: 'project-manager-project-meta', itemId: '$doc', op: 'update', after: { status: 'signed' }, actor: { id: 'u2', name: 'Sara' }, serverAt: at('2026-10-18'), outcome: 'rejected' },
  { id: 6, collection: 'pm-orders', itemId: 'orders/o2', op: 'delete', before: { family: 'value' }, after: null, actor: { id: 'u1', name: 'Ali' }, serverAt: at('2026-10-10'), outcome: 'applied' },
];

test('filterTimeline: family, variation orders, person and days', () => {
  const ids = (rows) => rows.map((r) => r.id);
  assert.deepEqual(ids(filterTimeline(tl)), ['local-2', 9, 8, 7, 6]);
  // A deletion's family comes from the version it deleted.
  assert.deepEqual(ids(filterTimeline(tl, { type: 'value' })), [9, 6]);
  assert.deepEqual(ids(filterTimeline(tl, { type: 'expense' })), ['local-2']);
  assert.deepEqual(ids(filterTimeline(tl, { type: 'variation' })), [8]);
  assert.deepEqual(ids(filterTimeline(tl, { actor: 'u1' })), ['local-2', 8, 6]);
  // Pending rows come back unfiltered by date: the range applies here too.
  assert.deepEqual(ids(filterTimeline(tl, { from: '2026-10-18', to: '2026-10-25' })), [9, 8, 7]);
  assert.deepEqual(filterTimeline([null, undefined]), []);
});

test('timelineActors: members and the people in the rows, by name', () => {
  assert.deepEqual(timelineActors(tl, [{ userId: 'u3', name: 'Huda' }, { userId: 'u2', name: '', email: 'sara@x.iq' }]), [
    { id: 'u1', name: 'Ali' },
    { id: 'u3', name: 'Huda' },
    { id: 'u2', name: 'sara@x.iq' },
  ]);
});

test('personSummary: what one person did', () => {
  const ali = filterTimeline(tl, { actor: 'u1' });
  const sum = personSummary(ali);
  assert.equal(sum.total, 3);
  assert.equal(sum.days, 3);
  assert.deepEqual(sum.byCollection, { 'pm-orders': 2, 'project-manager-project-meta': 1 });
  assert.deepEqual(sum.byOp, { insert: 2, delete: 1 });
  assert.equal(sum.waiting, 1);
  assert.equal(sum.first, at('2026-10-10'));
  assert.equal(sum.last, at('2026-10-26'));
  assert.equal(personSummary(filterTimeline(tl, { actor: 'u2' })).refused, 1);
  assert.deepEqual(personSummary([]), { total: 0, days: 0, byCollection: {}, byOp: {}, waiting: 0, refused: 0, first: '', last: '' });
});

test('periodDays and localDay', () => {
  assert.deepEqual(periodDays('week', '2026-10-26'), { from: '2026-10-20', to: '2026-10-26' });
  assert.deepEqual(periodDays('today', '2026-10-26'), { from: '2026-10-26', to: '2026-10-26' });
  assert.deepEqual(periodDays('month', '2026-03-01'), { from: '2026-01-31', to: '2026-03-01' });
  assert.deepEqual(periodDays('custom', '2026-10-26'), { from: '', to: '' });
  assert.equal(localDay(at('2026-10-26', 23)), '2026-10-26');
  assert.equal(localDay(''), '');
  assert.equal(localDay('not a date'), '');
});
