// Learned productivity (node:test): utils/Productivity.js and the template
// made from a project with its observed pace.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { installNodeTestEnvironment } from './helpers.js';

installNodeTestEnvironment();

const {
  peopleOf,
  paceByTask,
  paceByWorkType,
  learnedProductivity,
  acceptLearned,
  retimePatches,
  daysLeftAtPace,
  suggestedCrews,
  LEARN_MIN_DAYS,
} = await import('../Productivity.js');
const { makeTemplateFromTasks } = await import('../TemplateEngine.js');

const order = (taskId, date, quantity, extra = {}) => ({ id: `${taskId}-${date}-${quantity}`, family: 'value', status: 'approved', tier: 'quick', taskId, date, quantity, ...extra });
const wts = new Map([
  ['block', { id: 'block', productivity: 10, crew: { labour: 4 } }],
  ['plaster', { id: 'plaster', productivity: 20, crew: { labour: 4 } }],
]);

describe('pace of an item', () => {
  it('quantity per working day with approved orders; recorded or expense orders ignored', () => {
    const tasks = [{ id: 'a', workTypeId: 'block', crews: 2 }];
    const orders = [
      order('a', '2030-01-01', 30),
      order('a', '2030-01-01', 10),
      order('a', '2030-01-02', 20),
      order('a', '2030-01-03', 99, { status: 'recorded' }),
      order('a', '2030-01-04', 50, { family: 'expense' }),
    ];
    const p = paceByTask(tasks, orders, { workTypes: wts }).get('a');
    assert.deepEqual(p, { qty: 60, days: 2, crewDays: 4, perDay: 30, perCrewDay: 15, from: '2030-01-01', to: '2030-01-02', crewsFromPlans: 0 });
  });

  it('crews come from the day plan when it says how many people worked', () => {
    const tasks = [{ id: 'a', workTypeId: 'block', crews: 2 }];
    const plans = {
      days: {
        '2030-01-01': { assignments: [{ id: 'x', taskId: 'a', who: { kind: 'count', count: 4 } }] },
        '2030-01-02': { assignments: [{ id: 'y', taskId: 'a', who: { kind: 'team', teamId: 't' } }] },
      },
    };
    const registries = { teams: [{ id: 't', defaultSize: 12 }] };
    const p = paceByTask(tasks, [order('a', '2030-01-01', 10), order('a', '2030-01-02', 30)], { plans, workTypes: wts, registries }).get('a');
    assert.equal(p.crewDays, 1 + 3);
    assert.equal(p.perCrewDay, 10);
    assert.equal(p.crewsFromPlans, 2);
  });

  it('people in a Lookahead crew', () => {
    assert.equal(peopleOf({ kind: 'count', count: 6 }), 6);
    assert.equal(peopleOf({ kind: 'workers', workerIds: ['a', 'b'] }), 2);
    assert.equal(peopleOf({ kind: 'team', teamId: 't' }, { teams: [{ id: 't', memberWorkerIds: ['a', 'b', 'c'] }] }), 3);
    assert.equal(peopleOf({ kind: 'contractor', contractorId: 'c' }), 0);
    assert.equal(peopleOf(null), 0);
  });

  it('pooled per work type', () => {
    const tasks = [
      { id: 'a', workTypeId: 'block' },
      { id: 'b', workTypeId: 'block' },
      { id: 'c', workTypeId: 'plaster' },
    ];
    const paces = paceByTask(tasks, [order('a', '2030-01-01', 10), order('b', '2030-01-01', 30), order('b', '2030-01-02', 20)], { workTypes: wts });
    const pooled = paceByWorkType(paces, tasks).get('block');
    assert.equal(pooled.qty, 60);
    assert.equal(pooled.days, 3);
    assert.equal(pooled.perCrewDay, 20);
    assert.deepEqual(pooled.taskIds, ['a', 'b']);
  });
});

describe('learned productivity', () => {
  const project = (id, rates) => {
    const tasks = rates.map((_, i) => ({ id: `${id}-${i}`, workTypeId: 'block', crews: 1 }));
    const orders = rates.flatMap((rate, i) => [order(`${id}-${i}`, '2030-02-01', rate), order(`${id}-${i}`, '2030-02-02', rate)]);
    return { project: { id }, tasks, orders };
  };

  it('median per crew-day across projects; suggested past 15 % over 5 days', () => {
    const learned = learnedProductivity([project('p1', [8, 9]), project('p2', [14])], wts).get('block');
    assert.equal(learned.rate, 9);
    assert.equal(learned.days, 6);
    assert.equal(learned.samples, 3);
    assert.equal(learned.projects, 2);
    assert.equal(learned.current, 10);
    assert.ok(Math.abs(learned.change + 0.1) < 1e-9);
    assert.equal(learned.suggest, false); // 10 % off only
    const slow = learnedProductivity([project('p1', [7, 7, 8])], wts).get('block');
    assert.equal(slow.rate, 7);
    assert.equal(slow.suggest, true);
  });

  it('needs enough working days before suggesting', () => {
    const few = learnedProductivity([project('p1', [5])], wts).get('block');
    assert.ok(few.days < LEARN_MIN_DAYS);
    assert.equal(few.suggest, false);
  });

  it('accepting keeps the old value in the history', () => {
    const wt = { id: 'block', productivity: 10, history: [] };
    const next = acceptLearned(wt, { rate: 7, days: 6, samples: 3, projects: 1 }, { at: '2030-03-01T00:00:00.000Z', by: 'Ali' });
    assert.equal(next.productivity, 7);
    assert.deepEqual(next.learned, { rate: 7, days: 6, samples: 3, projects: 1, at: '2030-03-01T00:00:00.000Z' });
    assert.deepEqual(next.history, [{ at: '2030-03-01T00:00:00.000Z', by: 'Ali', field: 'productivity', from: 10, to: 7, source: 'learned', days: 6 }]);
  });
});

describe('re-timing and Lookahead helpers', () => {
  it('re-times only not-started, unpinned, productivity-timed items of the type', () => {
    const tasks = [
      { id: 'a', workTypeId: 'block', quantity: 100, crews: 1, productivity: 10, duration: 10, durationSource: 'productivity' },
      { id: 'b', workTypeId: 'block', quantity: 100, crews: 2, productivity: 10, duration: 5, durationSource: 'productivity' },
      { id: 'c', workTypeId: 'block', quantity: 100, crews: 1, productivity: 10, duration: 10, pinned: true },
      { id: 'd', workTypeId: 'block', quantity: 100, crews: 1, productivity: 10, duration: 10, durationSource: 'fixed' },
      { id: 'e', workTypeId: 'plaster', quantity: 100, crews: 1, productivity: 10, duration: 10 },
    ];
    const computed = new Map([['b', { actualQty: 5 }]]);
    assert.deepEqual(retimePatches(tasks, computed, 'block', 8), [{ id: 'a', patch: { productivity: 8, duration: 13 } }]);
  });

  it('working days left at the item\'s own pace', () => {
    assert.equal(daysLeftAtPace(100, { perDay: 30 }), 4);
    assert.equal(daysLeftAtPace(0, { perDay: 30 }), 0);
    assert.equal(daysLeftAtPace(10, null), null);
  });

  it('suggested crews: planned daily quantity over one crew\'s pace', () => {
    const task = { quantity: 400, duration: 10, productivity: 10 };
    assert.deepEqual(suggestedCrews(task, { workType: wts.get('block') }), { crews: 4, people: 16, basis: 'planned', perCrew: 10 });
    assert.deepEqual(suggestedCrews(task, { pace: { perCrewDay: 16 }, workType: wts.get('block') }), { crews: 3, people: 12, basis: 'observed', perCrew: 16 });
    assert.equal(suggestedCrews({ quantity: 10, duration: 0 }), null);
  });
});

describe('a template from a project uses what the site did', () => {
  it('observed pace per item wins over quantity ÷ duration', () => {
    const tasks = [
      { id: 'g', wbs: '1', name: 'S', isGroup: true },
      { id: 'a', wbs: '1.1', name: 'A', quantity: 100, duration: 10, unit: 'م3' },
      { id: 'b', wbs: '1.2', name: 'B', quantity: 50, duration: 5, unit: 'م3' },
    ];
    const tpl = makeTemplateFromTasks(tasks, 'X', { pace: new Map([['a', { perDay: 7.456 }]]) });
    assert.deepEqual(tpl.elements.map((e) => e.productivity), [7.46, 10]);
  });
});
