// Unit tests for src/utils/CriticalPath.js (node:test).
//
// Expected latest-finish values below are hand-computed with the standard CPM
// backward pass documented at the top of CriticalPath.js:
//   FS: T.LF <= S.LS - lag          SS: T.LF <= S.LS - lag + T.dur
//   FF: T.LF <= S.LF - lag          SF: T.LF <= S.LF - lag + T.dur

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeCriticalPath } from '../CriticalPath.js';

// Minimal "computed task" leaf: GanttEngine output shape fields the module reads.
const leaf = (id, startDate, endDate, extra = {}) => ({
  id,
  isGroup: false,
  startDate,
  endDate,
  dependsOn: null,
  depType: 'FS',
  lag: 0,
  ...extra,
});

describe('computeCriticalPath', () => {
  it('returns empty results for empty or non-array input', () => {
    assert.deepEqual([...computeCriticalPath([]).criticalIds], []);
    assert.equal(computeCriticalPath([]).floatById.size, 0);
    const notArray = computeCriticalPath(null);
    assert.deepEqual([...notArray.criticalIds], []);
    assert.equal(notArray.floatById.size, 0);
  });

  it('marks every task of a serial FS chain A→B→C critical with zero float', () => {
    const tasks = [
      leaf('A', '2030-01-01', '2030-01-11'), // dur 10
      leaf('B', '2030-01-11', '2030-01-15', { dependsOn: 'A' }), // dur 4
      leaf('C', '2030-01-15', '2030-01-18', { dependsOn: 'B' }), // dur 3
    ];
    const { criticalIds, floatById } = computeCriticalPath(tasks);

    assert.deepEqual([...criticalIds].sort(), ['A', 'B', 'C']);
    assert.equal(floatById.get('A'), 0);
    assert.equal(floatById.get('B'), 0);
    assert.equal(floatById.get('C'), 0);
  });

  it('gives a shorter parallel branch positive float while the driver stays critical', () => {
    // A (2d) → B1 (10d, drives the end) and B2 (4d, parallel, same start).
    const tasks = [
      leaf('A', '2030-01-01', '2030-01-03'),
      leaf('B1', '2030-01-03', '2030-01-13', { dependsOn: 'A' }),
      leaf('B2', '2030-01-03', '2030-01-07', { dependsOn: 'A' }),
    ];
    const { criticalIds, floatById } = computeCriticalPath(tasks);

    assert.equal(floatById.get('B1'), 0);
    assert.ok(criticalIds.has('B1'));
    assert.ok(criticalIds.has('A')); // A drives B1 → critical
    // B2 latest finish is the project end (01-13): LS 01-09 vs ES 01-03 → 6 days.
    assert.equal(floatById.get('B2'), 6);
    assert.ok(!criticalIds.has('B2'));
  });

  it('shifts float by FS lag on the parallel branch', () => {
    // Same graph, but B2 starts 2 days after A finishes (FS + 2).
    const tasks = [
      leaf('A', '2030-01-01', '2030-01-03'),
      leaf('B1', '2030-01-03', '2030-01-13', { dependsOn: 'A' }),
      leaf('B2', '2030-01-05', '2030-01-09', { dependsOn: 'A', lag: 2 }),
    ];
    const { criticalIds, floatById } = computeCriticalPath(tasks);

    assert.equal(floatById.get('A'), 0);
    assert.equal(floatById.get('B1'), 0);
    // ES moved 2 days later → float shrinks from 6 to 4.
    assert.equal(floatById.get('B2'), 4);
    assert.ok(criticalIds.has('A') && criticalIds.has('B1') && !criticalIds.has('B2'));
  });

  it('honours an SS constraint (start of successor tied to start of predecessor)', () => {
    // A 10d; B (3d) starts 2 days after A starts (SS + 2) → B finishes on day 5.
    const tasks = [
      leaf('A', '2030-01-01', '2030-01-11'),
      leaf('B', '2030-01-03', '2030-01-06', { dependsOn: 'A', depType: 'SS', lag: 2 }),
    ];
    const { criticalIds, floatById } = computeCriticalPath(tasks);

    // B's LF = project end (01-11) → LS 01-08 vs ES 01-03 → float 5.
    assert.equal(floatById.get('B'), 5);
    assert.ok(!criticalIds.has('B'));
    // SS bound for A: B.LS - lag + A.dur = 01-08 - 2d + 10d → not binding;
    // A keeps LF = project end → float 0.
    assert.equal(floatById.get('A'), 0);
    assert.ok(criticalIds.has('A'));
  });

  it('honours an FF constraint (finish of successor tied to finish of predecessor)', () => {
    // A 10d (ends 01-11); B (4d) must finish 1 day after A (FF + 1) → 01-12.
    const tasks = [
      leaf('A', '2030-01-01', '2030-01-11'),
      leaf('B', '2030-01-08', '2030-01-12', { dependsOn: 'A', depType: 'FF', lag: 1 }),
    ];
    const { criticalIds, floatById } = computeCriticalPath(tasks);

    // Project end is B's finish; B's LF = own finish → float 0.
    assert.equal(floatById.get('B'), 0);
    assert.ok(criticalIds.has('B'));
    // FF bound for A: B.LF - lag = 01-11 → A.LF = 01-11 → float 0.
    assert.equal(floatById.get('A'), 0);
    assert.ok(criticalIds.has('A'));
  });

  it('honours an SF constraint (finish of successor tied to start of predecessor)', () => {
    // A 10d; B (4d) finishes 8 days after A STARTS → B runs 01-05..01-09.
    const tasks = [
      leaf('A', '2030-01-01', '2030-01-11'),
      leaf('B', '2030-01-05', '2030-01-09', { dependsOn: 'A', depType: 'SF', lag: 8 }),
    ];
    const { criticalIds, floatById } = computeCriticalPath(tasks);

    // Project end = A's finish (01-11); B's LF 01-11 → LS 01-07 vs ES 01-05 → float 2.
    assert.equal(floatById.get('B'), 2);
    assert.ok(!criticalIds.has('B'));
    // SF bound for A: B.LF - lag + A.dur = 01-11 - 8d + 10d → not binding → float 0.
    assert.equal(floatById.get('A'), 0);
    assert.ok(criticalIds.has('A'));
  });

  it('excludes groups and leaves without resolvable dates', () => {
    const tasks = [
      { id: 'G', isGroup: true, startDate: '2030-01-01', endDate: '2030-01-10', dependsOn: null, depType: 'FS', lag: 0 },
      leaf('ok', '2030-01-01', '2030-01-05'),
      { id: 'nodates', isGroup: false, startDate: null, endDate: null, dependsOn: null, depType: 'FS', lag: 0 },
    ];
    const { criticalIds, floatById } = computeCriticalPath(tasks);

    assert.ok(!floatById.has('G'));
    assert.ok(!floatById.has('nodates'));
    assert.ok(floatById.has('ok'));
    assert.ok(criticalIds.has('ok'));
  });

  it('degrades gracefully (no throw) on a dependency cycle', () => {
    const tasks = [
      leaf('x', '2030-01-01', '2030-01-05', { dependsOn: 'y' }),
      leaf('y', '2030-01-05', '2030-01-09', { dependsOn: 'x' }),
    ];
    let result;
    assert.doesNotThrow(() => {
      result = computeCriticalPath(tasks);
    });
    assert.ok(result.criticalIds instanceof Set);
    assert.ok(result.floatById instanceof Map);
    assert.equal(result.floatById.size, 2); // both leaves still get a float value
  });
});
