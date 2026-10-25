import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  blankProjectTasks,
  cleanProjectDraft,
  copyProjectTasks,
  newProjectMeta,
  sortProjects,
  summarizeProject,
  validateProjectDraft,
} from '../portfolioModel.js';
import { INITIAL_TASKS } from '../projectModel.js';

const memoryStorage = (data = {}) => ({ getItem: (k) => (k in data ? data[k] : null) });

describe('validateProjectDraft', () => {
  it('needs a name and a real start date', () => {
    assert.deepEqual(validateProjectDraft({ name: ' ', startDate: '2026-13-40' }), { name: 'required', startDate: 'invalid' });
    assert.deepEqual(validateProjectDraft({ name: 'X', startDate: '' }), { startDate: 'invalid' });
    assert.deepEqual(validateProjectDraft({ name: 'مدرسة', startDate: '2026-11-01' }), {});
  });

  it('cleanProjectDraft trims the text fields', () => {
    assert.deepEqual(cleanProjectDraft({ name: ' A ', contract: ' C ', startDate: '2026-11-01' }), {
      name: 'A',
      contract: 'C',
      location: '',
      startDate: '2026-11-01',
    });
  });
});

describe('new project tasks', () => {
  it('a blank project starts with one main group on its start date', () => {
    const tasks = blankProjectTasks({ id: 'g', name: 'New main group', startDate: '2026-11-01' });
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].isGroup, true);
    assert.equal(tasks[0].wbs, '1');
    assert.equal(tasks[0].manualStart, '2026-11-01');
  });

  it('a copy keeps the structure, clears execution and moves dates by the start gap', () => {
    const source = [
      { id: 'g', wbs: '1', isGroup: true, manualStart: '2025-08-02', elementColumns: [{ id: 'c1' }] },
      { id: 'a', wbs: '1.1', isGroup: false, quantity: 10, unitPrice: 5, actualQuantity: 7, orderSource: { manual: false }, manualStart: '2025-08-12' },
      { id: 'b', wbs: '1.2', isGroup: false, quantity: 3, dependsOn: 'a', depType: 'FS' },
    ];
    const copy = copyProjectTasks(source, '2025-08-02', '2026-01-01');
    assert.equal(copy[0].manualStart, '2026-01-01');
    assert.equal(copy[1].manualStart, '2026-01-11');
    assert.equal(copy[1].actualQuantity, 0);
    assert.equal(copy[1].orderSource, undefined);
    assert.equal(copy[1].quantity, 10);
    assert.equal(copy[2].dependsOn, 'a');
    assert.deepEqual(copy[0].elementColumns, [{ id: 'c1' }]);
    // the source is untouched
    assert.equal(source[1].actualQuantity, 7);
  });

  it('a new project is a draft without a baseline', () => {
    assert.deepEqual(newProjectMeta(), { status: 'draft', baseline: null, variations: [] });
  });
});

describe('summarizeProject', () => {
  it('reads a project from its own keys', () => {
    const project = { id: 'p-x', name: 'X', startDate: '2026-01-01' };
    const storage = memoryStorage({
      'pm-p:p-x:project-manager-gantt-tasks': JSON.stringify([
        { id: 'g', wbs: '1', isGroup: true },
        { id: 'a', wbs: '1.1', isGroup: false, quantity: 10, unitPrice: 100, duration: 5, manualStart: '2026-01-01' },
      ]),
      'pm-p:p-x:project-manager-project-meta': JSON.stringify({ status: 'signed' }),
      'pm-p:p-x:pm-orders': JSON.stringify({ orders: [{ id: 'o1' }] }),
    });
    const summary = summarizeProject(project, storage);
    assert.equal(summary.status, 'signed');
    assert.equal(summary.totalCost, 1000);
    assert.equal(summary.itemCount, 1);
    assert.equal(summary.orderCount, 1);
    assert.equal(summary.startDate, '2026-01-01');
  });

  it('an empty new project has zeros; the legacy project falls back to its seed tree', () => {
    const empty = summarizeProject({ id: 'p-y', name: 'Y', startDate: '2026-01-01' }, memoryStorage());
    assert.equal(empty.itemCount, 0);
    assert.equal(empty.totalCost, 0);
    assert.equal(empty.status, 'draft');
    const legacy = summarizeProject({ id: 'project-1', legacy: true, startDate: '2025-08-02' }, memoryStorage());
    assert.equal(legacy.itemCount, INITIAL_TASKS.filter((t) => !t.isGroup).length);
  });
});

it('sortProjects puts the newest first', () => {
  const sorted = sortProjects([
    { id: 'a', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'b', createdAt: '2026-05-01T00:00:00Z' },
  ]);
  assert.deepEqual(sorted.map((p) => p.id), ['b', 'a']);
});
