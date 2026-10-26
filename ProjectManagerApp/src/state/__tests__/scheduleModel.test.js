import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  baselineComparison,
  childrenOf,
  daysBetween,
  fieldLock,
  headerTiers,
  ordersInScope,
  scheduleStatus,
  timelineRange,
  visibleRows,
} from '../scheduleModel.js';

const tree = [
  { id: 'g1', wbs: '1', isGroup: true },
  { id: 'a', wbs: '1.1', name: 'Alpha', isCritical: true, startDate: '2026-01-01', endDate: '2026-01-10' },
  { id: 'b', wbs: '1.2', name: 'Beta', startDate: '2026-01-05', endDate: '2026-02-01' },
  { id: 'g2', wbs: '2', isGroup: true },
  { id: 'g21', wbs: '2.1', isGroup: true },
  { id: 'c', wbs: '2.1.1', name: 'Gamma', startDate: '2026-02-01', endDate: '2026-03-01' },
];

test('daysBetween and timelineRange (today extends the range, 21-day tail)', () => {
  assert.equal(daysBetween('2026-01-01', '2026-01-31'), 30);
  assert.deepEqual(timelineRange(tree, '2025-01-01', '2026-01-15'), { start: '2026-01-01', days: daysBetween('2026-01-01', '2026-03-22') });
  assert.equal(timelineRange(tree, '2025-01-01', '2026-06-01').days, daysBetween('2026-01-01', '2026-06-22'));
  assert.deepEqual(timelineRange([], '2026-05-01', '2026-05-01'), { start: '2026-05-01', days: 21 });
});

test('headerTiers groups days into spans per zoom', () => {
  const name = (d) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
  const month = headerTiers('2026-01-30', 5, 'month', name);
  assert.deepEqual(month.top, [{ key: '2026', label: '2026', days: 5 }]);
  assert.deepEqual(month.bottom.map((s) => [s.label, s.days]), [['Jan 2026', 2], ['Feb', 3]]);
  assert.deepEqual(headerTiers('2025-12-30', 4, 'month', name).bottom.map((s) => s.label), ['Dec 2025', 'Jan 2026']);
  const week = headerTiers('2026-01-06', 4, 'week', name);
  assert.deepEqual(week.bottom.map((s) => [s.label, s.days]), [['1', 2], ['8', 2]]);
  const quarter = headerTiers('2026-03-31', 2, 'quarter', name);
  assert.deepEqual(quarter.bottom.map((s) => s.label), ['Q1', 'Q2']);
});

test('visibleRows: collapse hides descendants; filters keep ancestors and ignore collapse', () => {
  const all = visibleRows(tree);
  assert.deepEqual(all.map((r) => [r.task.id, r.depth, r.hasChildren]), [
    ['g1', 0, true], ['a', 1, false], ['b', 1, false], ['g2', 0, true], ['g21', 1, true], ['c', 2, false],
  ]);
  assert.deepEqual(visibleRows(tree, { collapsed: new Set(['g2']) }).map((r) => r.task.id), ['g1', 'a', 'b', 'g2']);
  assert.deepEqual(visibleRows(tree, { collapsed: new Set(['g21']) }).map((r) => r.task.id), ['g1', 'a', 'b', 'g2', 'g21']);
  assert.deepEqual(visibleRows(tree, { criticalOnly: true, collapsed: new Set(['g1']) }).map((r) => r.task.id), ['g1', 'a']);
  assert.deepEqual(visibleRows(tree, { query: 'gam' }).map((r) => r.task.id), ['g2', 'g21', 'c']);
  assert.deepEqual(visibleRows(tree, { query: '1.2' }).map((r) => r.task.id), ['g1', 'b']);
});

test('fieldLock reproduces the Gantt locks', () => {
  const leaf = { isGroup: false };
  assert.equal(fieldLock({ ...leaf, boqLinked: true }, 'quantity', false), 'boq');
  assert.equal(fieldLock(leaf, 'quantity', true), 'signed');
  assert.equal(fieldLock(leaf, 'unitPrice', true), 'signed');
  assert.equal(fieldLock(leaf, 'unitPrice', false), null);
  assert.equal(fieldLock({ ...leaf, orderSource: { manual: false } }, 'actualQuantity', false), 'orders');
  assert.equal(fieldLock({ ...leaf, orderSource: { manual: true } }, 'actualQuantity', false), null);
  assert.equal(fieldLock({ ...leaf, dependsOn: 'x' }, 'manualStart', false), 'dependency');
  assert.equal(fieldLock(leaf, 'lag', false), 'noDependency');
  assert.equal(fieldLock({ isGroup: true }, 'duration', false), 'group');
  assert.equal(fieldLock({ isGroup: true }, 'name', true), null);
});

test('fieldLock: any predecessor (extra links, computed links) drives the start', () => {
  const leaf = { isGroup: false };
  // A legacy writer cleared dependsOn but an extra link remains.
  assert.equal(fieldLock({ ...leaf, dependsOn: null, predecessors: [{ id: 'a' }, { id: 'b', type: 'FS', lag: 0 }] }, 'manualStart', false), 'dependency');
  // Engine output carries the normalized links.
  assert.equal(fieldLock({ ...leaf, links: [{ id: 'b', type: 'SS', lag: 0 }] }, 'manualStart', false), 'dependency');
  assert.equal(fieldLock({ ...leaf, links: [] }, 'manualStart', false), null);
});

test('childrenOf, ordersInScope and scheduleStatus', () => {
  assert.deepEqual(childrenOf(tree, tree[3]).map((t) => t.id), ['g21']);
  const orders = [
    { id: 'o1', taskId: 'c', recordedAt: '1' },
    { id: 'o2', taskId: 'a', recordedAt: '2' },
    { id: 'o3', taskId: 'c', recordedAt: '3' },
  ];
  assert.deepEqual(ordersInScope(tree, orders, 'g2').map((o) => o.id), ['o3', 'o1']);
  assert.equal(scheduleStatus({ progress: 1 }, '2026-01-01'), 'done');
  assert.equal(scheduleStatus({ progress: 0.2, startDate: '2025-01-01', endDate: '2025-12-31' }, '2026-01-01'), 'late');
  assert.equal(scheduleStatus({ progress: 0.2, startDate: '2025-12-01', endDate: '2026-02-01' }, '2026-01-01'), 'active');
  assert.equal(scheduleStatus({ progress: 0, startDate: '2026-02-01', endDate: '2026-03-01' }, '2026-01-01'), 'notStarted');
});

test('baselineComparison: values then vs now, new items, totals', () => {
  assert.equal(baselineComparison([], null), null);
  const computed = [
    { id: 'g', isGroup: true },
    { id: 'a', qty: 120, price: 10 },
    { id: 'b', qty: 50, price: 4 },
    { id: 'n', qty: 5, price: 100 },
  ];
  const baseline = { tasks: { a: { quantity: 100, unitPrice: 10 }, b: { quantity: 50, unitPrice: 4 } } };
  const out = baselineComparison(computed, baseline);
  assert.deepEqual(out.rows.map((r) => [r.task.id, r.deltaValue, r.changed, r.isNew]), [
    ['a', 200, true, false],
    ['b', 0, false, false],
    ['n', 500, true, true],
  ]);
  assert.deepEqual(out.totals, { baseValue: 1200, value: 1900, changed: 2, deltaValue: 700 });
});
