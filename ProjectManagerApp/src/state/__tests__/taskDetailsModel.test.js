import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  columnSums,
  directChildren,
  linkableLeaves,
  newColumn,
  newElement,
  orderRollup,
  patchColumn,
  patchElement,
  quantityRows,
  removeColumnPatch,
  setElementValue,
  sortedElements,
  spanDays,
  statusCounts,
} from '../taskDetailsModel.js';

const columns = [
  { id: 'c25', name: 'C25', wasteFactorPct: 10, linkedTaskId: null },
  { id: 'c20', name: 'C20', wasteFactorPct: 0, linkedTaskId: 'leaf' },
];
const elements = [
  { id: 'e1', status: 'completed', values: { c25: 2, c20: '3' } },
  { id: 'e2', status: 'in_progress', values: { c25: 4 } },
  { id: 'e3', status: 'not_started', values: {} },
  { id: 'e4', status: 'on_hold', values: { c20: 1 } },
];

test('sums, status counts and read order', () => {
  assert.deepEqual(columnSums(columns, elements), { c25: 6, c20: 4 });
  assert.deepEqual(statusCounts(elements), { not_started: 1, in_progress: 1, completed: 1, on_hold: 1 });
  assert.deepEqual(sortedElements(elements).map((x) => x.el.id), ['e2', 'e4', 'e3', 'e1']);
});

test('quantity rows: unlinked = sum with waste; linked = leaf quantities and reconciliation', () => {
  const computed = new Map([['leaf', { quantity: 5, actualQty: 2, elementSum: 4 }]]);
  const [a, b] = quantityRows(columns, { c25: 6, c20: 4 }, computed);
  assert.equal(Math.round(a.contract * 100) / 100, 6.6);
  assert.deepEqual([a.executed, a.remaining, a.rate, a.reconDelta], [null, null, null, null]);
  assert.deepEqual([b.contract, b.executed, b.remaining, b.rate, b.reconDelta], [5, 2, 3, 0.4, -1]);
});

test('children in WBS order and linkable leaves', () => {
  const tasks = [
    { id: 'g', wbs: '2', isGroup: true },
    { id: 'x10', wbs: '2.10' },
    { id: 'x2', wbs: '2.2', boqLink: { colId: 'c' } },
    { id: 'x1', wbs: '2.1', isGroup: true },
    { id: 'deep', wbs: '2.1.1' },
  ];
  const kids = directChildren(tasks, tasks[0]);
  assert.deepEqual(kids.map((k) => k.id), ['x1', 'x2', 'x10']);
  assert.deepEqual(linkableLeaves(kids).map((k) => k.id), ['x10']);
  assert.deepEqual(directChildren(tasks, tasks[1]), []);
});

test('order rollup and spans', () => {
  const r = orderRollup(
    [
      { type: 'quick_work', family: 'value', quantity: 5, who: { kind: 'contractor', contractorId: 'k' } },
      { type: 'completion', family: 'value', quantity: 1, who: { kind: 'contractor', contractorId: 'k' } },
      { type: 'fuel', family: 'expense', amount: 300, who: { kind: 'contractor', contractorId: 'z' } },
      { type: 'concrete_test', family: 'value', who: { kind: 'team' } },
    ],
    [{ id: 'k', name: 'Rafidain' }]
  );
  assert.deepEqual(r.contractors, [
    { id: 'k', name: 'Rafidain', count: 2, qty: 6, expense: 0 },
    { id: 'z', name: null, count: 1, qty: 0, expense: 300 },
  ]);
  assert.deepEqual([r.tests, r.completions, r.expenses], [1, 1, 300]);
  assert.equal(spanDays('2026-01-01', '2026-01-31'), 30);
  assert.equal(spanDays('', '2026-01-31'), null);
});

test('edits', () => {
  assert.deepEqual(newElement('n'), { id: 'n', name: '', location: '', status: 'not_started', notes: '', values: {} });
  assert.deepEqual(newColumn('c', { name: 'C30', unit: 'm3' }), { id: 'c', name: 'C30', unit: 'm3', wasteFactorPct: 0, linkedTaskId: null });
  assert.equal(patchElement(elements, 'e3', { name: 'MH-3' })[2].name, 'MH-3');
  assert.deepEqual(setElementValue(elements, 'e3', 'c25', '2.5')[2].values, { c25: 2.5 });
  assert.deepEqual(setElementValue(elements, 'e1', 'c25', '')[0].values, { c25: '', c20: '3' });
  assert.equal(patchColumn(columns, 'c25', { unit: 'm3' })[0].unit, 'm3');
  const removed = removeColumnPatch(columns, elements, 'c25');
  assert.deepEqual(removed.elementColumns.map((c) => c.id), ['c20']);
  assert.deepEqual(removed.elements[0].values, { c20: '3' });
});
