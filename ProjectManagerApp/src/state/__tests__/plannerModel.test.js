import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installNodeTestEnvironment } from '../../utils/__tests__/helpers.js';

installNodeTestEnvironment();

const {
  createPlanner,
  plannerReducer,
  stepsFor,
  planOptions,
  stepErrors,
  addHoliday,
  removeHoliday,
  addPeriod,
  removePeriod,
  toggleRestDay,
  groupItems,
  workTypesUsed,
  tradesUsed,
  reviewWarnings,
  WIZARD_STEPS,
} = await import('../plannerModel.js');
const { planProject } = await import('../../utils/planning/autoPlan.js');
const { buildingTemplateSeeds } = await import('../../utils/planning/buildingTemplates.js');
const { seedWorkTypes } = await import('../../utils/planning/workTypeSeeds.js');
const { DEFAULT_RATES } = await import('../../utils/RateLibrary.js');

const reduce = (state, ...actions) => actions.reduce(plannerReducer, state);
const apartments = buildingTemplateSeeds().find((t) => t.type === 'apartments');

test('steps: the full wizard for building templates, short paths otherwise', () => {
  const s = createPlanner({ startDate: '2030-01-01' });
  assert.deepEqual(stepsFor(s, apartments), WIZARD_STEPS);
  assert.deepEqual(stepsFor(s, { name: 'old', elements: [] }), ['details', 'start', 'building', 'review']);
  assert.deepEqual(stepsFor({ ...s, kind: 'copy' }, null), ['details', 'start', 'review']);
});

test('the calendar follows the start date until it is edited by hand', () => {
  let s = createPlanner({ startDate: '2030-01-01' });
  assert.deepEqual(s.calendar.weekRest, [5]);
  assert.ok(s.calendar.holidays.some((h) => h.from === '2030-07-14'));
  s = reduce(s, { type: 'details', patch: { startDate: '2034-03-01' } });
  assert.ok(s.calendar.holidays.some((h) => h.from === '2034-07-14'));
  const before = s.calendar.holidays;
  s = reduce(s, { type: 'calendar', patch: toggleRestDay(s.calendar, 6) }, { type: 'details', patch: { startDate: '2040-03-01' } });
  assert.equal(s.calendarPreset, 'custom');
  assert.deepEqual(s.calendar.weekRest, [5, 6]);
  assert.equal(s.calendar.holidays, before); // edited by hand: not regenerated
  s = reduce(s, { type: 'calendarPreset', preset: 'allDays' });
  assert.deepEqual(s.calendar.weekRest, []);
});

test('picking a template resets the corrections; the basement resets level changes', () => {
  let s = reduce(
    createPlanner({ startDate: '2030-01-01' }),
    { type: 'template', templateId: 't1', values: { floors: 3 } },
    { type: 'qty', key: 'slab@G', value: '50' },
    { type: 'drop', key: 'landscape' },
    { type: 'level', index: 1, patch: { area: '300', use: '' } }
  );
  assert.deepEqual(s.qtyOverrides, { 'slab@G': '50' });
  assert.deepEqual(s.levelOverrides[1], { area: '300' });
  s = reduce(s, { type: 'value', key: 'floors', value: 4 });
  assert.deepEqual(s.levelOverrides[1], { area: '300' });
  s = reduce(s, { type: 'value', key: 'basement', value: 1 });
  assert.deepEqual(s.levelOverrides, []);
  s = reduce(s, { type: 'template', templateId: 't2', values: {} });
  assert.deepEqual([s.qtyOverrides, s.dropped], [{}, []]);
  assert.equal(s.touched, true);
});

test('blank inputs remove an override; toggles add and remove', () => {
  let s = reduce(createPlanner({ startDate: '2030-01-01' }), { type: 'qty', key: 'a', value: '5' }, { type: 'qty', key: 'a', value: '' });
  assert.deepEqual(s.qtyOverrides, {});
  s = reduce(s, { type: 'link', from: 'a', to: 'b' }, { type: 'link', from: 'c', to: 'd' }, { type: 'link', from: 'a', to: 'b' });
  assert.deepEqual(s.disabledLinks, ['c>d']);
  s = reduce(s, { type: 'crews', trade: 'masonry', value: '2' }, { type: 'crews', trade: 'masonry', value: '' });
  assert.deepEqual(s.crews, {});
  s = reduce(s, { type: 'level', index: 0, patch: { area: '200' } }, { type: 'level', index: 0, patch: { area: '' } });
  assert.equal(s.levelOverrides[0], null);
});

test('planOptions turns text inputs into numbers and lists into sets', () => {
  const s = reduce(
    createPlanner({ startDate: '2030-01-01' }),
    { type: 'markup', key: 'profit', value: '12' },
    { type: 'markup', key: 'overhead', value: '' },
    { type: 'cost', key: 'x', value: 'abc' },
    { type: 'drop', key: 'y' }
  );
  const o = planOptions(s, { workTypes: [], rates: [], lang: 'en' });
  assert.deepEqual(o.markups, { contingency: 5, profit: 12 });
  assert.deepEqual(o.costOverrides, {});
  assert.ok(o.dropped.has('y'));
  assert.equal(o.startDate, '2030-01-01');
});

test('stepErrors: details need a name and a valid date; start needs a template or a source', () => {
  const s = createPlanner({ startDate: '2030-01-01' });
  assert.deepEqual(stepErrors(s, 'details'), { name: 'required' });
  assert.deepEqual(stepErrors(s, 'start'), { start: 'template' });
  assert.deepEqual(stepErrors({ ...s, kind: 'copy' }, 'start'), { start: 'copy' });
  assert.deepEqual(stepErrors(s, 'start', apartments), {});
});

test('holidays and reduced-pace periods', () => {
  const cal = { weekRest: [5], holidays: [{ from: '2030-03-21', to: '2030-03-21', name: 'نوروز' }], periods: [] };
  assert.equal(addHoliday(cal, { from: 'bad' }), null);
  const added = addHoliday(cal, { from: '2030-02-01', to: '2030-01-01', name: ' عيد ' }).holidays;
  assert.deepEqual(added[0], { from: '2030-02-01', to: '2030-02-01', name: 'عيد' });
  assert.equal(removeHoliday({ holidays: added }, 0).holidays.length, 1);
  assert.equal(addPeriod(cal, { from: '2030-02-01', to: '2030-01-01', factor: 0.75 }), null);
  assert.equal(addPeriod(cal, { from: '2030-01-05', to: '2030-02-03', factor: 1.5 }), null);
  const p = addPeriod(cal, { from: '2030-01-05', to: '2030-02-03', factor: '0.754', name: 'رمضان' }).periods;
  assert.deepEqual(p, [{ from: '2030-01-05', to: '2030-02-03', factor: 0.75, name: 'رمضان' }]);
  assert.deepEqual(removePeriod({ periods: p }, 0).periods, []);
});

test('summaries over a generated plan: groups, work types, trades, review warnings', () => {
  const plan = planProject(apartments, { floors: 2 }, { startDate: '2030-01-05', workTypes: seedWorkTypes(), rates: DEFAULT_RATES, costOverrides: {} });
  const groups = groupItems(plan, (k) => k, (l) => l.key);
  assert.deepEqual(groups.slice(0, 4).map((g) => g.label), ['prelim', 'sub', 'G', '1']);
  assert.equal(groups.reduce((n, g) => n + g.items.length, 0), plan.items.length);
  const types = workTypesUsed(plan, ['landscape']);
  assert.ok(!types.some((w) => w.workTypeId === 'landscaping'));
  const slab = types.find((w) => w.workTypeId === 'rc-slab');
  assert.equal(slab.count, 2);
  assert.ok(tradesUsed(plan).some((t) => t.trade === 'concrete'));
  assert.deepEqual(reviewWarnings(plan, { warnings: [], calendarIssues: [] }), []);

  const unpriced = planProject(apartments, { floors: 2 }, { startDate: '2030-01-05', workTypes: seedWorkTypes(), rates: [] });
  const codes = reviewWarnings(unpriced, { warnings: [{ wbs: '1.1', name: 'x' }], calendarIssues: [] }).map((w) => w.code);
  assert.deepEqual(codes, ['unpriced', 'engine']);
});
