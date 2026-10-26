// ─────────────────────────────────────────────────────────────
// WorkCalendar — a project's working days, as a working-time axis.
//
// Spec (stored in projectMeta.planning.calendar; all optional):
//   { weekRest: [5],                                   // UTC weekdays off (0 = Sunday … 5 = Friday)
//     holidays: [{ from: 'YYYY-MM-DD', to?, name }],   // days off
//     periods:  [{ from, to, factor: 0.75, name }],    // reduced pace (Ramadan)
//     workdays: ['YYYY-MM-DD'] }                       // worked although off
//
// Every day has a capacity in units: 100 = one normal working day, 0 = off,
// 75 = a Ramadan day at 0.75 pace. cum(k) = units before day k, so a task of
// D working days occupies D × 100 units. Day k is the UTC day number since
// 1970-01-01. Without rest days, holidays or periods the calendar is the
// IDENTITY (cum(k) = 100k, pure arithmetic): every date then comes out
// exactly as the old 7-day engine computed it.
//
//   startDayOf(T)        first day in which working time T is spent (skips days off)
//   endDayOf(T)          exclusive end: first day starting at or after T
//   lastDayAtOrBefore(T) last day starting at or before T
// Tested in __tests__/workCalendar.test.js.
// ─────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
export const UNITS_PER_DAY = 100;
const CHUNK_DAYS = 1024;
const MAX_RANGE_DAYS = 3660; // one holiday / period entry spans at most ~10 years
const MAX_WINDOW_DAYS = 80000; // ~220 years of cached days, a hard guard

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** UTC day number of a 'YYYY-MM-DD' date, or null when invalid. */
export const dayIndex = (date) => {
  if (typeof date !== 'string') return null;
  const m = date.match(DATE_RE);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const ms = Date.UTC(y, mo - 1, d);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return Math.round(ms / DAY_MS);
};

/** 'YYYY-MM-DD' of a UTC day number. */
export const dateOf = (k) => new Date(k * DAY_MS).toISOString().slice(0, 10);

/** UTC weekday of a day number (0 = Sunday … 6 = Saturday; day 0 was a Thursday). */
export const weekdayOf = (k) => (((k + 4) % 7) + 7) % 7;

const clampFactor = (f) => {
  const n = Number(f);
  if (!Number.isFinite(n)) return 1;
  return Math.min(2, Math.max(0.05, Math.round(n * 100) / 100));
};

const rangeOf = (entry) => {
  const from = dayIndex(entry?.from);
  if (from === null) return null;
  let to = dayIndex(entry?.to || entry?.from);
  if (to === null) to = from;
  let a = Math.min(from, to);
  let b = Math.max(from, to);
  if (b - a > MAX_RANGE_DAYS) b = a + MAX_RANGE_DAYS;
  return [a, b];
};

/**
 * Clean a calendar spec. → { spec, issues: [{ code, ... }] }.
 * Invalid dates are dropped, reversed ranges swapped, factors kept within
 * 0.05–2 (to 0.01), and a week with every day off loses its rest days.
 */
export const normalizeCalendarSpec = (raw) => {
  const issues = [];
  const src = raw && typeof raw === 'object' ? raw : {};
  let weekRest = [...new Set((Array.isArray(src.weekRest) ? src.weekRest : []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  if (weekRest.length === 7) {
    issues.push({ code: 'allDaysOff' });
    weekRest = [];
  }
  const holidays = [];
  (Array.isArray(src.holidays) ? src.holidays : []).forEach((h) => {
    const r = rangeOf(h);
    if (!r) {
      issues.push({ code: 'badHoliday', name: h?.name || '' });
      return;
    }
    holidays.push({ from: dateOf(r[0]), to: dateOf(r[1]), name: h.name || '' });
  });
  const periods = [];
  (Array.isArray(src.periods) ? src.periods : []).forEach((p) => {
    const r = rangeOf(p);
    if (!r) {
      issues.push({ code: 'badPeriod', name: p?.name || '' });
      return;
    }
    periods.push({ from: dateOf(r[0]), to: dateOf(r[1]), factor: clampFactor(p.factor ?? 1), name: p.name || '' });
  });
  const workdays = [...new Set((Array.isArray(src.workdays) ? src.workdays : []).filter((d) => dayIndex(d) !== null))].sort();
  return { spec: { weekRest, holidays, periods, workdays }, issues };
};

/* ─────────────── identity ─────────────── */

const IDENTITY = Object.freeze({
  isIdentity: true,
  issues: [],
  capacityOf: () => UNITS_PER_DAY,
  cum: (k) => k * UNITS_PER_DAY,
  startDayOf: (T) => Math.floor(T / UNITS_PER_DAY),
  endDayOf: (T) => Math.ceil(T / UNITS_PER_DAY),
  lastDayAtOrBefore: (T) => Math.floor(T / UNITS_PER_DAY),
});

/* ─────────────── real calendars ─────────────── */

const buildCalendar = (spec, issues) => {
  const rest = new Set(spec.weekRest);
  const holidayDays = new Set();
  spec.holidays.forEach((h) => {
    const [a, b] = rangeOf(h);
    for (let k = a; k <= b; k++) holidayDays.add(k);
  });
  const workDays = new Set(spec.workdays.map(dayIndex));
  const periods = spec.periods.map((p) => {
    const [a, b] = rangeOf(p);
    return { a, b, units: Math.round(p.factor * UNITS_PER_DAY) };
  });

  const capacityOf = (k) => {
    let periodUnits = null;
    for (const p of periods) {
      if (k >= p.a && k <= p.b && (periodUnits === null || p.units < periodUnits)) periodUnits = p.units;
    }
    if (workDays.has(k)) return periodUnits ?? UNITS_PER_DAY;
    if (holidayDays.has(k)) return 0;
    if (rest.has(weekdayOf(k))) return 0;
    return periodUnits ?? UNITS_PER_DAY;
  };

  // cum values for days lo..hi (inclusive), cum(anchor) = 0; grows lazily.
  let lo = null;
  let hi = null;
  let arr = null;
  const build = (newLo, newHi) => {
    const next = new Int32Array(newHi - newLo + 1);
    if (arr === null) {
      const anchor = newLo;
      next[0] = 0;
      for (let k = anchor; k < newHi; k++) next[k - newLo + 1] = next[k - newLo] + capacityOf(k);
    } else {
      next.set(arr, lo - newLo);
      for (let k = lo - 1; k >= newLo; k--) next[k - newLo] = next[k - newLo + 1] - capacityOf(k);
      for (let k = hi; k < newHi; k++) next[k - newLo + 1] = next[k - newLo] + capacityOf(k);
    }
    arr = next;
    lo = newLo;
    hi = newHi;
  };
  const ensureDay = (k) => {
    if (arr === null) build(k - CHUNK_DAYS, k + CHUNK_DAYS);
    if (k >= lo && k <= hi) return true;
    const newLo = Math.min(lo, k - CHUNK_DAYS);
    const newHi = Math.max(hi, k + CHUNK_DAYS);
    if (newHi - newLo > MAX_WINDOW_DAYS) return false;
    build(newLo, newHi);
    return true;
  };
  const cum = (k) => {
    if (ensureDay(k)) return arr[k - lo];
    // Beyond the guard window: continue at normal pace from the edge.
    return k < lo ? arr[0] - (lo - k) * UNITS_PER_DAY : arr[hi - lo] + (k - hi) * UNITS_PER_DAY;
  };
  // Window covering working time T on both sides (cum(lo) <= T < cum(hi)).
  const ensureUnits = (T) => {
    if (arr === null) build(-CHUNK_DAYS, CHUNK_DAYS);
    for (let guard = 0; guard < 200 && arr[0] > T; guard++) if (!ensureDay(lo - CHUNK_DAYS)) break;
    for (let guard = 0; guard < 200 && arr[hi - lo] <= T; guard++) if (!ensureDay(hi + CHUNK_DAYS)) break;
  };
  // Smallest k in [lo, hi] with cum(k) > T (or >= T when inclusive); null when none.
  const firstAbove = (T, inclusive) => {
    ensureUnits(T);
    let a = 0;
    let b = hi - lo;
    const ok = (i) => (inclusive ? arr[i] >= T : arr[i] > T);
    if (!ok(b)) return null;
    while (a < b) {
      const mid = (a + b) >> 1;
      if (ok(mid)) b = mid;
      else a = mid + 1;
    }
    return lo + a;
  };
  // Outside the guard window the pace is normal (see cum()).
  const beyondEnd = (T) => hi + Math.ceil((T - arr[hi - lo]) / UNITS_PER_DAY);
  const beforeStart = (T) => lo - Math.ceil((arr[0] - T) / UNITS_PER_DAY);

  // Largest k with cum(k) <= T. For a start this is the day in which time T
  // is spent: a day off has no length, so it is skipped.
  const dayAtOrBefore = (T) => {
    const k = firstAbove(T, false);
    if (k === null) return beyondEnd(T);
    return k === lo && arr[0] > T ? beforeStart(T) : k - 1;
  };

  return {
    isIdentity: false,
    issues,
    capacityOf,
    cum,
    startDayOf: dayAtOrBefore,
    endDayOf: (T) => {
      const k = firstAbove(T, true);
      if (k === null) return beyondEnd(T);
      return k === lo && arr[0] > T ? beforeStart(T) : k;
    },
    lastDayAtOrBefore: dayAtOrBefore,
  };
};

const cacheByObject = new WeakMap();
const cacheByKey = new Map();

/**
 * The calendar for a spec (memoized). No spec, or a spec with nothing off,
 * gives the identity calendar.
 */
export const getCalendar = (rawSpec) => {
  if (!rawSpec || typeof rawSpec !== 'object') return IDENTITY;
  const cached = cacheByObject.get(rawSpec);
  if (cached) return cached;
  const { spec, issues } = normalizeCalendarSpec(rawSpec);
  let cal;
  if (!spec.weekRest.length && !spec.holidays.length && !spec.periods.length) {
    cal = issues.length ? { ...IDENTITY, issues } : IDENTITY;
  } else {
    const key = JSON.stringify(spec);
    cal = cacheByKey.get(key);
    if (!cal) {
      cal = buildCalendar(spec, issues);
      if (cacheByKey.size > 32) cacheByKey.clear();
      cacheByKey.set(key, cal);
    }
  }
  cacheByObject.set(rawSpec, cal);
  return cal;
};

export const identityCalendar = () => IDENTITY;

/* ─────────────── date helpers for screens ─────────────── */

/** Working time at the start of a date. */
export const startUnits = (cal, date) => {
  const k = dayIndex(date);
  return k === null ? null : cal.cum(k);
};

/** True when the date has working capacity. */
export const isWorkingDay = (cal, date) => {
  const k = dayIndex(date);
  return k !== null && cal.capacityOf(k) > 0;
};

/** The date itself when it is a working day, else the next working day. */
export const nextWorkingDay = (cal, date) => {
  const k = dayIndex(date);
  return k === null ? null : dateOf(cal.startDayOf(cal.cum(k)));
};

/**
 * Exclusive end date of `days` working days starting on `date` (which snaps
 * to a working day first) — same meaning as the engine's endDate.
 */
export const addWorkingDays = (cal, date, days) => {
  const k = dayIndex(date);
  if (k === null) return null;
  const n = Number(days) || 0;
  const start = cal.startDayOf(cal.cum(k));
  if (n === 0) return dateOf(start);
  return dateOf(cal.endDayOf(cal.cum(start) + Math.round(n * UNITS_PER_DAY)));
};

/** Working days from a to b (signed, fractional in reduced-pace periods). */
export const workingDaysBetween = (cal, a, b) => {
  const ka = dayIndex(a);
  const kb = dayIndex(b);
  if (ka === null || kb === null) return 0;
  return (cal.cum(kb) - cal.cum(ka)) / UNITS_PER_DAY;
};

/* ─────────────── presets (the wizard) ─────────────── */

// Fixed-date Iraqi official holidays (month-day). Islamic holidays move each
// year (Eid al-Fitr, Eid al-Adha, Ashura, Mawlid) and are entered per year.
export const IRAQ_FIXED_HOLIDAYS = [
  { md: '01-01', name: 'رأس السنة الميلادية' },
  { md: '01-06', name: 'عيد الجيش' },
  { md: '03-21', name: 'نوروز' },
  { md: '05-01', name: 'عيد العمال' },
  { md: '07-14', name: 'ذكرى ثورة 14 تموز' },
  { md: '10-03', name: 'اليوم الوطني' },
  { md: '12-10', name: 'يوم النصر' },
  { md: '12-25', name: 'عيد الميلاد' },
];

export const CALENDAR_PRESETS = ['fridayHolidays', 'friday', 'fridaySaturday', 'allDays'];

/**
 * A calendar spec for a preset, holidays filled for the years the project
 * may span (startDate's year + `years`).
 */
export const presetCalendar = (preset, startDate, years = 3) => {
  const startYear = Number(String(startDate || '').slice(0, 4)) || new Date().getUTCFullYear();
  switch (preset) {
    case 'allDays':
      return { weekRest: [], holidays: [], periods: [], workdays: [] };
    case 'fridaySaturday':
      return { weekRest: [5, 6], holidays: [], periods: [], workdays: [] };
    case 'friday':
      return { weekRest: [5], holidays: [], periods: [], workdays: [] };
    case 'fridayHolidays':
    default: {
      const holidays = [];
      for (let y = startYear; y <= startYear + years; y++) {
        IRAQ_FIXED_HOLIDAYS.forEach((h) => holidays.push({ from: `${y}-${h.md}`, to: `${y}-${h.md}`, name: h.name }));
      }
      return { weekRest: [5], holidays, periods: [], workdays: [] };
    }
  }
};
