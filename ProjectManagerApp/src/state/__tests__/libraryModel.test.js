import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FOLDER_ORDER_PHOTOS,
  FOLDER_ROOT,
  FOLDER_TASKS,
  addCalcRow,
  childFolders,
  cleanTemplateDraft,
  columnTotals,
  folderPathFor,
  formatBytes,
  removeCalcRow,
  renameCalcRow,
  setCalcCell,
  upsertCalcTemplate,
} from '../libraryModel.js';

const grid = {
  id: 'g',
  name: 'Walls',
  columns: [
    { id: 'l', name: 'Length', source: 'input' },
    { id: 'h', name: 'Height', source: 'design' },
    { id: 'a', name: 'Area', source: 'formula', formula: '=A2*B2' },
  ],
  rows: [],
};

test('BOQ grid: rows, cells recompute formulas, totals', () => {
  let t = addCalcRow(grid, { id: 'r1', name: 'Wall 1' });
  t = addCalcRow(t, { id: 'r2', name: 'Wall 2' });
  t = setCalcCell(t, 'r1', 'l', '4');
  t = setCalcCell(t, 'r1', 'h', '3');
  t = setCalcCell(t, 'r2', 'l', '2');
  t = setCalcCell(t, 'r2', 'h', '2.5');
  assert.equal(Number(t.rows[0].values.a), 12);
  assert.deepEqual(columnTotals(t), { l: 6, h: 5.5, a: 17 });
  t = renameCalcRow(t, 'r2', 'Wall B');
  assert.equal(t.rows[1].name, 'Wall B');
  assert.deepEqual(removeCalcRow(t, 'r1').rows.map((r) => r.id), ['r2']);
  assert.equal(upsertCalcTemplate([grid], { ...grid, name: 'x' })[0].name, 'x');
  assert.equal(upsertCalcTemplate([grid], { ...grid, id: 'n' }).length, 2);
});

test('template builder draft check', () => {
  assert.deepEqual(cleanTemplateDraft({ name: ' ', variables: [], elements: [{}] }), { error: 'name' });
  assert.deepEqual(cleanTemplateDraft({ name: 'X', variables: [], elements: [] }), { error: 'elements' });
  const { template } = cleanTemplateDraft({
    name: ' House ',
    icon: '',
    variables: [{ key: ' area ', label: 'Area', default: '120' }, { key: '', label: 'drop' }],
    elements: [
      { partId: 'p1', repeatsVar: 'area', depOn: null, lag: '2' },
      { partId: 'p2', repeatsVar: 'missing', depOn: '0', lag: '' },
      { partId: 'p3', depOn: 2 },
    ],
  });
  assert.equal(template.name, 'House');
  assert.equal(template.icon, '🏗️');
  assert.deepEqual(template.variables, [{ key: 'area', label: 'Area', default: 120 }]);
  assert.deepEqual(template.elements.map((e) => [e.repeatsVar, e.depOn, e.lag]), [['area', null, 2], [null, 0, 0], [null, null, 0]]);
  assert.equal(template.source, 'custom');
});

test('file folders and sizes', () => {
  const tasks = [{ id: 'a', wbs: '1' }, { id: 'b', wbs: '1.1' }, { id: 'c', wbs: '2' }];
  assert.deepEqual(childFolders(FOLDER_ROOT, tasks), [{ id: FOLDER_TASKS }, { id: FOLDER_ORDER_PHOTOS }]);
  assert.equal(FOLDER_ORDER_PHOTOS, 'order_photos'); // the folder the Record screen saves photos into
  assert.deepEqual(childFolders(FOLDER_ORDER_PHOTOS, tasks), []);
  assert.deepEqual(childFolders(FOLDER_TASKS, tasks).map((f) => f.id), ['task_a', 'task_c']);
  assert.deepEqual(childFolders('task_a', tasks), []);
  assert.deepEqual(folderPathFor(tasks[1], tasks).map((f) => f.id), ['root', 'tasks_root', 'task_a']);
  assert.deepEqual(folderPathFor(null, tasks).map((f) => f.id), ['root', 'tasks_root']);
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(1536), '1.5 KB');
});
