import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  certificateTotals,
  compareWbs,
  computeCertificate,
  eligibleOrders,
  filterCertificates,
  rateFor,
  rateRows,
} from '../certificateModel.js';

const tasks = [
  { id: 'g', wbs: '1', name: 'Earth', isGroup: true },
  { id: 'a', wbs: '1.1', name: 'Dig', unit: 'm3', unitPrice: 12 },
  { id: 'b', wbs: '1.2', name: 'Fill', unit: 'm3', unitPrice: 5 },
  { id: 'c', wbs: '1.10', name: 'Trim', unit: 'm2', unitPrice: 0 },
];
const rates = { k1: { a: 10, b: 4 }, k2: { a: 9 } };
const terms = (over = {}) => ({ retentionPct: 0, retentionLimit: 0, advanceAmount: 0, advanceRecoveryPct: 0, ...over });

const order = (id, taskId, quantity, date, over = {}) => ({
  id,
  family: 'value',
  status: 'approved',
  taskId,
  quantity,
  date,
  who: { kind: 'contractor', contractorId: 'k1' },
  ...over,
});

const draft = (number, periodEnd, over = {}) => ({
  id: `c${number}`,
  kind: 'subcontractor',
  contractorId: 'k1',
  number,
  periodEnd,
  status: 'draft',
  terms: terms(),
  deductions: [],
  ...over,
});

/** What Certificates.issueCertificate freezes. */
const issue = (cert, ctx) => {
  const r = computeCertificate(cert, ctx);
  return { ...cert, status: 'issued', periodStart: r.periodStart, lines: r.lines, totals: r.totals, orderIds: r.orderIds };
};

const line = (r, taskId) => r.lines.find((l) => l.taskId === taskId);

test('line math across several periods: previous + this period = to date, each × rate', () => {
  const orders = [order('o1', 'a', 10, '2026-09-10'), order('o2', 'a', 5, '2026-09-25'), order('o3', 'b', 20, '2026-10-05'), order('o4', 'a', 3, '2026-10-20T08:00:00Z')];
  const ctx = { rates, tasks, orders, certificates: [] };

  const c1 = draft(1, '2026-09-30');
  const r1 = computeCertificate(c1, ctx);
  assert.deepEqual(r1.lines.map((l) => [l.taskId, l.prevQty, l.thisQty, l.cumQty, l.prevAmount, l.thisAmount, l.cumAmount]), [['a', 0, 15, 15, 0, 150, 150]]);
  assert.deepEqual(r1.orderIds, ['o1', 'o2']);
  assert.equal(r1.periodStart, '2026-09-10');
  assert.deepEqual(r1.totals.gross, { prev: 0, this: 150, cum: 150 });
  assert.equal(r1.totals.netPayable, 150);
  assert.equal(r1.issuable, true);

  const i1 = issue(c1, ctx);
  const c2 = draft(2, '2026-10-31');
  const r2 = computeCertificate(c2, { ...ctx, certificates: [i1, c2] });
  assert.deepEqual(r2.lines.map((l) => [l.taskId, l.prevQty, l.thisQty, l.cumQty, l.cumAmount]), [['a', 15, 3, 18, 180], ['b', 0, 20, 20, 80]]);
  assert.deepEqual(r2.totals.gross, { prev: 150, this: 110, cum: 260 });
  assert.equal(r2.totals.previousNet, 150);
  assert.equal(r2.totals.netPayable, 110);
  assert.equal(r2.periodStart, '2026-10-01');
  assert.deepEqual(r2.orderIds, ['o3', 'o4']);

  // A quiet third period still lists every item to date, with nothing new.
  const i2 = issue(c2, { ...ctx, certificates: [i1, c2] });
  const c3 = draft(3, '2026-11-30');
  const r3 = computeCertificate(c3, { ...ctx, certificates: [i1, i2, c3] });
  assert.deepEqual(r3.lines.map((l) => [l.taskId, l.prevQty, l.thisQty, l.cumQty]), [['a', 18, 0, 18], ['b', 20, 0, 20]]);
  assert.deepEqual([r3.totals.gross.this, r3.totals.netPayable, r3.orderIds.length], [0, 0, 0]);
});

test('an order approved late (dated in a certified period) is paid in the next certificate', () => {
  const ctx = { rates, tasks, orders: [order('o1', 'a', 10, '2026-09-10')], certificates: [] };
  const i1 = issue(draft(1, '2026-09-30'), ctx);
  const late = order('late', 'a', 2, '2026-09-28');
  const c2 = draft(2, '2026-10-31');
  const r2 = computeCertificate(c2, { ...ctx, orders: [...ctx.orders, late], certificates: [i1, c2] });
  assert.deepEqual([line(r2, 'a').prevQty, line(r2, 'a').thisQty], [10, 2]);
  assert.deepEqual(r2.orderIds, ['late']);
});

test('only approved value orders on an item count, up to the period end, by this contractor', () => {
  const orders = [
    order('ok', 'a', 1, '2026-09-01'),
    order('recorded', 'a', 1, '2026-09-01', { status: 'recorded' }),
    order('expense', 'a', 1, '2026-09-01', { family: 'expense', amount: 500 }),
    order('other', 'a', 1, '2026-09-01', { who: { kind: 'contractor', contractorId: 'k2' } }),
    order('team', 'a', 1, '2026-09-01', { who: { kind: 'team', teamId: 't' } }),
    order('zero', 'a', 0, '2026-09-01'),
    order('negative', 'a', -4, '2026-09-01'),
    order('noTask', '', 1, '2026-09-01'),
    order('late', 'a', 1, '2026-10-01'),
    null,
  ];
  const ids = (list) => list.map((o) => o.id);
  assert.deepEqual(ids(eligibleOrders(orders, { kind: 'subcontractor', contractorId: 'k1', periodEnd: '2026-09-30' })), ['ok']);
  assert.deepEqual(ids(eligibleOrders(orders, { kind: 'employer', periodEnd: '2026-09-30' })), ['ok', 'other', 'team']);
  const r = computeCertificate(draft(1, '2026-09-30'), { rates, tasks, orders, certificates: [] });
  assert.deepEqual([r.lines.length, line(r, 'a').cumQty, r.totals.gross.cum], [1, 1, 10]);
});

test('employer certificate: every contractor and crew at the BOQ unit price', () => {
  const orders = [order('o1', 'a', 10, '2026-09-10'), order('o2', 'b', 4, '2026-09-11', { who: { kind: 'workers', workerIds: ['w'] } })];
  const r = computeCertificate(draft(1, '2026-09-30', { kind: 'employer', contractorId: null }), { rates, tasks, orders, certificates: [] });
  assert.deepEqual(r.lines.map((l) => [l.taskId, l.rate, l.cumAmount]), [['a', 12, 120], ['b', 5, 20]]);
  assert.equal(r.totals.gross.cum, 140);
});

test('a missing rate is flagged, never valued at zero, and blocks issuing', () => {
  const orders = [order('o1', 'a', 10, '2026-09-10'), order('o2', 'c', 7, '2026-09-11')];
  const r = computeCertificate(draft(1, '2026-09-30'), { rates, tasks, orders, certificates: [] });
  const c = line(r, 'c');
  assert.deepEqual([c.rate, c.missingRate, c.cumAmount, c.thisAmount], [null, true, null, null]);
  assert.equal(r.totals.missingRates, 1);
  assert.equal(r.totals.gross.cum, 100); // only the rated item
  assert.deepEqual(r.problems, ['missingRates']);
  assert.equal(r.issuable, false);

  // An explicit 0 is a rate; a BOQ price of 0 is not.
  assert.equal(rateFor('subcontractor', 'k1', 'c', tasks[3], { k1: { c: 0 } }), 0);
  assert.equal(rateFor('employer', null, 'c', tasks[3], {}), null);
  assert.equal(rateFor('subcontractor', 'k9', 'a', tasks[1], rates), null);
});

test('retention: a share of the gross to date, up to its limit', () => {
  const lines = [{ cumAmount: 1000 }];
  assert.deepEqual(certificateTotals(lines, { terms: terms({ retentionPct: 5 }) }).retention, { prev: 0, this: 50, cum: 50, limited: false });
  const capped = certificateTotals(lines, { terms: terms({ retentionPct: 10, retentionLimit: 80 }) });
  assert.deepEqual([capped.retention.cum, capped.retention.limited, capped.netPayable], [80, true, 920]);

  // Second certificate: retention re-based on the new gross to date.
  const prev = [{ totals: { ...certificateTotals(lines, { terms: terms({ retentionPct: 5 }) }) } }];
  const t2 = certificateTotals([{ cumAmount: 3000 }], { terms: terms({ retentionPct: 5 }) }, prev);
  assert.deepEqual(t2.retention, { prev: 50, this: 100, cum: 150, limited: false });
  assert.deepEqual([t2.netDue.cum, t2.previousNet, t2.netPayable], [2850, 950, 1900]);
});

test('advance recovery: a share of each period, capped at what is left of the advance', () => {
  const t = terms({ advanceAmount: 250, advanceRecoveryPct: 20 });
  const t1 = certificateTotals([{ cumAmount: 1000 }], { terms: t });
  assert.deepEqual([t1.advance.this, t1.advance.cum, t1.advance.remaining, t1.advance.capped], [200, 200, 50, false]);
  const t2 = certificateTotals([{ cumAmount: 2000 }], { terms: t }, [{ totals: t1 }]);
  assert.deepEqual([t2.advance.this, t2.advance.cum, t2.advance.remaining, t2.advance.capped], [50, 250, 0, true]);
  const t3 = certificateTotals([{ cumAmount: 3000 }], { terms: t }, [{ totals: t1 }, { totals: t2 }]);
  assert.deepEqual([t3.advance.this, t3.advance.cum], [0, 250]);
  // A period whose gross went down recovers nothing (never a refund).
  const t4 = certificateTotals([{ cumAmount: 2500 }], { terms: t }, [{ totals: t1 }, { totals: t2 }, { totals: t3 }]);
  assert.deepEqual([t4.gross.this, t4.advance.this], [-500, 0]);
  // No advance, no recovery.
  assert.equal(certificateTotals([{ cumAmount: 1000 }], { terms: terms({ advanceRecoveryPct: 50 }) }).advance.cum, 0);
});

test('other deductions are carried forward, so later certificates never pay them back', () => {
  const orders = [order('o1', 'a', 10, '2026-09-10'), order('o2', 'a', 5, '2026-10-10')];
  const ctx = { rates, tasks, orders, certificates: [] };
  const c1 = draft(1, '2026-09-30', { terms: terms({ retentionPct: 5 }), deductions: [{ id: 'd', label: 'Fine', amount: 3 }] });
  const i1 = issue(c1, ctx);
  assert.deepEqual([i1.totals.gross.cum, i1.totals.retention.cum, i1.totals.deductions.cum, i1.totals.netPayable], [100, 5, 3, 92]);
  const c2 = draft(2, '2026-10-31', { terms: terms({ retentionPct: 5 }) });
  const r2 = computeCertificate(c2, { ...ctx, certificates: [i1, c2] });
  assert.deepEqual(r2.totals.deductions, { prev: 3, this: 0, cum: 3 });
  assert.equal(r2.totals.netPayable, 150 - 7.5 - 3 - 92);
  // Everything paid so far = what is due to date.
  assert.equal(i1.totals.netPayable + r2.totals.netPayable, r2.totals.netDue.cum);
});

test('an issued certificate is frozen: later order changes do not move it', () => {
  const orders = [order('o1', 'a', 10, '2026-09-10')];
  const i1 = issue(draft(1, '2026-09-30'), { rates, tasks, orders, certificates: [] });
  const changed = { rates: { k1: { a: 99 } }, tasks, orders: [{ ...orders[0], quantity: 500 }, order('o9', 'a', 1, '2026-09-01')], certificates: [i1] };
  const r = computeCertificate(i1, changed);
  assert.equal(r.frozen, true);
  assert.deepEqual([r.lines[0].cumQty, r.lines[0].rate, r.totals.netPayable, r.orderIds], [10, 10, 100, ['o1']]);
  assert.equal(r.issuable, false);
});

test('a draft whose period ends before the last issued one cannot be issued', () => {
  const ctx = { rates, tasks, orders: [order('o1', 'a', 10, '2026-09-10')], certificates: [] };
  const i1 = issue(draft(1, '2026-09-30'), ctx);
  const c2 = draft(2, '2026-09-15');
  assert.deepEqual(computeCertificate(c2, { ...ctx, certificates: [i1, c2] }).problems, ['beforePrevious']);
  assert.deepEqual(computeCertificate(draft(1, '2026-09-30'), { ...ctx, orders: [] }).problems, ['noLines']);
});

test('filters, sorting and the rates editor rows', () => {
  const list = [draft(1, '2026-09-30'), draft(2, '2026-10-31'), draft(1, '2026-10-31', { id: 'e1', kind: 'employer', contractorId: null })];
  assert.deepEqual(filterCertificates(list).map((c) => c.id), ['c2', 'e1', 'c1']);
  assert.deepEqual(filterCertificates(list, { kind: 'employer' }).map((c) => c.id), ['e1']);
  assert.deepEqual(filterCertificates(list, { contractorId: 'k1' }).map((c) => c.id), ['c2', 'c1']);
  assert.ok(compareWbs('1.2', '1.10') < 0);

  const orders = [order('o1', 'b', 1, '2026-09-01'), order('o2', 'c', 1, '2026-09-01', { status: 'recorded', who: { kind: 'contractor', contractorId: 'k2' } })];
  const rows = rateRows({ tasks, orders, rates, contractorIds: ['k1', 'k2'] });
  assert.deepEqual(rows.map((r) => r.task.id), ['a', 'b', 'c']);
  assert.deepEqual(rows[0].rates, { k1: 10, k2: 9 });
  assert.deepEqual([...rows[2].missing], ['k2']);
  assert.deepEqual(rateRows({ tasks, orders, rates, contractorIds: ['k1', 'k2'], onlyWorked: true }).map((r) => r.task.id), ['b', 'c']);
  assert.deepEqual(rateRows({ tasks, orders, rates, contractorIds: ['k1'], query: 'fill' }).map((r) => r.task.id), ['b']);
});
