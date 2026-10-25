import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_TASKS,
  addMainTask,
  addSubTask,
  appendGeneratedTasks,
  applyVariation,
  countPendingApprovals,
  deleteTaskCascade,
  describeDelete,
  linkExistingBoq,
  loadMeta,
  loadTasks,
  normalizeTaskUpdate,
  signOffProject,
  toggleBoqLink,
} from '../projectModel.js';

const memoryStorage = (data = {}) => ({ getItem: (k) => (k in data ? data[k] : null) });

const tree = () => [
  { id: 'g1', wbs: '1', name: 'G1', isGroup: true },
  { id: 'a', wbs: '1.1', name: 'A', isGroup: false, quantity: 10, unitPrice: 5 },
  { id: 'b', wbs: '1.2', name: 'B', isGroup: false, dependsOn: 'a', depType: 'FS', lag: 2 },
  { id: 'g2', wbs: '2', name: 'G2', isGroup: true },
  { id: 'c', wbs: '2.1', name: 'C', isGroup: false, dependsOn: 'b', depType: 'SS', lag: 0 },
];

test('loadTasks falls back to the seed tree on empty or broken storage', () => {
  assert.equal(loadTasks(memoryStorage()), INITIAL_TASKS);
  assert.equal(loadTasks(memoryStorage({ 'project-manager-gantt-tasks': '[]' })), INITIAL_TASKS);
  assert.equal(loadTasks(memoryStorage({ 'project-manager-gantt-tasks': '{oops' })), INITIAL_TASKS);
  assert.deepEqual(loadTasks(memoryStorage({ 'project-manager-gantt-tasks': '[{"id":"x"}]' })), [{ id: 'x' }]);
});

test('loadMeta merges stored meta over the defaults', () => {
  assert.deepEqual(loadMeta(memoryStorage()), { status: 'draft', baseline: null, variations: [] });
  assert.deepEqual(loadMeta(memoryStorage({ 'project-manager-project-meta': '{"status":"signed"}' })), {
    status: 'signed',
    baseline: null,
    variations: [],
  });
});

test('normalizeTaskUpdate clears type and lag when there is no dependency', () => {
  assert.deepEqual(normalizeTaskUpdate({ id: 'x', dependsOn: '', depType: 'SS', lag: 4 }), {
    id: 'x',
    dependsOn: null,
    depType: '',
    lag: 0,
  });
  assert.equal(normalizeTaskUpdate({ id: 'x', dependsOn: 'a', depType: '', lag: 3 }).depType, 'FS');
});

test('addMainTask numbers the new group after the highest section', () => {
  const out = addMainTask(tree(), { id: 'n', name: 'New' });
  assert.deepEqual(
    { wbs: out.at(-1).wbs, isGroup: out.at(-1).isGroup, name: out.at(-1).name },
    { wbs: '3', isGroup: true, name: 'New' }
  );
});

test('addSubTask inserts after the last descendant with the next WBS', () => {
  const out = addSubTask(tree(), 'g1', { id: 'n', name: 'Sub' });
  assert.deepEqual(out.map((t) => t.id), ['g1', 'a', 'b', 'n', 'g2', 'c']);
  assert.equal(out[3].wbs, '1.3');
  assert.equal(addSubTask(tree(), 'missing', { id: 'n', name: 'x' }).length, 5);
});

test('deleteTaskCascade removes descendants and clears dangling dependencies', () => {
  const out = deleteTaskCascade(tree(), 'g1');
  assert.deepEqual(out.map((t) => t.id), ['g2', 'c']);
  assert.deepEqual({ dependsOn: out[1].dependsOn, depType: out[1].depType, lag: out[1].lag }, { dependsOn: null, depType: '', lag: 0 });
  assert.deepEqual(
    { count: describeDelete(tree(), 'g1').count, deps: describeDelete(tree(), 'g1').dependencyCount },
    { count: 3, deps: 2 }
  );
  assert.equal(describeDelete(tree(), null), null);
});

test('toggleBoqLink creates a linked leaf, and unlinking keeps it with the column sum', () => {
  const parent = {
    id: 'p',
    wbs: '5',
    isGroup: true,
    manualStart: '2026-01-01',
    elementColumns: [{ id: 'area', name: 'Area', unit: 'م2' }],
    elements: [{ values: { area: 4 } }, { values: { area: '6' } }],
  };
  const linked = toggleBoqLink([parent], 'p', parent.elementColumns[0], true, { id: 'leaf', name: 'BOQ item' });
  assert.deepEqual(linked.map((t) => t.id), ['p', 'leaf']);
  assert.equal(linked[0].elementColumns[0].linkedTaskId, 'leaf');
  assert.deepEqual(
    { wbs: linked[1].wbs, unit: linked[1].unit, start: linked[1].manualStart, link: linked[1].boqLink },
    { wbs: '5.1', unit: 'م2', start: '2026-01-01', link: { parentId: 'p', colId: 'area', mode: 'created' } }
  );
  assert.equal(toggleBoqLink(linked, 'p', linked[0].elementColumns[0], true, { id: 'z', name: 'x' }), linked);

  const unlinked = toggleBoqLink(linked, 'p', linked[0].elementColumns[0], false, { id: 'z', name: 'x' });
  assert.equal(unlinked[0].elementColumns[0].linkedTaskId, null);
  assert.equal(unlinked[1].boqLink, undefined);
  assert.equal(unlinked[1].quantity, 10);
});

test('linkExistingBoq links both sides and ignores unknown leaves', () => {
  const tasks = [
    { id: 'p', wbs: '1', elementColumns: [{ id: 'c1' }] },
    { id: 'l', wbs: '1.1', quantity: 50 },
  ];
  const out = linkExistingBoq(tasks, 'p', { id: 'c1' }, 'l');
  assert.equal(out[0].elementColumns[0].linkedTaskId, 'l');
  assert.deepEqual(out[1].boqLink, { parentId: 'p', colId: 'c1', mode: 'existing' });
  assert.equal(out[1].quantity, 50);
  assert.equal(linkExistingBoq(tasks, 'p', { id: 'c1' }, 'nope'), tasks);
});

test('signOffProject freezes linked quantities, snapshots the baseline, moves draft to signed', () => {
  const tasks = [
    { id: 'a', wbs: '1', quantity: 0, unitPrice: 7, isGroup: false },
    { id: 'b', wbs: '2', quantity: 3, unitPrice: 1, isGroup: false },
  ];
  const computed = [
    { id: 'a', boqLinked: true, qty: 42 },
    { id: 'b', boqLinked: false, qty: 3 },
  ];
  const out = signOffProject(tasks, computed, { status: 'draft', baseline: null, variations: [] }, 'Eng', '2026-10-25T00:00:00Z');
  assert.equal(out.tasks[0].quantity, 42);
  assert.equal(out.meta.status, 'signed');
  assert.deepEqual(out.meta.baseline.signedBy, 'Eng');
  assert.equal(out.meta.baseline.tasks.a.quantity, 42);
  assert.equal(out.leafCount, 2);

  const again = signOffProject(out.tasks, computed, { ...out.meta, status: 'executing' }, '', 'later');
  assert.equal(again.meta.status, 'executing');
  assert.equal(again.meta.baseline.signedBy, 'Eng');
});

test('applyVariation changes the field and derives the cost impact from the quantity increase', () => {
  const tasks = [{ id: 'a', wbs: '1.1', name: 'A', quantity: 100, unitPrice: 6000 }];
  const draft = { taskId: 'a', field: 'quantity', newValue: '120', reason: 'r', approver: 'x', urgency: '', classification: '', estCostImpact: '', estScheduleDays: '', clauseRef: '' };
  const out = applyVariation(tasks, draft, { id: 'vo1', date: 'now' });
  assert.equal(out.tasks[0].quantity, 120);
  assert.deepEqual(
    { old: out.vo.oldValue, nu: out.vo.newValue, cost: out.vo.estCostImpact, cls: out.vo.classification, urgency: out.vo.urgency, days: out.vo.estScheduleDays },
    { old: 100, nu: 120, cost: 120000, cls: 'qty', urgency: 'medium', days: null }
  );
  assert.equal(applyVariation(tasks, { ...draft, taskId: 'missing' }, { id: 'x', date: 'now' }), null);
  const noisy = applyVariation([{ id: 'n', quantity: 95590.6, unitPrice: 6000 }], { ...draft, taskId: 'n', newValue: '100000' }, { id: 'y', date: 'now' });
  assert.equal(noisy.vo.estCostImpact, 26456400);
  assert.equal(applyVariation(tasks, { ...draft, field: 'unitPrice', newValue: '6500' }, { id: 'x', date: 'now' }).vo.type, 'price');
});

test('appendGeneratedTasks renumbers the generated top level past existing sections', () => {
  const out = appendGeneratedTasks(tree(), [
    { id: 'x', wbs: '1' },
    { id: 'y', wbs: '1.1' },
  ]);
  assert.deepEqual(out.tasks.slice(-2).map((t) => t.wbs), ['3', '3.1']);
  assert.equal(out.added, 2);
});

test('countPendingApprovals counts formal recorded orders only', () => {
  assert.equal(
    countPendingApprovals([
      { tier: 'formal', status: 'recorded' },
      { tier: 'formal', status: 'approved' },
      { tier: 'quick', status: 'recorded' },
      null,
    ]),
    1
  );
});
