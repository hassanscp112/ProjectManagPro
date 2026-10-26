import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installNodeTestEnvironment } from '../../utils/__tests__/helpers.js';

installNodeTestEnvironment();

const {
  resourceUsage,
  cleanResources,
  setCrewLimit,
  setEquipmentLimit,
  setLabourLimit,
  toggleTeam,
  resourceLabel,
  histogramSummary,
  bucketDaysFor,
  waitsForOf,
  teamNamesOf,
  calendarPresetOf,
  fillResourcesPatches,
} = await import('../resourcesModel.js');

const t = (key, params = {}) => `${key}${Object.keys(params).length ? JSON.stringify(params) : ''}`;

test('resourceUsage counts items, crews and people per trade and equipment per type', () => {
  const usage = resourceUsage([
    { id: 'g', isGroup: true, trade: 'masonry' },
    { id: 'a', trade: 'masonry', crews: 2, resources: { labour: 8 } },
    { id: 'b', trade: 'masonry', crews: '3', resources: { labour: 12, crane: 1 } },
    { id: 'c', trade: 'concrete', resources: { labour: 10, pump: 2 } },
    { id: 'd' },
  ]);
  assert.deepEqual(usage.trades, [
    { trade: 'concrete', count: 1, maxCrews: 1, maxLabour: 10 },
    { trade: 'masonry', count: 2, maxCrews: 3, maxLabour: 12 },
  ]);
  assert.deepEqual(usage.equipment, [
    { type: 'crane', count: 1, max: 1 },
    { type: 'pump', count: 1, max: 2 },
  ]);
  assert.equal(usage.untraded, 1);
});

test('limits are whole positive numbers; blank or 0 removes the limit', () => {
  let r = setCrewLimit({}, 'masonry', '2');
  assert.deepEqual(r, { crews: { masonry: 2 } });
  r = setCrewLimit(r, 'tiling', '1.7');
  assert.deepEqual(r.crews, { masonry: 2, tiling: 1 });
  r = setCrewLimit(r, 'masonry', '');
  r = setCrewLimit(r, 'tiling', '0');
  assert.deepEqual(r, {});
  r = setLabourLimit(setEquipmentLimit({}, 'crane', 1), '40');
  assert.deepEqual(r, { labour: 40, equipment: { crane: 1 } });
  assert.deepEqual(setLabourLimit(r, ''), { equipment: { crane: 1 } });
  assert.deepEqual(cleanResources({ crews: { a: -1 }, teams: { b: [] }, labour: 'x' }), {});
});

test('a People team belongs to one trade at a time', () => {
  let r = toggleTeam({}, 'masonry', 't1');
  r = toggleTeam(r, 'masonry', 't2');
  assert.deepEqual(r.teams, { masonry: ['t1', 't2'] });
  r = toggleTeam(r, 'plaster', 't1');
  assert.deepEqual(r.teams, { masonry: ['t2'], plaster: ['t1'] });
  r = toggleTeam(r, 'masonry', 't2');
  assert.deepEqual(r, { teams: { plaster: ['t1'] } });
});

test('resource labels', () => {
  assert.equal(resourceLabel(t, 'labour'), 'schedule.res.labour');
  assert.equal(resourceLabel(t, 'crew:masonry'), 'schedule.res.crewOf{"trade":"planning.trade.masonry"}');
  assert.equal(resourceLabel(t, 'eq:crane'), 'schedule.eq.crane');
  assert.equal(resourceLabel(t, 'eq:tower-x'), 'tower-x');
});

test('histogramSummary puts the most overloaded resource first', () => {
  const summary = histogramSummary([
    { resource: 'labour', capacity: null, weeks: [{ peak: 30 }] },
    { resource: 'crew:masonry', capacity: 1, weeks: [{ peak: 1 }, { peak: 2 }] },
    { resource: 'crew:tiling', capacity: 2, weeks: [{ peak: 3 }, { peak: 3 }, { peak: 1 }] },
  ]);
  assert.deepEqual(summary, [
    { resource: 'crew:tiling', capacity: 2, peak: 3, over: 2 },
    { resource: 'crew:masonry', capacity: 1, peak: 2, over: 1 },
    { resource: 'labour', capacity: null, peak: 30, over: 0 },
  ]);
});

test('weekly buckets, two weeks past two years', () => {
  assert.equal(bucketDaysFor('2030-01-01', '2031-06-01'), 7);
  assert.equal(bucketDaysFor('2030-01-01', '2033-01-01'), 14);
});

test('who a task waits for and which teams it has', () => {
  const tasks = [
    { id: 'a', wbs: '1.1', name: 'A' },
    { id: 'b', wbs: '1.2', name: 'B', levelLinks: [{ id: 'a', type: 'FS', lag: 0 }, { id: 'gone', type: 'FS', lag: 0 }], teamIds: ['t1', 'tx'] },
  ];
  assert.deepEqual(waitsForOf(tasks[1], tasks).map((x) => x.id), ['a']);
  assert.deepEqual(teamNamesOf(tasks[1], [{ id: 't1', name: 'Team one' }]), ['Team one']);
});

test('calendar preset shown for a project', () => {
  assert.equal(calendarPresetOf({}), 'allDays');
  assert.equal(calendarPresetOf({ calendar: { weekRest: [5] } }), 'custom');
  assert.equal(calendarPresetOf({ calendar: {}, calendarPreset: 'friday' }), 'friday');
});

test('fills people and equipment of older generated items from their work type', () => {
  const workTypes = new Map([
    ['steel', { id: 'steel', crew: { labour: 6, equipment: { crane: 1 } } }],
    ['none', { id: 'none', crew: { labour: 0, equipment: {} } }],
  ]);
  const patches = fillResourcesPatches(
    [
      { id: 'a', workTypeId: 'steel', crews: 2 },
      { id: 'b', workTypeId: 'steel', resources: { labour: 1 } },
      { id: 'c', workTypeId: 'none' },
      { id: 'd', workTypeId: 'gone' },
      { id: 'g', isGroup: true, workTypeId: 'steel' },
    ],
    workTypes
  );
  assert.deepEqual(patches, [{ id: 'a', patch: { resources: { labour: 12, crane: 2 } } }]);
});
