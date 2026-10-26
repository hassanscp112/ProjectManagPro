// Resources and leveling (node:test): utils/planning/resources.js,
// utils/planning/ResourceLeveler.js and the engine's overload flags.
// 2030-01-01 is a Tuesday.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { installNodeTestEnvironment, makeTask } from './helpers.js';

installNodeTestEnvironment();

const { GanttEngine } = await import('../GanttEngine.js');
const { capacitiesOf, demandOf, taskResources, resourceHistogram } = await import('../planning/resources.js');
const { levelResources, clearLeveling, fixedTaskIds } = await import('../planning/ResourceLeveler.js');
const { writeLinks, readLevelLinks } = await import('../planning/links.js');
const { getCalendar } = await import('../planning/WorkCalendar.js');
const { planProject } = await import('../planning/autoPlan.js');
const { buildingTemplateSeeds } = await import('../planning/buildingTemplates.js');
const { seedWorkTypes } = await import('../planning/workTypeSeeds.js');
const { DEFAULT_RATES } = await import('../RateLibrary.js');

const start = '2030-01-01';
const meta = (resources, calendar) => ({ planning: { resources, ...(calendar ? { calendar } : {}) } });
const leaf = (id, wbs, extra = {}) => makeTask({ id, wbs, manualStart: start, duration: 10, trade: 'masonry', crews: 1, ...extra });
const floors = (n, extra = {}) => [
  makeTask({ id: 'g', wbs: '1', isGroup: true, duration: 1 }),
  ...Array.from({ length: n }, (_, i) => leaf(`f${i + 1}`, `1.${i + 1}`, extra)),
];
const apply = (tasks, patches) => {
  const byId = new Map(patches.map((p) => [p.id, p.patch]));
  return tasks.map((t) => (byId.has(t.id) ? { ...t, ...byId.get(t.id) } : t));
};
const startOf = (result, id) => result.tasks.find((t) => t.id === id).startDate;
const json = (x) => JSON.parse(JSON.stringify(x));

describe('resources', () => {
  it('reads the limits: crew counts, teams as crews, labour and equipment', () => {
    const caps = capacitiesOf({ crews: { masonry: 2, tiling: 0 }, teams: { painting: ['a', 'b', 'c'], masonry: ['x'] }, labour: 30, equipment: { crane: 1, pump: 0 } });
    assert.deepEqual([...caps].sort(), [['crew:masonry', 2], ['crew:painting', 3], ['eq:crane', 1], ['labour', 30]]);
    assert.equal(capacitiesOf(null).size, 0);
  });

  it('a task uses its crews, its people and its equipment', () => {
    const wt = { crew: { labour: 4, equipment: { crane: 1 } } };
    assert.deepEqual(taskResources(wt, 3), { labour: 12, crane: 3 });
    assert.equal(taskResources({ crew: { labour: 0, equipment: {} } }, 2), null);
    const d = demandOf({ trade: 'steel', crews: 3, resources: { labour: 12, crane: 3 } });
    assert.deepEqual([...d], [['crew:steel', 3], ['labour', 12], ['eq:crane', 3]]);
    assert.equal(demandOf({ isGroup: true, trade: 'steel' }).size, 0);
  });
});

describe('the engine flags overloads (never levels)', () => {
  it('two floors at once with one masonry crew → resourceOverload on both', () => {
    const r = GanttEngine.calculate(floors(2), start, meta({ crews: { masonry: 1 } }));
    assert.equal(r.overloads.length, 1);
    assert.deepEqual(r.overloads[0], { resource: 'crew:masonry', from: '2030-01-01', to: '2030-01-11', demand: 2, capacity: 1, taskIds: ['f1', 'f2'] });
    assert.deepEqual(r.warnings.filter((w) => w.code === 'resourceOverload').map((w) => w.taskId), ['f1', 'f2']);
    assert.equal(startOf(r, 'f2'), '2030-01-01');
  });

  it('no limits, no flags; timing on the working-time axis', () => {
    const r = GanttEngine.calculate(floors(2), start, {});
    assert.deepEqual(r.overloads, []);
    assert.equal(r.timing.EF.get('f1') - r.timing.ES.get('f1'), 1000);
  });

  it('a hand-over (FS 0) at the exact finish is not an overload', () => {
    const tasks = floors(2);
    tasks[2] = { ...tasks[2], levelLinks: [{ id: 'f1', type: 'FS', lag: 0 }] };
    const r = GanttEngine.calculate(tasks, start, meta({ crews: { masonry: 1 } }));
    assert.deepEqual(r.overloads, []);
    assert.equal(startOf(r, 'f2'), '2030-01-11');
  });
});

describe('levelResources', () => {
  it('one crew runs the floors one after another', () => {
    const tasks = floors(3);
    const { patches, after, report } = levelResources(tasks, { projectStart: start, meta: meta({ crews: { masonry: 1 } }) });
    assert.deepEqual(['f1', 'f2', 'f3'].map((id) => startOf(after, id)), ['2030-01-01', '2030-01-11', '2030-01-21']);
    assert.deepEqual(patches, [
      { id: 'f2', patch: { levelLinks: [{ id: 'f1', type: 'FS', lag: 0 }] } },
      { id: 'f3', patch: { levelLinks: [{ id: 'f2', type: 'FS', lag: 0 }] } },
    ]);
    assert.equal(report.endBefore, '2030-01-11');
    assert.equal(report.endAfter, '2030-01-31');
    assert.deepEqual(report.moved.map((m) => [m.id, m.days, m.waitsFor]), [['f3', 20, ['f2']], ['f2', 10, ['f1']]]);
    assert.deepEqual(after.overloads, []);
    assert.equal(report.mismatch, 0);
  });

  it('two crews run two floors side by side', () => {
    const { after, report } = levelResources(floors(4), { projectStart: start, meta: meta({ crews: { masonry: 2 } }) });
    assert.deepEqual(['f1', 'f2', 'f3', 'f4'].map((id) => startOf(after, id)), ['2030-01-01', '2030-01-01', '2030-01-11', '2030-01-11']);
    assert.equal(report.linkCount, 2);
    assert.equal(report.mismatch, 0);
  });

  it('keeps the logic: links first, then the crew', () => {
    // f2 must follow f1 (logic); f3 is free but shares the crew.
    const tasks = floors(3);
    tasks[2] = writeLinks(tasks[2], [{ id: 'f1', type: 'FS', lag: 2 }]);
    const { after, report } = levelResources(tasks, { projectStart: start, meta: meta({ crews: { masonry: 1 } }) });
    const starts = ['f1', 'f2', 'f3'].map((id) => startOf(after, id));
    assert.equal(starts[0], '2030-01-01');
    assert.ok(starts[1] >= '2030-01-13', starts[1]);
    assert.deepEqual(after.overloads, []);
    assert.equal(report.mismatch, 0);
  });

  it('labour on site and equipment are limits too', () => {
    const tasks = [
      leaf('a', '1.1', { trade: 'concrete', resources: { labour: 10 } }),
      leaf('b', '1.2', { trade: 'plumbing', resources: { labour: 4, crane: 1 } }),
      leaf('c', '1.3', { trade: 'steel', resources: { labour: 2, crane: 1 } }),
    ];
    const { after } = levelResources(tasks, { projectStart: start, meta: meta({ labour: 12, equipment: { crane: 1 } }) });
    // a (10) + b (4) > 12 → b waits; b and c share the crane.
    assert.deepEqual(['a', 'b', 'c'].map((id) => startOf(after, id)), ['2030-01-01', '2030-01-11', '2030-01-01']);
    assert.deepEqual(after.overloads, []);
  });

  it('never moves pinned or started work, nor what it waits for', () => {
    const tasks = floors(3);
    tasks[3] = { ...tasks[3], pinned: true };
    const orders = [{ id: 'o1', type: 'quick_work', family: 'value', tier: 'quick', status: 'approved', taskId: 'f2', quantity: 2, date: start }];
    const ctx = { projectStart: start, meta: meta({ crews: { masonry: 1 } }), orders };
    const fixed = fixedTaskIds(tasks, GanttEngine.calculate(tasks, start, ctx.meta, orders).tasks);
    assert.deepEqual([...fixed].sort(), ['f2', 'f3']);
    const { patches, after, report } = levelResources(tasks, ctx);
    assert.equal(startOf(after, 'f2'), '2030-01-01');
    assert.equal(startOf(after, 'f3'), '2030-01-01');
    assert.equal(startOf(after, 'f1'), '2030-01-11');
    assert.deepEqual(patches.map((p) => p.id), ['f1']);
    // The fixed work itself still overlaps — reported, not hidden.
    assert.equal(report.remaining.length, 1);
    assert.deepEqual(report.remaining[0].taskIds.sort(), ['f2', 'f3']);
  });

  it('fits crews to the pool and stretches productivity-driven durations', () => {
    const tasks = [leaf('a', '1.1', { quantity: 300, productivity: 10, crews: 3, durationSource: 'productivity', resources: { labour: 12 } })];
    tasks[0].duration = 10;
    const { patches, report } = levelResources(tasks, { projectStart: start, meta: meta({ crews: { masonry: 2 } }) });
    assert.deepEqual(patches, [{ id: 'a', patch: { crews: 2, duration: 15, resources: { labour: 8 } } }]);
    assert.deepEqual(report.crewChanges, [{ id: 'a', crews: [3, 2], duration: [10, 15] }]);
  });

  it('reports work too big for the site even alone', () => {
    const tasks = [leaf('a', '1.1', { resources: { labour: 20 } })];
    const { report } = levelResources(tasks, { projectStart: start, meta: meta({ labour: 12 }) });
    assert.deepEqual(report.conflicts, [{ code: 'tooBig', id: 'a', resource: 'labour', demand: 20, capacity: 12 }]);
  });

  it('gives People teams to the tasks, the team it waits for first', () => {
    const { after, tasks } = levelResources(floors(3), { projectStart: start, meta: meta({ teams: { masonry: ['tA', 'tB'] } }) });
    const teams = Object.fromEntries(tasks.filter((t) => !t.isGroup).map((t) => [t.id, t.teamIds]));
    assert.deepEqual(teams.f1, ['tA']);
    assert.deepEqual(teams.f2, ['tB']);
    const third = tasks.find((t) => t.id === 'f3');
    const waited = readLevelLinks(third)[0].id;
    assert.deepEqual(third.teamIds, teams[waited]);
    assert.equal(startOf(after, 'f3'), '2030-01-11');
  });

  it('is deterministic and stable: leveling a leveled plan changes nothing', () => {
    const ctx = { projectStart: start, meta: meta({ crews: { masonry: 2 }, labour: 6 }, { weekRest: [5] }) };
    const tasks = floors(5, { resources: { labour: 3 } });
    const one = levelResources(tasks, ctx);
    const two = levelResources(tasks, ctx);
    assert.deepEqual(json(one.patches), json(two.patches));
    const again = levelResources(one.tasks, ctx);
    assert.deepEqual(again.patches, []);
    assert.equal(one.report.mismatch, 0);
  });

  it('Clear takes the leveling out exactly', () => {
    const ctx = { projectStart: start, meta: meta({ teams: { masonry: ['tA'] } }) };
    const tasks = floors(3);
    const leveled = apply(tasks, levelResources(tasks, ctx).patches);
    assert.ok(leveled.some((t) => readLevelLinks(t).length));
    const cleared = apply(leveled, clearLeveling(leveled, ctx).patches);
    assert.deepEqual(json(cleared), json(tasks));
    assert.equal(clearLeveling(cleared, ctx).count, 0);
  });

  it('does nothing without limits, or with a logic cycle', () => {
    assert.equal(levelResources(floors(2), { projectStart: start, meta: {} }).report.blocked, 'noLimits');
    const tasks = floors(2);
    tasks[1] = writeLinks(tasks[1], [{ id: 'f2', type: 'FS', lag: 0 }]);
    tasks[2] = writeLinks(tasks[2], [{ id: 'f1', type: 'FS', lag: 0 }]);
    const r = levelResources(tasks, { projectStart: start, meta: meta({ crews: { masonry: 1 } }) });
    assert.equal(r.report.blocked, 'cycle');
    assert.deepEqual(r.patches, []);
  });

  it('levels a generated apartment block on a Friday-off calendar', () => {
    const tpl = buildingTemplateSeeds().find((t) => t.type === 'apartments');
    const plan = planProject(tpl, { floors: 4 }, { startDate: '2030-01-05', workTypes: seedWorkTypes(), rates: DEFAULT_RATES });
    const resources = { crews: { masonry: 1, plaster: 1, tiling: 1, concrete: 1 }, labour: 40 };
    const ctx = { projectStart: '2030-01-05', meta: meta(resources, { weekRest: [5] }) };
    const before = GanttEngine.calculate(plan.tasks, ctx.projectStart, ctx.meta);
    assert.ok(before.overloads.length > 0);
    const { after, report } = levelResources(plan.tasks, ctx);
    assert.equal(report.blocked, null);
    assert.equal(report.mismatch, 0);
    assert.deepEqual(after.overloads, []);
    assert.ok(report.endAfter >= report.endBefore);
    assert.ok(!after.warnings.some((w) => w.code === 'dependencyCycle'));
  });
});

describe('resourceHistogram', () => {
  it('peak use per week against capacity', () => {
    const r = GanttEngine.calculate(floors(2), start, meta({ crews: { masonry: 1 } }));
    const leaves = r.tasks;
    const caps = capacitiesOf({ crews: { masonry: 1 } });
    const h = resourceHistogram(leaves, r.timing, caps, getCalendar(null), '2030-01-01', '2030-01-20');
    const masonry = h.find((x) => x.resource === 'crew:masonry');
    assert.equal(masonry.capacity, 1);
    assert.deepEqual(masonry.weeks.map((w) => w.peak), [2, 2, 0]);
  });
});

describe('random networks', () => {
  // mulberry32
  const rng = (seed) => () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const pick = (r, list) => list[Math.floor(r() * list.length)];
  const trades = ['masonry', 'plaster', 'tiling'];

  const network = (seed) => {
    const r = rng(seed);
    const tasks = [makeTask({ id: 'g1', wbs: '1', isGroup: true, duration: int(r, 0, 3) })];
    const n = int(r, 3, 25);
    for (let i = 1; i <= n; i++) {
      let t = makeTask({
        id: `t${i}`,
        wbs: `1.${i}`,
        duration: r() < 0.1 ? 0 : int(r, 1, 12),
        manualStart: r() < 0.5 ? `2030-01-${String(int(r, 1, 20)).padStart(2, '0')}` : null,
        trade: pick(r, trades),
        crews: int(r, 1, 3),
        resources: { labour: int(r, 1, 4) },
      });
      const links = [];
      const count = r() < 0.4 ? 0 : int(r, 1, 3);
      for (let k = 0; k < count; k++) {
        const to = r() < 0.1 ? 'g1' : `t${int(r, 1, Math.max(1, i - 1))}`;
        if (to === t.id) continue;
        links.push({ id: to, type: pick(r, ['FS', 'FS', 'SS', 'FF', 'SF']), lag: int(r, -3, 5), ...(r() < 0.15 ? { lagUnit: 'cd' } : {}) });
      }
      if (links.length) t = writeLinks(t, links);
      tasks.push(t);
    }
    const resources = { crews: Object.fromEntries(trades.map((tr) => [tr, int(r, 1, 3)])), labour: r() < 0.5 ? int(r, 4, 10) : null };
    const calendar = r() < 0.5 ? { weekRest: [5], periods: [{ from: '2030-01-10', to: '2030-01-25', factor: 0.75 }] } : null;
    return { tasks, ctx: { projectStart: start, meta: meta(resources, calendar) } };
  };

  it('the engine reproduces every leveled schedule, within every limit', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const { tasks, ctx } = network(seed);
      const { after, report } = levelResources(tasks, ctx);
      if (report.blocked) continue;
      assert.equal(report.mismatch, 0, `seed ${seed}: leveled starts reproduced`);
      assert.deepEqual(after.overloads, [], `seed ${seed}: no overloads left`);
      assert.deepEqual(levelResources(apply(tasks, levelResources(tasks, ctx).patches), ctx).patches, [], `seed ${seed}: stable`);
    }
  });
});
