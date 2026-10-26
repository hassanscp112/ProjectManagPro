// GanttEngine with several predecessors per task, leveling links and a
// working calendar (node:test). 2030-01-01 is a Tuesday; 2030-01-04 a Friday.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { installNodeTestEnvironment, makeTask } from './helpers.js';

installNodeTestEnvironment();

const { GanttEngine } = await import('../GanttEngine.js');
const { writeLinks } = await import('../planning/links.js');

const start = '2030-01-01';
const byId = (result) => new Map(result.tasks.map((t) => [t.id, t]));
const withLinks = (task, links) => writeLinks(makeTask(task), links);
const fridays = { planning: { calendar: { weekRest: [5] } } };

describe('several predecessors', () => {
  it('starts at the latest of all constraints and names the driving link', () => {
    const tasks = [
      makeTask({ id: 'A', wbs: '1.1', duration: 10, manualStart: start }),
      makeTask({ id: 'B', wbs: '1.2', duration: 3, manualStart: start }),
      withLinks({ id: 'C', wbs: '1.3', duration: 2 }, [
        { id: 'B', type: 'FS', lag: 0 }, // 01-04
        { id: 'A', type: 'SS', lag: 5 }, // 01-06 ← wins
      ]),
    ];
    const t = byId(GanttEngine.calculate(tasks, start));
    assert.equal(t.get('C').startDate, '2030-01-06');
    assert.equal(t.get('C').endDate, '2030-01-08');
    assert.equal(t.get('C').drivingLinkId, 'A');
  });

  it('mixes finish constraints (FF) with start constraints (FS)', () => {
    const tasks = [
      makeTask({ id: 'A', wbs: '1.1', duration: 10, manualStart: start }),
      makeTask({ id: 'B', wbs: '1.2', duration: 2, manualStart: start }),
      withLinks({ id: 'C', wbs: '1.3', duration: 4 }, [
        { id: 'B', type: 'FS', lag: 0 }, // start ≥ 01-03
        { id: 'A', type: 'FF', lag: 2 }, // finish ≥ 01-13 → start ≥ 01-09 ← wins
      ]),
    ];
    const t = byId(GanttEngine.calculate(tasks, start));
    assert.equal(t.get('C').startDate, '2030-01-09');
    assert.equal(t.get('C').endDate, '2030-01-13');
  });

  it('a missing predecessor warns and the valid one still applies; all missing → own start', () => {
    const tasks = [
      makeTask({ id: 'A', wbs: '1.1', duration: 4, manualStart: start }),
      withLinks({ id: 'B', wbs: '1.2', duration: 1 }, [{ id: 'ghost', type: 'FS', lag: 0 }, { id: 'A', type: 'FS', lag: 1 }]),
      withLinks({ id: 'C', wbs: '1.3', duration: 1, manualStart: '2030-02-01' }, [{ id: 'x', type: 'FS', lag: 0 }, { id: 'y', type: 'SS', lag: 0 }]),
    ];
    const result = GanttEngine.calculate(tasks, start);
    const t = byId(result);
    assert.equal(t.get('B').startDate, '2030-01-06');
    assert.deepEqual(t.get('B').warnings.map((w) => w.code), ['missingPredecessor']);
    assert.equal(t.get('C').startDate, '2030-02-01');
    assert.deepEqual(t.get('C').warnings.map((w) => w.params.id), ['x', 'y']);
  });

  it('a self link among others warns; an invalid type on an extra link is FS with a warning', () => {
    const tasks = [
      makeTask({ id: 'A', wbs: '1.1', duration: 2, manualStart: start }),
      withLinks({ id: 'B', wbs: '1.2', duration: 1 }, [{ id: 'B', type: 'FS', lag: 0 }, { id: 'A', type: 'FS', lag: 0 }]),
      makeTask({ id: 'C', wbs: '1.3', duration: 1, dependsOn: 'A', depType: 'SS', lag: 0, predecessors: [{ id: 'A' }, { id: 'B', type: 'ZZ', lag: 0 }] }),
    ];
    const t = byId(GanttEngine.calculate(tasks, start));
    assert.deepEqual(t.get('B').warnings.map((w) => w.code), ['selfDependency']);
    assert.equal(t.get('B').startDate, '2030-01-03');
    assert.deepEqual(t.get('C').warnings.map((w) => [w.code, w.params.id]), [['invalidDepType', 'B']]);
    assert.equal(t.get('C').startDate, '2030-01-04'); // FS after B
  });

  it('a cycle through a second link is reported once and does not hang', () => {
    const tasks = [
      withLinks({ id: 'A', wbs: '1.1', duration: 2, manualStart: start }, [{ id: 'B', type: 'FS', lag: 0 }]),
      withLinks({ id: 'B', wbs: '1.2', duration: 2, manualStart: start }, [{ id: 'C', type: 'FS', lag: 0 }, { id: 'A', type: 'FS', lag: 0 }]),
      makeTask({ id: 'C', wbs: '1.3', duration: 1, manualStart: start }),
    ];
    const result = GanttEngine.calculate(tasks, start);
    const cycles = result.warnings.filter((w) => w.code === 'dependencyCycle');
    assert.equal(cycles.length, 1);
    assert.equal(cycles[0].params.cycle, '1.1 > 1.2 > 1.1');
  });

  it('critical path across a diamond with several predecessors', () => {
    const tasks = [
      makeTask({ id: 'A', wbs: '1.1', duration: 2, manualStart: start }),
      makeTask({ id: 'B', wbs: '1.2', duration: 5, dependsOn: 'A', depType: 'FS' }),
      makeTask({ id: 'C', wbs: '1.3', duration: 2, dependsOn: 'A', depType: 'FS' }),
      withLinks({ id: 'D', wbs: '1.4', duration: 1 }, [{ id: 'B', type: 'FS', lag: 0 }, { id: 'C', type: 'FS', lag: 0 }]),
    ];
    const t = byId(GanttEngine.calculate(tasks, start));
    assert.deepEqual(['A', 'B', 'C', 'D'].map((id) => t.get(id).totalFloat), [0, 0, 3, 0]);
    assert.deepEqual(['A', 'B', 'C', 'D'].map((id) => t.get(id).isCritical), [true, true, false, true]);
  });
});

describe('leveling links', () => {
  it('only delay the logic start and make the waiting chain critical', () => {
    const tasks = [
      makeTask({ id: 'A', wbs: '1.1', duration: 4, manualStart: start }),
      makeTask({ id: 'B', wbs: '1.2', duration: 3, manualStart: start, levelLinks: [{ id: 'A', type: 'FS', lag: 0 }] }),
      makeTask({ id: 'C', wbs: '1.3', duration: 1, manualStart: '2030-03-01', levelLinks: [{ id: 'A', type: 'FS', lag: 0 }] }),
    ];
    const t = byId(GanttEngine.calculate(tasks, start));
    assert.equal(t.get('B').startDate, '2030-01-05'); // waits for A's crew
    assert.equal(t.get('C').startDate, '2030-03-01'); // already later: unchanged
    assert.equal(t.get('A').totalFloat, t.get('B').totalFloat); // one chain through the crew hand-over
    assert.equal(t.get('B').drivingLinkId, null); // no logic link drives it
  });

  it('a leveling link to a missing or cyclic task is ignored silently', () => {
    const tasks = [
      makeTask({ id: 'A', wbs: '1.1', duration: 2, manualStart: start, levelLinks: [{ id: 'B', type: 'FS', lag: 0 }] }),
      makeTask({ id: 'B', wbs: '1.2', duration: 2, dependsOn: 'A', depType: 'FS', levelLinks: [{ id: 'ghost' }] }),
    ];
    const result = GanttEngine.calculate(tasks, start);
    assert.deepEqual(result.warnings, []);
    assert.equal(byId(result).get('B').startDate, '2030-01-03');
  });
});

describe('working calendar', () => {
  it('durations are working days; Fridays are skipped; bars span calendar days', () => {
    const tasks = [
      makeTask({ id: 'A', wbs: '1.1', duration: 5, manualStart: start }), // Tue..Sun (Fri off)
      makeTask({ id: 'B', wbs: '1.2', duration: 2, dependsOn: 'A', depType: 'FS' }),
    ];
    const result = GanttEngine.calculate(tasks, start, fridays);
    const t = byId(result);
    assert.equal(t.get('A').endDate, '2030-01-07');
    assert.equal(t.get('A').spanDays, 6);
    assert.equal(t.get('B').startDate, '2030-01-07');
    assert.equal(t.get('B').endDate, '2030-01-09');
    assert.equal(result.projectDuration, 8);
    assert.equal(result.projectWorkingDays, 7);
  });

  it('a manual start on Friday snaps to Saturday; lags count working days', () => {
    const tasks = [
      makeTask({ id: 'A', wbs: '1.1', duration: 1, manualStart: '2030-01-04' }),
      makeTask({ id: 'B', wbs: '1.2', duration: 1, dependsOn: 'A', depType: 'FS', lag: 5 }),
    ];
    const t = byId(GanttEngine.calculate(tasks, start, fridays));
    assert.equal(t.get('A').startDate, '2030-01-05');
    assert.equal(t.get('B').startDate, '2030-01-12'); // Sun + 5 working days (skips Fri 11)
  });

  it('a calendar-day lag (curing) counts every day', () => {
    const cure = { id: 'A', type: 'FS', lag: 7, lagUnit: 'cd' };
    const tasks = [
      makeTask({ id: 'A', wbs: '1.1', duration: 1, manualStart: start }),
      withLinks({ id: 'B', wbs: '1.2', duration: 1 }, [cure]),
    ];
    const t = byId(GanttEngine.calculate(tasks, start, fridays));
    assert.equal(t.get('B').startDate, '2030-01-09'); // Wed 2 + 7 calendar days
  });

  it('float is in working days', () => {
    const tasks = [
      makeTask({ id: 'A', wbs: '1.1', duration: 10, manualStart: start }),
      makeTask({ id: 'B', wbs: '1.2', duration: 3, manualStart: start }),
      withLinks({ id: 'C', wbs: '1.3', duration: 1 }, [{ id: 'A', type: 'FS', lag: 0 }, { id: 'B', type: 'FS', lag: 0 }]),
    ];
    const t = byId(GanttEngine.calculate(tasks, start, fridays));
    assert.equal(t.get('B').totalFloat, 7);
  });

  it('planned progress counts working time only', () => {
    const tasks = [makeTask({ id: 'A', wbs: '1.1', duration: 4, manualStart: '2000-01-01' })];
    const t = byId(GanttEngine.calculate(tasks, '2000-01-01', fridays));
    assert.equal(t.get('A').plannedProgress, 1); // long past
  });
});
