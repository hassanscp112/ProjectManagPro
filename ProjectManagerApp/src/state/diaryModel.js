// ─────────────────────────────────────────────────────────────
// diaryModel — the site diary's and the delay register's rules as pure
// functions.
//
// Diary: manpower prefilled from the day's plan crews, "same as
// yesterday", what the editor opens with, totals and the days a period
// prints. Delays: the days an event covers (an open event runs to
// today), days over several events counted once, the FIDIC 20.1 notice
// check (notice within 28 days of the start), register and month totals.
// Dates are 'YYYY-MM-DD' strings handled as UTC days.
// Tested in __tests__/diaryModel.test.js.
// ─────────────────────────────────────────────────────────────

import { createDiaryRowId, emptyDiaryDay, isDiaryDayEmpty, normalizeDiaryDay } from '../utils/SiteDiary.js';
import { addDays, monthBounds } from './reportsModel.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const asArray = (v) => (Array.isArray(v) ? v : []);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const isDay = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const sumOf = (list, pick) => list.reduce((t, x) => t + num(pick(x)), 0);

/** b − a in whole days. */
export const dayDiff = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);

/* ─────────────── Site diary ─────────────── */

/**
 * Manpower by trade from one day's plan crews (Lookahead day assignments).
 * A worker counts once even when planned on two items; a team counts its
 * members by trade, plus its head count above them as general labour; a
 * bare head count is general labour (trade ''); a contractor's crew is a
 * row with its name and no count, to fill in. Rows keep first-seen order.
 */
export const manpowerFromPlan = (assignments = [], registries = {}) => {
  const workers = new Map(asArray(registries?.workers).map((w) => [w.id, w]));
  const teams = new Map(asArray(registries?.teams).map((t) => [t.id, t]));
  const contractors = new Map(asArray(registries?.contractors).map((c) => [c.id, c]));
  const seen = new Set();
  const rows = new Map();
  const add = (trade, n) => {
    const name = String(trade || '').trim();
    const key = name.toLowerCase();
    const row = rows.get(key) || { trade: name, count: 0 };
    row.count += n;
    rows.set(key, row);
  };
  const once = (key) => {
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  };
  const addWorker = (id) => once(`w:${id}`) && add(workers.get(id)?.trade, 1);

  asArray(assignments).forEach((a) => {
    const who = a?.who || {};
    if (who.kind === 'workers') {
      asArray(who.workerIds).forEach(addWorker);
    } else if (who.kind === 'team') {
      const team = teams.get(who.teamId);
      if (!team || !once(`t:${team.id}`)) return;
      const members = asArray(team.memberWorkerIds);
      members.forEach(addWorker);
      const extra = Math.max(0, Math.round(num(team.defaultSize)) - members.length);
      if (extra) add('', extra);
    } else if (who.kind === 'contractor') {
      const contractor = contractors.get(who.contractorId);
      if (contractor?.name && once(`c:${contractor.id}`)) add(contractor.name, 0);
    } else if (num(who.count) > 0) {
      add('', Math.round(num(who.count)));
    }
  });
  return [...rows.values()].map((r) => ({ id: createDiaryRowId(), ...r }));
};

/**
 * What the diary editor opens with: the saved day, else a blank day with
 * manpower prefilled from the day's plan crews (`prefilled` says so).
 */
export const diaryDraft = (entry, planAssignments = [], registries = {}) => {
  if (entry && !isDiaryDayEmpty(entry)) return { draft: normalizeDiaryDay(entry), prefilled: false };
  const manpower = manpowerFromPlan(planAssignments, registries);
  return { draft: { ...emptyDiaryDay(), manpower }, prefilled: manpower.length > 0 };
};

/** The latest recorded day before `day` ('' when none) — the source of "Same as yesterday". */
export const previousDiaryDay = (diary, day) =>
  Object.keys(diary?.days || {})
    .filter((d) => d < day && !isDiaryDayEmpty(diary.days[d]))
    .sort()
    .pop() || '';

/**
 * "Same as yesterday": the weather, temperature, hours, manpower and
 * equipment of `source` (fresh row ids). Visitors and issues belong to
 * their own day and are not copied.
 */
export const copyDiaryDay = (source) => {
  const s = normalizeDiaryDay(source);
  const fresh = (rows) => rows.map((r) => ({ ...r, id: createDiaryRowId() }));
  return {
    ...emptyDiaryDay(),
    weather: s.weather,
    maxTemp: s.maxTemp,
    hours: s.hours,
    manpower: fresh(s.manpower),
    equipment: fresh(s.equipment),
  };
};

/** Head counts of one day. */
export const diaryTotals = (entry) => {
  const d = normalizeDiaryDay(entry);
  return { workers: sumOf(d.manpower, (r) => r.count), equipment: sumOf(d.equipment, (r) => r.count), visitors: d.visitors.length };
};

/** Days in [from, to] with a diary entry. */
export const diaryDaysInRange = (diary, from, to) =>
  Object.keys(diary?.days || {}).filter((d) => d >= from && d <= to && !isDiaryDayEmpty(diary.days[d]));

/** Distinct non-empty names, ignoring case (the first spelling wins), sorted. */
const distinctNames = (names) => {
  const byKey = new Map();
  names.forEach((n) => {
    const name = String(n || '').trim();
    if (name && !byKey.has(name.toLowerCase())) byKey.set(name.toLowerCase(), name);
  });
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
};

const diaryRows = (diary, list) => Object.values(diary?.days || {}).flatMap((d) => asArray(d?.[list]));

/** Trades to suggest: the roster's worker trades and every trade used in the diary. */
export const tradeSuggestions = (diary, registries) =>
  distinctNames([...asArray(registries?.workers).map((w) => w?.trade), ...diaryRows(diary, 'manpower').map((r) => r.trade)]);

/** Equipment types used in the diary before (added to the built-in suggestions). */
export const equipmentSuggestions = (diary) => distinctNames(diaryRows(diary, 'equipment').map((r) => r.type));

/* ─────────────── Delay register ─────────────── */

/** FIDIC 20.1: the contractor gives notice within 28 days of the event. */
export const NOTICE_DAYS = 28;

/** The days an event covers: start … end (an open event runs to today). null before it starts. */
export const delaySpan = (event, today) => {
  if (!isDay(event?.start)) return null;
  const end = isDay(event.end) ? event.end : today;
  if (!isDay(end) || end < event.start) return null;
  return { start: event.start, end };
};

/** Days in a span, both ends included. */
export const spanDays = (span) => (span ? dayDiff(span.start, span.end) + 1 : 0);

export const delayDays = (event, today) => spanDays(delaySpan(event, today));

/** Calendar days covered by any of the spans — a day under two events counts once. */
export const unionDays = (spans) => {
  const list = asArray(spans)
    .filter(Boolean)
    .sort((a, b) => a.start.localeCompare(b.start));
  let total = 0;
  let cur = null;
  list.forEach((s) => {
    if (cur && s.start <= cur.end) {
      if (s.end > cur.end) cur.end = s.end;
      return;
    }
    if (cur) total += spanDays(cur);
    cur = { ...s };
  });
  return total + spanDays(cur);
};

const clipSpan = (span, from, to) => {
  if (!span) return null;
  const start = span.start > from ? span.start : from;
  const end = span.end < to ? span.end : to;
  return start <= end ? { start, end } : null;
};

/**
 * The notice check (FIDIC 20.1). state:
 *   'ok'      notice given within 28 days of the start (daysAfter)
 *   'late'    notice given more than 28 days after the start — warn
 *   'open'    no notice yet, still in time (deadline, daysLeft)
 *   'overdue' no notice and the 28 days have passed (daysLate) — warn
 *   'none'    no start date
 */
export const noticeCheck = (event, today) => {
  if (!isDay(event?.start)) return { state: 'none' };
  const deadline = addDays(event.start, NOTICE_DAYS);
  if (isDay(event.noticeDate)) {
    const daysAfter = dayDiff(event.start, event.noticeDate);
    return { state: daysAfter > NOTICE_DAYS ? 'late' : 'ok', deadline, daysAfter };
  }
  const daysLeft = dayDiff(today, deadline);
  return daysLeft < 0 ? { state: 'overdue', deadline, daysLate: -daysLeft } : { state: 'open', deadline, daysLeft };
};

export const noticeWarns = (check) => check.state === 'late' || check.state === 'overdue';

/** Days granted (only a granted claim has any). */
export const grantedDays = (event) => (event?.status === 'granted' ? num(event.daysGranted) : 0);

/** Days actually claimed (a draft is not a claim yet). */
export const claimedDays = (event) => (event && event.status !== 'draft' ? num(event.daysClaimed) : 0);

const claimTotals = (events) => ({
  claimed: sumOf(events, claimedDays),
  granted: sumOf(events, grantedDays),
  pending: sumOf(
    events.filter((e) => e.status === 'submitted'),
    (e) => e.daysClaimed
  ),
});

/**
 * Register totals: delay days (overlaps counted once), excusable delay
 * days, days claimed vs granted (+ awaiting a decision), open events and
 * notice warnings.
 */
export const delayTotals = (events = [], today) => {
  const list = asArray(events).filter(Boolean);
  return {
    count: list.length,
    days: unionDays(list.map((e) => delaySpan(e, today))),
    excusableDays: unionDays(list.filter((e) => e.excusable).map((e) => delaySpan(e, today))),
    ...claimTotals(list),
    ongoing: list.filter((e) => isDay(e.start) && !isDay(e.end)).length,
    noticeWarnings: list.filter((e) => noticeWarns(noticeCheck(e, today))).length,
  };
};

/**
 * Events that touch a month, with the part inside it: rows sorted by
 * start, delay days in the month (overlaps counted once), and the claims
 * of those events.
 */
export const delaysInMonth = (events = [], month, today) => {
  const { start, end } = monthBounds(month);
  const rows = asArray(events)
    .filter(Boolean)
    .map((event) => {
      const span = clipSpan(delaySpan(event, today), start, end);
      return span ? { event, span, days: spanDays(span) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.span.start.localeCompare(b.span.start));
  return {
    rows,
    days: unionDays(rows.map((r) => r.span)),
    excusableDays: unionDays(rows.filter((r) => r.event.excusable).map((r) => r.span)),
    ...claimTotals(rows.map((r) => r.event)),
  };
};

/** Newest start first (then newest recorded). */
export const sortDelays = (events = []) =>
  [...asArray(events).filter(Boolean)].sort(
    (a, b) => (b.start || '').localeCompare(a.start || '') || String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  );

export const filterDelays = (events = [], { status = 'all', cause = 'all' } = {}) =>
  asArray(events).filter((e) => e && (status === 'all' || e.status === status) && (cause === 'all' || e.cause === cause));

/** Editor checks: { field: 'required' | 'beforeStart' } (empty = can save). */
export const delayErrors = (draft) => {
  const errors = {};
  if (!String(draft?.title || '').trim()) errors.title = 'required';
  if (!isDay(draft?.start)) errors.start = 'required';
  else if (isDay(draft.end) && draft.end < draft.start) errors.end = 'beforeStart';
  return errors;
};
