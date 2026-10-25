// Unit tests for the pure helpers of src/utils/PlanningStore.js (node:test).
// loadPlans/savePlans touch localStorage at call time and are not covered here.
//
// ISO week expectations verified against ISO-8601 (2026-01-01 is a Thursday,
// so ISO year 2026 has 53 weeks; 2026-09-27 is a Sunday in 2026-W39).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  whoLabel,
  normalizeWho,
  monthKey,
  isoWeekKey,
  isoWeekRange,
  addWeeksKey,
  addDaysDate,
} from '../PlanningStore.js';

const registries = {
  contractors: [{ id: 'c1', name: 'شركة الفجر' }],
  teams: [
    { id: 't1', name: 'طقم علي', defaultSize: 10, memberWorkerIds: ['w1', 'w2'] },
    { id: 't2', name: 'طقم حسين', memberWorkerIds: ['w1', 'w2', 'w3'] },
  ],
  workers: [
    { id: 'w1', name: 'أحمد' },
    { id: 'w2', name: 'حسين' },
    { id: 'w3', name: 'سعيد' },
  ],
};

describe('whoLabel', () => {
  it('labels count-based crews with Arabic plural forms', () => {
    assert.equal(whoLabel({ kind: 'count', count: 12 }, registries), '12 عامل');
    assert.equal(whoLabel({ kind: 'count', count: 1 }, registries), 'عامل واحد');
    assert.equal(whoLabel({ kind: 'count', count: 2 }, registries), 'عاملان');
    assert.equal(whoLabel({ kind: 'count', count: 0 }, registries), 'لم يُحدد العدد');
    assert.equal(whoLabel(undefined, registries), 'لم يُحدد العدد');
    // PlanningStore has no 'none' kind: it normalizes down to count → same fallback.
    assert.equal(whoLabel({ kind: 'none' }, registries), 'لم يُحدد العدد');
  });

  it('labels teams with their size (defaultSize wins, else member count)', () => {
    assert.equal(whoLabel({ kind: 'team', teamId: 't1' }, registries), 'فريق: طقم علي (10)');
    assert.equal(whoLabel({ kind: 'team', teamId: 't2' }, registries), 'فريق: طقم حسين (3)');
    assert.equal(whoLabel({ kind: 'team', teamId: 'zz' }, registries), 'فريق غير محدد');
  });

  it('labels contractors by registry lookup', () => {
    assert.equal(whoLabel({ kind: 'contractor', contractorId: 'c1' }, registries), 'مقاول: شركة الفجر');
    assert.equal(whoLabel({ kind: 'contractor', contractorId: 'zz' }, registries), 'مقاول غير محدد');
  });

  it('labels worker lists: joined names, +N overflow, count fallback', () => {
    assert.equal(whoLabel({ kind: 'workers', workerIds: ['w1', 'w2'] }, registries), 'أحمد، حسين');
    assert.equal(whoLabel({ kind: 'workers', workerIds: ['w1', 'w2', 'w3'] }, registries), 'أحمد، حسين +1');
    assert.equal(whoLabel({ kind: 'workers', workerIds: ['x1', 'x2', 'x3'] }, registries), '3 عامل');
    assert.equal(whoLabel({ kind: 'workers', workerIds: [] }, registries), 'لم يُحدد عمال');
  });
});

describe('normalizeWho', () => {
  it('keeps valid fields and drops empty references', () => {
    assert.deepEqual(normalizeWho(null), { kind: 'count' });
    assert.deepEqual(normalizeWho({}), { kind: 'count' });
    assert.deepEqual(normalizeWho({ kind: 'bogus' }), { kind: 'count' });
    assert.deepEqual(normalizeWho({ kind: 'team', teamId: '' }), { kind: 'team' }); // empty id dropped
    assert.deepEqual(
      normalizeWho({ kind: 'contractor', contractorId: 'c9', junk: 1 }),
      { kind: 'contractor', contractorId: 'c9' }, // unknown fields dropped
    );
    assert.deepEqual(
      normalizeWho({ kind: 'workers', workerIds: ['a', '', null, 'b'] }),
      { kind: 'workers', workerIds: ['a', 'b'] }, // empty/non-string ids dropped
    );
  });

  it('normalizes counts to non-negative numbers', () => {
    assert.deepEqual(normalizeWho({ kind: 'count', count: -5 }), { kind: 'count', count: 0 });
    assert.deepEqual(normalizeWho({ kind: 'count', count: '7' }), { kind: 'count', count: 7 });
    assert.deepEqual(normalizeWho({ kind: 'count', count: 'abc' }), { kind: 'count' }); // not finite → dropped
  });
});

describe('date helpers', () => {
  it('monthKey extracts YYYY-MM from padded dates only', () => {
    assert.equal(monthKey('2026-09-27'), '2026-09');
    assert.equal(monthKey('2026-12-01'), '2026-12');
    assert.equal(monthKey('2026-9-7'), ''); // unpadded → rejected
    assert.equal(monthKey('garbage'), '');
    assert.equal(monthKey(42), '');
  });

  it('addDaysDate walks calendar days across month/year boundaries (UTC)', () => {
    assert.equal(addDaysDate('2026-01-31', 1), '2026-02-01');
    assert.equal(addDaysDate('2028-02-28', 1), '2028-02-29'); // leap year
    assert.equal(addDaysDate('2026-03-01', -1), '2026-02-28'); // non-leap year
    assert.equal(addDaysDate('2026-12-31', 1), '2027-01-01');
    assert.equal(addDaysDate('2026-01-01', 0), '2026-01-01');
    assert.equal(addDaysDate('garbage', 5), 'garbage'); // invalid input passes through
  });

  it('isoWeekKey follows ISO-8601 including year boundaries', () => {
    assert.equal(isoWeekKey('2026-09-27'), '2026-W39'); // Sunday of W39
    assert.equal(isoWeekKey('2026-01-01'), '2026-W01'); // Thursday → week 1
    assert.equal(isoWeekKey('2026-12-31'), '2026-W53'); // 2026 has 53 ISO weeks
    assert.equal(isoWeekKey('2027-01-01'), '2026-W53'); // belongs to previous ISO year
    assert.equal(isoWeekKey('2027-01-04'), '2027-W01'); // first Monday of ISO 2027
    assert.equal(isoWeekKey('2025-12-29'), '2026-W01'); // Monday belongs to NEXT ISO year
    assert.equal(isoWeekKey('garbage'), '');
    // NOTE: parseYmd does NOT validate the day-of-month, so impossible dates
    // roll over instead of being rejected: 2026-02-30 → 2026-03-02 (Monday of
    // W10). Asserting the actual behavior; see the bug notes in the test report.
    assert.equal(isoWeekKey('2026-02-30'), '2026-W10');
  });

  it('isoWeekRange returns Monday..Sunday and rejects impossible weeks', () => {
    assert.deepEqual(isoWeekRange('2026-W39'), { start: '2026-09-21', end: '2026-09-27' });
    assert.deepEqual(isoWeekRange('2026-W53'), { start: '2026-12-28', end: '2027-01-03' });
    assert.equal(isoWeekRange('2027-W53'), null); // 2027 has only 52 ISO weeks
    assert.equal(isoWeekRange('2026-W00'), null);
    assert.equal(isoWeekRange('2026-W54'), null);
    assert.equal(isoWeekRange('banana'), null);
    assert.equal(isoWeekRange(null), null);
  });

  it('round-trips every ISO week of 2026 through range → key', () => {
    for (let week = 1; week <= 53; week += 1) {
      const key = `2026-W${String(week).padStart(2, '0')}`;
      const range = isoWeekRange(key);
      assert.ok(range, `${key} should exist in 2026`);
      assert.equal(isoWeekKey(range.start), key);
      assert.equal(isoWeekKey(range.end), key); // Sunday stays inside the same week
      assert.equal(addDaysDate(range.start, 6), range.end);
    }
  });

  it('addWeeksKey crosses year boundaries via the range round-trip', () => {
    assert.equal(addWeeksKey('2026-W01', 52), '2026-W53');
    assert.equal(addWeeksKey('2026-W52', 1), '2026-W53');
    assert.equal(addWeeksKey('2026-W53', 1), '2027-W01');
    assert.equal(addWeeksKey('2027-W01', -1), '2026-W53');
    assert.equal(addWeeksKey('banana', 1), 'banana'); // invalid passes through
  });
});
