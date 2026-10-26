import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonths,
  dayOf,
  dayReport,
  dayStats,
  engineersOf,
  filterFeed,
  filterNotes,
  gapRadar,
  heatBucket,
  heatCalendar,
  monthBounds,
  monthlyReport,
  reportDays,
  taskStoryTotals,
} from '../reportsModel.js';

const tasks = [
  { id: 'g1', wbs: '1', name: 'Earth', isGroup: true },
  { id: 'a', wbs: '1.1', name: 'Dig', unit: 'm3', quantity: 100, qty: 100, unitPrice: 10 },
  { id: 'b', wbs: '1.2', name: 'Fill', unit: 'm3', quantity: 50, qty: 50, unitPrice: 4 },
  { id: 'g2', wbs: '2', name: 'Lining', isGroup: true },
  { id: 'c', wbs: '2.1', name: 'Concrete', unit: 'm2', quantity: 20, qty: 20, unitPrice: 100 },
];

const orders = [
  { id: 'o1', family: 'value', status: 'approved', taskId: 'a', quantity: 10, date: '2026-09-30', who: { kind: 'contractor', contractorId: 'k1' } },
  { id: 'o2', family: 'value', status: 'approved', taskId: 'a', quantity: 5, date: '2026-10-02', who: { kind: 'contractor', contractorId: 'k1' } },
  { id: 'o3', family: 'value', status: 'recorded', taskId: 'a', quantity: 7, date: '2026-10-02', who: { kind: 'team', teamId: 't' } },
  { id: 'o4', family: 'value', status: 'approved', taskId: 'c', quantity: 2, date: '2026-10-02T09:00:00Z', who: { kind: 'workers', workerIds: [] } },
  { id: 'o5', family: 'expense', status: 'approved', category: 'fuel', amount: 300, date: '2026-10-02' },
  { id: 'o6', family: 'expense', status: 'recorded', category: 'odd', amount: 50, date: '2026-10-20' },
  { id: 'o7', family: 'value', status: 'approved', quantity: 1, date: '2026-10-02', amount: 0 },
  null,
];

test('dates: dayOf, monthBounds, addMonths', () => {
  assert.equal(dayOf('2026-10-02T09:00:00Z'), '2026-10-02');
  assert.equal(dayOf(''), '');
  assert.deepEqual(monthBounds('2026-03'), { start: '2026-03-01', end: '2026-03-31', prevEnd: '2026-02-28' });
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(addMonths('2026-12', 1), '2027-01');
});

test('dayReport groups quantity orders by item, keeps expenses apart, values at contract price', () => {
  const r = dayReport(orders, tasks, '2026-10-02');
  assert.deepEqual(r.groups.map((g) => [g.key, g.qty, g.value]), [['a', 12, 120], ['c', 2, 200], ['', 1, 0]]);
  assert.deepEqual([r.count, r.value, r.expenseTotal, r.pending, r.isEmpty], [5, 320, 300, 1, false]);
  assert.equal(dayReport(orders, tasks, '2026-01-01').isEmpty, true);
});

test('notes: filter, engineers, days to print', () => {
  const notes = [
    { id: 1, date: '2026-10-01', engineer: 'Sara', timestamp: 1 },
    { id: 2, date: '2026-10-03', engineer: 'Ali', timestamp: 2 },
    { id: 3, date: '2026-10-03', engineer: 'Sara', timestamp: 3 },
  ];
  assert.deepEqual(filterNotes(notes, { from: '2026-10-02' }).map((n) => n.id), [3, 2]);
  assert.deepEqual(filterNotes(notes, { engineer: 'Sara' }).map((n) => n.id), [3, 1]);
  assert.deepEqual(engineersOf(notes), ['Ali', 'Sara']);
  assert.deepEqual(reportDays(orders, notes, '2026-10-01', '2026-10-10'), ['2026-10-03', '2026-10-02', '2026-10-01']);
});

test('monthlyReport: BOQ before/within the month, contractors, money summary', () => {
  const r = monthlyReport({ orders, tasks, variations: [{ id: 'v', date: '2026-10-05T10:00:00Z' }, { id: 'w', date: '2026-11-01' }], month: '2026-10' });
  assert.deepEqual(
    r.boqRows.map((x) => [x.wbs, x.unit, x.contractQty, x.prevQty, x.monthQty, x.remaining]),
    [['1', 'm3', 150, 10, 5, 135], ['2', 'm2', 20, 0, 2, 18]]
  );
  assert.equal(r.boqTotals.totalQty, 17);
  assert.equal(r.monthOrders.length, 6);
  assert.deepEqual(r.monthVariations.map((v) => v.id), ['v']);
  assert.deepEqual(r.contractors, [{ contractorId: 'k1', count: 1, qtyByUnit: [['m3', 5]], value: 50 }]);
  assert.deepEqual(r.internal, { count: 1, qtyByUnit: [['m2', 2]], value: 200 });
  assert.deepEqual(r.expenses.map((e) => [e.key, e.amount]), [['materials', 0], ['payroll', 0], ['machinery', 0], ['fuel', 300], ['other', 50]]);
  assert.deepEqual([r.valueTotal, r.expensesTotal, r.net], [320, 350, -30]);
});

test('filterFeed by chip, dates and actor', () => {
  const feed = [
    { kind: 'order', family: 'value', date: '2026-10-01', actor: 'Ali' },
    { kind: 'order', family: 'expense', date: '2026-10-02', actor: 'Sara' },
    { kind: 'variation', date: '2026-10-03', actor: 'Ali' },
    { kind: 'event', date: '2026-10-04', actor: '' },
  ];
  assert.equal(filterFeed(feed).length, 4);
  assert.equal(filterFeed(feed, { chip: 'expense' }).length, 1);
  assert.equal(filterFeed(feed, { chip: 'variation' }).length, 1);
  assert.equal(filterFeed(feed, { from: '2026-10-02', to: '2026-10-03' }).length, 2);
  assert.equal(filterFeed(feed, { actor: 'ali' }).length, 2);
});

test('taskStoryTotals', () => {
  const totals = taskStoryTotals(tasks[1], { orders, variations: [{ taskId: 'a' }], events: [{ refId: 'a' }, { refId: 'b' }], tasks });
  assert.deepEqual(
    [totals.contractQty, totals.executedQty, totals.variance, totals.contractValue, totals.executedValue, totals.orderCount, totals.approvedCount, totals.variationCount, totals.eventCount],
    [100, 22, -78, 1000, 220, 3, 2, 1, 1]
  );
});

test('heatmap: day stats, buckets, Saturday-first calendar, empty-days radar', () => {
  const stats = dayStats(orders, tasks);
  assert.deepEqual(stats.get('2026-10-02'), { count: 5, value: 250 });
  assert.equal(heatBucket(0, 100), 0);
  assert.equal(heatBucket(25, 100), 1);
  assert.equal(heatBucket(60, 100), 3);
  assert.equal(heatBucket(100, 100), 4);
  const cal = heatCalendar('2026-10-25');
  assert.equal(cal[0].days[0].date, '2025-11-01'); // a Saturday itself
  assert.equal(new Date(`${cal[0].days[0].date}T00:00:00Z`).getUTCDay(), 6);
  assert.equal(cal[0].month, 11);
  const last = cal.at(-1);
  assert.equal(last.days.filter(Boolean).at(-1).date, '2026-10-25');
  assert.ok(last.days.includes(null) || last.days.length === 7);
  assert.deepEqual(gapRadar(stats, '2026-10-03', 3), { recorded: 1, empty: 2 });
});

test('dayReport.photoIds: the day’s order photos in report order, without repeats', () => {
  const withPhotos = [
    { id: 'p1', family: 'expense', status: 'approved', amount: 10, date: '2026-10-02', evidence: ['e1'] },
    { id: 'p2', family: 'value', status: 'approved', taskId: 'a', quantity: 1, date: '2026-10-02', evidence: ['v1', 'v2'] },
    { id: 'p3', family: 'value', status: 'recorded', taskId: 'c', quantity: 1, date: '2026-10-02T08:00:00Z', evidence: ['v3', '', null, 'v1'] },
    { id: 'p4', family: 'value', status: 'approved', taskId: 'a', quantity: 1, date: '2026-10-02' },
    { id: 'p5', family: 'value', status: 'approved', taskId: 'a', quantity: 1, date: '2026-10-03', evidence: ['other-day'] },
  ];
  assert.deepEqual(dayReport(withPhotos, tasks, '2026-10-02').photoIds, ['v1', 'v2', 'v3', 'e1']);
  assert.deepEqual(dayReport(orders, tasks, '2026-10-02').photoIds, []);
  assert.deepEqual(dayReport([], tasks, '2026-10-02').photoIds, []);
});
