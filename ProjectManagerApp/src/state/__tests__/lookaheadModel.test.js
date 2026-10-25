import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assignmentDone,
  dayCompletion,
  dayOrdersByTask,
  monthActuals,
  monthSummary,
  planSections,
  rateTone,
  targetRate,
} from '../lookaheadModel.js';

const tasks = [
  { id: 'g1', wbs: '1', isGroup: true },
  { id: 'a', wbs: '1.1' },
  { id: 'g11', wbs: '1.2', isGroup: true },
  { id: 'b', wbs: '1.2.1' },
  { id: 'g2', wbs: '2', isGroup: true },
  { id: 'c', wbs: '3' },
];

const orders = [
  { taskId: 'a', family: 'value', status: 'approved', date: '2026-10-03', quantity: 5 },
  { taskId: 'a', family: 'value', status: 'approved', date: '2026-10-20', quantity: '7' },
  { taskId: 'a', family: 'value', status: 'recorded', date: '2026-10-20', quantity: 100 },
  { taskId: 'a', family: 'value', status: 'approved', date: '2026-09-30', quantity: 50 },
  { taskId: 'b', family: 'money', status: 'approved', date: '2026-10-20', amount: 9 },
  { taskId: 'b', family: 'value', status: 'recorded', date: '2026-10-20', quantity: 1 },
  null,
];

test('planSections: top-level groups with their leaves; empty groups dropped; a top-level leaf is its own section', () => {
  assert.deepEqual(
    planSections(tasks).map((e) => [e.section.id, e.leaves.map((l) => l.id)]),
    [['g1', ['a', 'b']], ['c', ['c']]]
  );
});

test('monthActuals and monthSummary count approved quantity orders of the month, each task once', () => {
  const actuals = monthActuals(orders, '2026-10');
  assert.deepEqual([...actuals], [['a', 12]]);
  const targets = [
    { taskId: 'a', quantity: 20 },
    { taskId: 'a', quantity: '4' },
    { taskId: 'b', quantity: '' },
  ];
  assert.deepEqual(monthSummary(targets, actuals), { count: 3, target: 24, actual: 12, rate: 0.5 });
  assert.equal(monthSummary([], actuals).rate, null);
  assert.equal(targetRate(targets[0], actuals), 0.6);
  assert.equal(targetRate(targets[2], actuals), null);
});

test('dayCompletion: an assignment is done when its task has an approved order that day', () => {
  const byTask = dayOrdersByTask(orders, '2026-10-20');
  assert.deepEqual([...byTask.keys()], ['a', 'b']);
  const assignments = [{ taskId: 'a' }, { taskId: 'b' }, { taskId: 'c' }, { taskId: 'a' }];
  assert.equal(assignmentDone(assignments[0], byTask), true);
  assert.equal(assignmentDone(assignments[1], byTask), false);
  assert.deepEqual(dayCompletion(assignments, byTask), { done: 2, total: 4, rate: 0.5, approvedOrders: 1 });
  assert.deepEqual(dayCompletion([], new Map()), { done: 0, total: 0, rate: null, approvedOrders: 0 });
});

test('rateTone', () => {
  assert.equal(rateTone(null), 'neutral');
  assert.equal(rateTone(1), 'success');
  assert.equal(rateTone(0.85, 0.8), 'success');
  assert.equal(rateTone(0.6), 'warning');
  assert.equal(rateTone(0.2), 'danger');
});
