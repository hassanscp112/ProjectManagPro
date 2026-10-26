// ─────────────────────────────────────────────────────────────
// plannerModel — the New project wizard's rules as pure functions.
//
// The wizard keeps the person's answers (details, where the plan comes
// from, building inputs, per-level changes) and their corrections to the
// generated plan (quantities, costs, dropped items, markups, calendar,
// productivity, crews, switched-off links) in one state object changed by
// plannerReducer. The plan itself is never stored: it is re-generated from
// the state on every change (utils/planning/autoPlan.planProject), so every
// step always shows the consequences of every answer.
// Tested in __tests__/plannerModel.test.js.
// ─────────────────────────────────────────────────────────────

import { DEFAULT_MARKUPS } from '../utils/planning/autoPlan.js';
import { presetCalendar } from '../utils/planning/WorkCalendar.js';
import { isPlanTemplate } from '../utils/TemplateEngine.js';
import { validateProjectDraft } from './portfolioModel.js';

export const WIZARD_STEPS = ['details', 'start', 'building', 'levels', 'quantities', 'prices', 'schedule', 'links', 'review'];

/** Steps for the current choice: the full wizard for building templates. */
export const stepsFor = (state, template) => {
  if (state.kind === 'template' && template && isPlanTemplate(template)) return WIZARD_STEPS;
  if (state.kind === 'template') return ['details', 'start', 'building', 'review'];
  return ['details', 'start', 'review'];
};

/** A fresh wizard. */
export const createPlanner = ({ startDate, kind = 'template', templateId = '', values = {}, sourceId = '' } = {}) => ({
  details: { name: '', contract: '', location: '', startDate },
  kind,
  templateId,
  sourceId,
  values,
  levelOverrides: [],
  qtyOverrides: {},
  costOverrides: {},
  dropped: [],
  disabledLinks: [],
  markups: { ...DEFAULT_MARKUPS },
  calendarPreset: 'fridayHolidays',
  calendar: presetCalendar('fridayHolidays', startDate),
  productivity: {},
  crews: {},
  touched: false,
});

const withoutKey = (obj, key) => {
  const next = { ...obj };
  delete next[key];
  return next;
};
const blank = (v) => v === '' || v === null || v === undefined;
const toggle = (list, value) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
const PLAN_RESET = { levelOverrides: [], qtyOverrides: {}, costOverrides: {}, dropped: [], disabledLinks: [] };

/** Every change to the wizard. */
export const plannerReducer = (state, action) => {
  const s = { ...state, touched: true };
  switch (action.type) {
    case 'details': {
      const details = { ...state.details, ...action.patch };
      const moved = details.startDate !== state.details.startDate;
      return { ...s, details, calendar: moved && state.calendarPreset !== 'custom' ? presetCalendar(state.calendarPreset, details.startDate) : state.calendar };
    }
    case 'kind':
      return { ...s, kind: action.kind };
    case 'template':
      return { ...s, templateId: action.templateId, values: action.values || {}, ...PLAN_RESET };
    case 'source':
      return { ...s, sourceId: action.sourceId };
    case 'value': {
      // The basement shifts every level index: per-level changes no longer fit.
      const resetLevels = action.key === 'basement' && Number(action.value) !== Number(state.values.basement);
      return { ...s, values: { ...state.values, [action.key]: action.value }, levelOverrides: resetLevels ? [] : state.levelOverrides };
    }
    case 'level': {
      const list = [...state.levelOverrides];
      const next = { ...(list[action.index] || {}), ...action.patch };
      Object.keys(next).forEach((k) => blank(next[k]) && delete next[k]);
      list[action.index] = Object.keys(next).length ? next : null;
      return { ...s, levelOverrides: list };
    }
    case 'qty':
      return { ...s, qtyOverrides: blank(action.value) ? withoutKey(state.qtyOverrides, action.key) : { ...state.qtyOverrides, [action.key]: action.value } };
    case 'drop':
      return { ...s, dropped: toggle(state.dropped, action.key) };
    case 'cost':
      return { ...s, costOverrides: blank(action.value) ? withoutKey(state.costOverrides, action.key) : { ...state.costOverrides, [action.key]: action.value } };
    case 'markup':
      return { ...s, markups: { ...state.markups, [action.key]: action.value } };
    case 'calendarPreset':
      return { ...s, calendarPreset: action.preset, calendar: presetCalendar(action.preset, state.details.startDate) };
    case 'calendar':
      return { ...s, calendarPreset: 'custom', calendar: { ...state.calendar, ...action.patch } };
    case 'productivity':
      return { ...s, productivity: blank(action.value) ? withoutKey(state.productivity, action.workTypeId) : { ...state.productivity, [action.workTypeId]: action.value } };
    case 'crews':
      return { ...s, crews: blank(action.value) ? withoutKey(state.crews, action.trade) : { ...state.crews, [action.trade]: action.value } };
    case 'link':
      return { ...s, disabledLinks: toggle(state.disabledLinks, `${action.from}>${action.to}`) };
    default:
      return state;
  }
};

const numbers = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => !blank(v) && Number.isFinite(Number(v))).map(([k, v]) => [k, Number(v)]));

/** The options for planProject from the wizard state. */
export const planOptions = (state, { workTypes, rates, lang }) => ({
  startDate: state.details.startDate,
  lang,
  workTypes,
  rates,
  markups: numbers(state.markups),
  levelOverrides: state.levelOverrides,
  qtyOverrides: numbers(state.qtyOverrides),
  costOverrides: numbers(state.costOverrides),
  productivity: numbers(state.productivity),
  crews: numbers(state.crews),
  dropped: new Set(state.dropped),
  disabledLinks: new Set(state.disabledLinks),
  calendar: state.calendar,
});

/**
 * Why a step can't be left yet: {} or { name, startDate } (details),
 * { start: 'template' | 'copy' } (start).
 */
export const stepErrors = (state, step, template = null, source = null) => {
  if (step === 'details') return validateProjectDraft(state.details);
  if (step === 'start') {
    if (state.kind === 'template' && !template) return { start: 'template' };
    if (state.kind === 'copy' && !source) return { start: 'copy' };
  }
  return {};
};

/* ─────────────── calendar editing ─────────────── */

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Add a holiday range (to defaults to from). → the calendar patch, or null when invalid. */
export const addHoliday = (calendar, { from, to, name }) => {
  if (!ISO.test(from || '')) return null;
  const end = ISO.test(to || '') && to >= from ? to : from;
  const holidays = [...(calendar.holidays || []), { from, to: end, name: (name || '').trim() }].sort((a, b) => a.from.localeCompare(b.from));
  return { holidays };
};

export const removeHoliday = (calendar, index) => ({ holidays: (calendar.holidays || []).filter((_, i) => i !== index) });

/** Add a reduced-pace period (Ramadan): factor 0.05–1. → patch or null. */
export const addPeriod = (calendar, { from, to, factor, name }) => {
  const f = Number(factor);
  if (!ISO.test(from || '') || !ISO.test(to || '') || to < from || !(f > 0) || f > 1) return null;
  return { periods: [...(calendar.periods || []), { from, to, factor: Math.round(f * 100) / 100, name: (name || '').trim() }] };
};

export const removePeriod = (calendar, index) => ({ periods: (calendar.periods || []).filter((_, i) => i !== index) });

export const toggleRestDay = (calendar, weekday) => {
  const rest = new Set(calendar.weekRest || []);
  if (rest.has(weekday)) rest.delete(weekday);
  else rest.add(weekday);
  return { weekRest: [...rest].sort() };
};

/* ─────────────── summaries for the steps ─────────────── */

/** Items grouped the way the WBS will be: [{ key, label, items }] (level groups by index). */
export const groupItems = (plan, sectionLabel, levelLabel) => {
  if (!plan) return [];
  const groups = [];
  const byKey = new Map();
  plan.items.forEach((item) => {
    const key = item.levelIndex === null ? `s:${item.section}` : `l:${item.levelIndex}`;
    if (!byKey.has(key)) {
      const group = { key, label: item.levelIndex === null ? sectionLabel(item.section) : levelLabel(plan.levels[item.levelIndex]), items: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    byKey.get(key).items.push(item);
  });
  const order = (g) => {
    if (g.key.startsWith('l:')) return 100 + Number(g.key.slice(2));
    const idx = ['s:prelim', 's:sub'].indexOf(g.key);
    return idx >= 0 ? idx : 1000;
  };
  return groups.sort((a, b) => order(a) - order(b));
};

/**
 * Work types the plan uses, with their total quantity, item count and the
 * productivity in effect: [{ workTypeId, unit, trade, qty, count, productivity, crews: [min, max], days }].
 */
export const workTypesUsed = (plan, dropped = []) => {
  if (!plan) return [];
  const skip = new Set(dropped);
  const map = new Map();
  plan.items.forEach((it) => {
    if (skip.has(it.key)) return;
    const row = map.get(it.workTypeId) || { workTypeId: it.workTypeId, unit: it.unit, trade: it.trade, qty: 0, count: 0, productivity: it.productivity, crews: [Infinity, 0], days: 0 };
    row.qty += it.qty;
    row.count += 1;
    row.crews = [Math.min(row.crews[0], it.crews), Math.max(row.crews[1], it.crews)];
    row.days += it.duration;
    map.set(it.workTypeId, row);
  });
  return [...map.values()];
};

/** Trades in the plan: [{ trade, count, crews: [min, max] }] in first-use order. */
export const tradesUsed = (plan, dropped = []) => {
  const map = new Map();
  workTypesUsed(plan, dropped).forEach((w) => {
    const row = map.get(w.trade) || { trade: w.trade, count: 0, crews: [Infinity, 0] };
    row.count += w.count;
    row.crews = [Math.min(row.crews[0], w.crews[0]), Math.max(row.crews[1], w.crews[1])];
    map.set(w.trade, row);
  });
  return [...map.values()];
};

export const LONG_TASK_DAYS = 120;

/**
 * Things to look at before creating: [{ code, count?, names?, params? }]
 * codes: unpriced, noProductivity, longTasks, formula, unknownLink,
 * unknownWorkType, engine (schedule warnings), calendar.
 */
export const reviewWarnings = (plan, engine) => {
  const out = [];
  if (!plan) return out;
  const leaves = plan.tasks.filter((t) => !t.isGroup);
  if (plan.stats.unpriced.length) out.push({ code: 'unpriced', count: plan.stats.unpriced.length, names: plan.stats.unpriced.slice(0, 5) });
  if (plan.stats.noProductivity.length) out.push({ code: 'noProductivity', count: plan.stats.noProductivity.length, names: plan.stats.noProductivity.slice(0, 5) });
  const long = leaves.filter((t) => Number(t.duration) > LONG_TASK_DAYS);
  if (long.length) out.push({ code: 'longTasks', count: long.length, names: long.slice(0, 5).map((t) => t.name), params: { days: LONG_TASK_DAYS } });
  plan.issues.forEach((issue) => out.push({ code: issue.code, params: issue }));
  if (engine && engine.warnings.length) out.push({ code: 'engine', count: engine.warnings.length, names: engine.warnings.slice(0, 5).map((w) => `${w.wbs} ${w.name}`) });
  if (engine && engine.calendarIssues && engine.calendarIssues.length) out.push({ code: 'calendar', count: engine.calendarIssues.length });
  return out;
};
