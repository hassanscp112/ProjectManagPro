import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterTasks, rankLeafTasks, wbsCompare } from '../TaskRanking.js';

const tasks = [
  { id: 'g1', wbs: '1', name: 'الحفريات', isGroup: true },
  { id: 'a', wbs: '1.10', name: 'Ten' },
  { id: 'b', wbs: '1.2', name: 'Two' },
  { id: 'c', wbs: '2.1', name: 'دفن القنوات' },
  { id: 'd', wbs: '1.1', name: 'One' },
];

test('wbsCompare orders segments numerically', () => {
  const sorted = [{ wbs: '1.10' }, { wbs: '1.2' }, { wbs: '1' }].sort(wbsCompare).map((t) => t.wbs);
  assert.deepEqual(sorted, ['1', '1.2', '1.10']);
});

test('rankLeafTasks puts most recently ordered tasks first, rest by WBS, skips groups', () => {
  const orders = [
    { taskId: 'c', recordedAt: '2026-10-01T08:00:00Z' },
    { taskId: 'a', recordedAt: '2026-10-20T08:00:00Z' },
    { taskId: 'c', recordedAt: '2026-09-01T08:00:00Z' },
  ];
  const { recent, rest } = rankLeafTasks(tasks, orders);
  assert.deepEqual(recent.map((t) => t.id), ['a', 'c']);
  assert.deepEqual(rest.map((t) => t.id), ['d', 'b']);
});

test('rankLeafTasks tolerates missing input', () => {
  assert.deepEqual(rankLeafTasks(undefined, null), { recent: [], rest: [] });
});

test('filterTasks matches WBS or name, case-insensitive, Arabic included', () => {
  assert.deepEqual(filterTasks(tasks, 'two').map((t) => t.id), ['b']);
  assert.deepEqual(filterTasks(tasks, '2.1').map((t) => t.id), ['c']);
  assert.deepEqual(filterTasks(tasks, 'دفن').map((t) => t.id), ['c']);
  assert.equal(filterTasks(tasks, '  ').length, tasks.length);
});
