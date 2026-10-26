// Unit tests for src/utils/planning/autoPlan.js and the seeded building
// templates (node:test).

import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { installNodeTestEnvironment } from './helpers.js';

installNodeTestEnvironment();

const { planProject, priceWithMarkups, markupPercent, priceItems, scheduleItems, autoCrews, levelName, DEFAULT_MARKUPS } = await import('../planning/autoPlan.js');
const { buildingTemplateSeeds } = await import('../planning/buildingTemplates.js');
const { seedWorkTypes } = await import('../planning/workTypeSeeds.js');
const { DEFAULT_RATES } = await import('../RateLibrary.js');
const { GanttEngine } = await import('../GanttEngine.js');
const { readLinks } = await import('../planning/links.js');
const { listTemplates, activeTemplates, LEGACY_SEED_TEMPLATES, STORAGE_KEY: TEMPLATES_KEY } = await import('../TemplateEngine.js');

const workTypes = seedWorkTypes();
const options = { startDate: '2030-01-05', workTypes, rates: DEFAULT_RATES };
const byKey = (plan, key) => plan.items.find((i) => i.key === key);

beforeEach(() => localStorage.clear());

describe('markups and pricing', () => {
  it('price = cost × (1 + Σ%/100), whole dinars; negatives ignored', () => {
    assert.equal(markupPercent({ overhead: 10, contingency: 5, profit: 10 }), 25);
    assert.equal(priceWithMarkups(1000, { overhead: 10, contingency: 5, profit: 10 }), 1250);
    assert.equal(priceWithMarkups(333, { overhead: 10, profit: -50 }), 366);
    assert.equal(priceWithMarkups(1000, {}), 1000);
  });

  it('prices items from the rate linked to their work type; a cost override wins', () => {
    const items = [
      { key: 'a', workTypeId: 'rc-slab', qty: 10 },
      { key: 'b', workTypeId: 'paint', qty: 10 },
      { key: 'c', workTypeId: 'nope', qty: 1 },
    ];
    const priced = priceItems(items, { workTypes, rates: DEFAULT_RATES, markups: { profit: 10 }, costOverrides: { b: 5000 } });
    assert.equal(priced[0].unitCost, 430000);
    assert.equal(priced[0].unitPrice, 473000);
    assert.equal(priced[0].unit, 'م3');
    assert.equal(priced[1].unitCost, 5000);
    assert.equal(priced[2].priced, false);
  });
});

describe('durations and crews', () => {
  it('auto crews size a task toward the target days (1–6); a per-trade crew count overrides', () => {
    assert.equal(autoCrews(600, 30, 20), 1);
    assert.equal(autoCrews(1300, 30, 20), 3);
    assert.equal(autoCrews(1e6, 1, 20), 6);
    const items = [{ key: 'p@G', workTypeId: 'plaster-internal', qty: 2000, levelIndex: 0 }];
    assert.equal(scheduleItems(items, { workTypes })[0].crews, 3); // 2000 / (40 × 20)
    assert.equal(scheduleItems(items, { workTypes })[0].duration, 17);
    const fixed = scheduleItems(items, { workTypes, crews: { plaster: 1 } })[0];
    assert.equal(fixed.crews, 1);
    assert.equal(fixed.duration, 50);
    const custom = scheduleItems(items, { workTypes, crews: { plaster: 1 }, productivity: { 'plaster-internal': 100 } })[0];
    assert.equal(custom.duration, 20);
  });

  it('fixed-duration work types ignore the quantity; unknown productivity gives 1 day and a flag', () => {
    const [mob, odd] = scheduleItems(
      [
        { key: 'mob', workTypeId: 'mobilization', qty: 1, levelIndex: null },
        { key: 'x', workTypeId: 'nope', qty: 5, levelIndex: null },
      ],
      { workTypes }
    );
    assert.equal(mob.duration, 10);
    assert.equal(mob.durationSource, 'fixed');
    assert.equal(odd.duration, 1);
    assert.equal(odd.noProductivity, true);
  });
});

describe('planProject', () => {
  const apartments = () => buildingTemplateSeeds().find((t) => t.type === 'apartments');

  it('builds the WBS: sections, one group per level, names in the chosen language', () => {
    const ar = planProject(apartments(), { floors: 3 }, options);
    const groups = ar.tasks.filter((t) => t.isGroup).map((t) => `${t.wbs} ${t.name}`);
    assert.deepEqual(groups, [
      '1 الأعمال التحضيرية',
      '2 الأعمال تحت الأرض والأساسات',
      '3 الطابق الأرضي',
      '4 الطابق الأول',
      '5 الطابق الثاني',
      '6 أعمال السطح',
      '7 الواجهات والأعمال الخارجية',
      '8 الأنظمة والتسليم',
    ]);
    assert.ok(ar.tasks.some((t) => t.name === 'سقف وجسور خرسانية مسلحة - الطابق الأول'));
    const en = planProject(apartments(), { floors: 3 }, { ...options, lang: 'en' });
    assert.ok(en.tasks.some((t) => t.name === 'RC slab & beams - First floor'));
    assert.ok(en.tasks.some((t) => t.isGroup && t.name === 'Roof works'));
  });

  it('copies prices, records cost / work type / trade / level on every leaf, and links by task id', () => {
    const plan = planProject(apartments(), { floors: 3 }, { ...options, markups: { overhead: 10, contingency: 0, profit: 10 } });
    const leaves = plan.tasks.filter((t) => !t.isGroup);
    const ids = new Set(plan.tasks.map((t) => t.id));
    leaves.forEach((t) => {
      assert.ok(t.workTypeId && t.trade, t.name);
      assert.equal(t.unitPrice, Math.round(t.unitCost * 1.2), t.name);
      readLinks(t).forEach((l) => assert.ok(ids.has(l.id), `${t.name} → ${l.id}`));
    });
    const cols1 = plan.tasks.find((t) => t.templateKey === 'cols' && t.floor === 1);
    const slabG = plan.tasks.find((t) => t.templateKey === 'slab' && t.floor === 0);
    assert.deepEqual(readLinks(cols1), [{ id: slabG.id, type: 'FS', lag: 7, lagUnit: 'cd' }]);
    assert.equal(plan.tasks.find((t) => t.templateKey === 'mob').manualStart, '2030-01-05'); // no links → start date
    assert.deepEqual(plan.planning.markups, { overhead: 10, contingency: 0, profit: 10 });
  });

  it('applies quantity overrides, dropped items and switched-off links', () => {
    const base = planProject(apartments(), { floors: 2 }, options);
    const slabKey = 'slab@G';
    const plan = planProject(apartments(), { floors: 2 }, {
      ...options,
      qtyOverrides: { [slabKey]: 99 },
      dropped: new Set(['hordi@G', 'landscape']),
      disabledLinks: new Set(['cols@1>slab@G']),
    });
    assert.equal(byKey(plan, slabKey).qty, 99);
    assert.ok(!plan.tasks.some((t) => t.templateKey === 'landscape'));
    assert.ok(base.tasks.some((t) => t.templateKey === 'landscape'));
    const cols1 = plan.tasks.find((t) => t.templateKey === 'cols' && t.floor === 1);
    assert.deepEqual(readLinks(cols1), []);
  });

  it('levelName covers basement, ground, ordinals and higher floors', () => {
    assert.equal(levelName({ kind: 'basement' }, 'en'), 'Basement');
    assert.equal(levelName({ kind: 'upper', ordinal: 3 }, 'ar'), 'الطابق الثالث');
    assert.equal(levelName({ kind: 'upper', ordinal: 14 }, 'en'), 'Floor 14');
  });

  it('every seeded building template plans cleanly at several sizes (no issues, cycles or loose links)', () => {
    buildingTemplateSeeds().forEach((tpl) => {
      const maxFloors = tpl.variables.find((v) => v.key === 'floors').max;
      [1, 2, Math.min(5, maxFloors)].forEach((floors) => {
        [0, 1].forEach((basement) => {
          [1, 2, 3].forEach((finish) => {
            const values = { floors, basement, finish, slab: finish, hvac: finish - 1 };
            const plan = planProject(tpl, values, options);
            const label = `${tpl.type} floors ${floors} basement ${basement} finish ${finish}`;
            assert.deepEqual(plan.issues, [], label);
            assert.equal(plan.stats.unpriced.length, 0, label);
            assert.equal(plan.stats.noProductivity.length, 0, label);
            const result = GanttEngine.calculate(plan.tasks, options.startDate, { planning: { calendar: { weekRest: [5] } } });
            assert.deepEqual(result.warnings, [], label);
            const loose = plan.tasks.filter((t) => !t.isGroup && !readLinks(t).length).map((t) => t.templateKey);
            assert.deepEqual(loose, ['mob'], label);
            assert.ok(result.projectDuration > 30 && result.projectDuration < 1200, `${label}: ${result.projectDuration} days`);
          });
        });
      });
    });
  });

  it('defaults: markups 10/5/10 and the planning block for the project meta', () => {
    const plan = planProject(apartments(), {}, { ...options, markups: undefined });
    assert.deepEqual(plan.planning.markups, DEFAULT_MARKUPS);
    assert.equal(plan.planning.version, 1);
  });
});

describe('template store upgrade (seed version 2)', () => {
  it('a fresh store holds the nine building templates', () => {
    const list = listTemplates();
    assert.equal(list.length, 9);
    assert.ok(list.every((t) => t.schema === 2 && t.source === 'seed'));
  });

  it('a version-1 store keeps its templates, archives the old seeds and adds the building templates', () => {
    const legacy = LEGACY_SEED_TEMPLATES.map((f) => f());
    const custom = { id: 'mine', name: 'قالبي', variables: [], elements: [], source: 'custom' };
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify({ templates: [...legacy, custom] }));
    const list = listTemplates();
    assert.equal(list.length, legacy.length + 1 + 9);
    assert.ok(list.filter((t) => !t.schema && t.source === 'seed').every((t) => t.archived));
    const active = activeTemplates(list);
    assert.ok(active.some((t) => t.id === 'mine'));
    assert.equal(active.length, 10);
    assert.equal(listTemplates().length, list.length); // upgraded once
  });
});
