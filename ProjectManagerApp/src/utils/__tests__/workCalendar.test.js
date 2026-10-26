// Unit tests for src/utils/planning/WorkCalendar.js (node:test).
// Weekdays used below: 2030-01-01 is a Tuesday, 2030-01-04 a Friday.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { installNodeTestEnvironment } from './helpers.js';

installNodeTestEnvironment();

const {
  getCalendar,
  normalizeCalendarSpec,
  addWorkingDays,
  workingDaysBetween,
  nextWorkingDay,
  isWorkingDay,
  presetCalendar,
  dayIndex,
  dateOf,
  weekdayOf,
} = await import('../planning/WorkCalendar.js');
const { addDays } = await import('../GanttEngine.js');

const signedDays = (a, b) => dayIndex(b) - dayIndex(a);

describe('day numbers', () => {
  it('dayIndex / dateOf / weekdayOf agree with Date', () => {
    assert.equal(dateOf(dayIndex('2030-01-04')), '2030-01-04');
    assert.equal(weekdayOf(dayIndex('2030-01-04')), 5); // Friday
    assert.equal(weekdayOf(dayIndex('1969-12-31')), 3); // before day 0 too
    assert.equal(dayIndex('2030-02-30'), null);
    assert.equal(dayIndex('garbage'), null);
  });
});

describe('identity calendar', () => {
  it('no spec, or nothing off, is the identity', () => {
    assert.equal(getCalendar(null).isIdentity, true);
    assert.equal(getCalendar({ weekRest: [], holidays: [] }).isIdentity, true);
  });

  it('addWorkingDays ≡ addDays and workingDaysBetween ≡ signed days', () => {
    const cal = getCalendar(null);
    for (let i = 0; i < 300; i++) {
      const start = dateOf(dayIndex('2028-06-15') + ((i * 37) % 900) - 300);
      const n = (i * 13) % 50;
      assert.equal(addWorkingDays(cal, start, n), addDays(start, n));
      const other = dateOf(dayIndex(start) + ((i * 7) % 61) - 30);
      assert.equal(workingDaysBetween(cal, start, other), signedDays(start, other));
    }
  });
});

describe('rest days, holidays and reduced-pace periods', () => {
  const friday = getCalendar({ weekRest: [5] });

  it('a start on a rest day snaps to the next working day', () => {
    assert.equal(isWorkingDay(friday, '2030-01-04'), false);
    assert.equal(nextWorkingDay(friday, '2030-01-04'), '2030-01-05');
    assert.equal(nextWorkingDay(friday, '2030-01-03'), '2030-01-03');
  });

  it('durations skip the rest day; the exclusive end may fall on it', () => {
    // Thu + 2 working days: Thu, (Fri off), Sat → ends Sunday.
    assert.equal(addWorkingDays(friday, '2030-01-03', 2), '2030-01-06');
    // Wed + 2: Wed, Thu → exclusive end is the Friday.
    assert.equal(addWorkingDays(friday, '2030-01-02', 2), '2030-01-04');
    assert.equal(workingDaysBetween(friday, '2030-01-01', '2030-01-08'), 6);
  });

  it('holiday ranges are days off', () => {
    const cal = getCalendar({ weekRest: [5], holidays: [{ from: '2030-01-07', to: '2030-01-08', name: 'عيد' }] });
    // Sun 6, (Mon 7, Tue 8 off), Wed 9 → 2 days from Sun end on Thu 10.
    assert.equal(addWorkingDays(cal, '2030-01-06', 2), '2030-01-10');
  });

  it('a Ramadan day at 0.75 pace: 3 working days span 4 days', () => {
    const cal = getCalendar({ periods: [{ from: '2030-01-01', to: '2030-02-01', factor: 0.75 }] });
    assert.equal(addWorkingDays(cal, '2030-01-10', 3), '2030-01-14');
    assert.equal(workingDaysBetween(cal, '2030-01-10', '2030-01-14'), 3);
  });

  it('workdays exceptions make a rest day a working day', () => {
    const cal = getCalendar({ weekRest: [5], workdays: ['2030-01-04'] });
    assert.equal(isWorkingDay(cal, '2030-01-04'), true);
    assert.equal(addWorkingDays(cal, '2030-01-03', 2), '2030-01-05');
  });

  it('works far before and after the first date it saw', () => {
    const cal = getCalendar({ weekRest: [5, 6] });
    assert.equal(addWorkingDays(cal, '2030-01-01', 5), '2030-01-08'); // Tue..Thu, Sun, Mon
    assert.equal(addWorkingDays(cal, '2045-03-01', 10) > '2045-03-10', true);
    assert.equal(addWorkingDays(cal, '2012-05-01', 5), addWorkingDays(getCalendar({ weekRest: [5, 6] }), '2012-05-01', 5));
    assert.equal(workingDaysBetween(cal, '2020-01-01', '2040-01-01') > 0, true);
  });

  it('is memoized per spec object', () => {
    const spec = { weekRest: [5] };
    assert.equal(getCalendar(spec), getCalendar(spec));
  });
});

describe('normalizeCalendarSpec', () => {
  it('cleans dates, ranges and factors', () => {
    const { spec, issues } = normalizeCalendarSpec({
      weekRest: [5, 5, 9, '6'],
      holidays: [{ from: '2030-01-09', to: '2030-01-07' }, { from: 'bad' }],
      periods: [{ from: '2030-03-01', to: '2030-03-30', factor: 0.7349 }, { from: '2030-04-01', factor: 9 }],
      workdays: ['2030-01-04', 'x'],
    });
    assert.deepEqual(spec.weekRest, [5, 6]);
    assert.deepEqual(spec.holidays, [{ from: '2030-01-07', to: '2030-01-09', name: '' }]);
    assert.deepEqual(spec.periods.map((p) => p.factor), [0.73, 2]);
    assert.deepEqual(spec.workdays, ['2030-01-04']);
    assert.deepEqual(issues, [{ code: 'badHoliday', name: '' }]);
  });

  it('a week with every day off keeps no rest days', () => {
    const { spec, issues } = normalizeCalendarSpec({ weekRest: [0, 1, 2, 3, 4, 5, 6] });
    assert.deepEqual(spec.weekRest, []);
    assert.deepEqual(issues, [{ code: 'allDaysOff' }]);
  });
});

describe('presetCalendar', () => {
  it('Friday + Iraqi fixed holidays for the project years', () => {
    const spec = presetCalendar('fridayHolidays', '2030-05-01', 1);
    assert.deepEqual(spec.weekRest, [5]);
    assert.ok(spec.holidays.some((h) => h.from === '2030-07-14'));
    assert.ok(spec.holidays.some((h) => h.from === '2031-01-06'));
  });

  it('the other presets', () => {
    assert.deepEqual(presetCalendar('friday', '2030-01-01').weekRest, [5]);
    assert.deepEqual(presetCalendar('fridaySaturday', '2030-01-01').weekRest, [5, 6]);
    assert.equal(getCalendar(presetCalendar('allDays', '2030-01-01')).isIdentity, true);
  });
});
