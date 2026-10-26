// ─────────────────────────────────────────────────────────────
// Productivity — what the site really does, learned from APPROVED quantity
// orders (the only record of executed work).
//
//   paceByTask(tasks, orders, ctx)    one item's pace: quantity per working
//                                     day with approved orders, and per crew
//                                     (crews from that day's Lookahead plan:
//                                     people ÷ the work type's crew size;
//                                     else the item's planned crews)
//   paceByWorkType(paces, tasks)      the same pooled per work type
//   learnedProductivity(projects, workTypes)
//                                     per work type across projects: the
//                                     median per-crew pace of its items, and
//                                     a suggestion when it differs from the
//                                     library by more than 15 % over at
//                                     least 5 working days
//   acceptLearned(workType, learned)  the work type with the learned value
//                                     (old value kept in its history)
//   retimePatches(...)                not-started items of that type re-timed
//   daysLeftAtPace / suggestedCrews   Lookahead helpers
//
// Nothing changes by itself: a person accepts a suggestion. Pure (storage
// is passed in by the callers). Tested in __tests__/productivity.test.js.
// ─────────────────────────────────────────────────────────────

import { durationFor } from './planning/WorkTypes.js';

export const LEARN_MIN_DAYS = 5;
export const LEARN_THRESHOLD = 0.15;

const round2 = (n) => Math.round(n * 100) / 100;
const positive = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** People in a Lookahead "who": a count, a team's size, or the picked workers. */
export const peopleOf = (who, registries = {}) => {
  if (!who || typeof who !== 'object') return 0;
  if (who.kind === 'count') return positive(who.count);
  if (who.kind === 'workers') return Array.isArray(who.workerIds) ? who.workerIds.length : 0;
  if (who.kind === 'team') {
    const team = (registries.teams || []).find((x) => x.id === who.teamId);
    if (!team) return 0;
    return positive(team.defaultSize) || (Array.isArray(team.memberWorkerIds) ? team.memberWorkerIds.length : 0);
  }
  return 0;
};

/** Approved quantity per task per work date: Map taskId → Map date → qty. */
export const approvedByTaskDate = (orders = []) => {
  const map = new Map();
  (Array.isArray(orders) ? orders : []).forEach((o) => {
    if (!o || o.family !== 'value' || o.status !== 'approved' || !o.taskId || !o.date) return;
    const q = positive(o.quantity);
    if (!q) return;
    if (!map.has(o.taskId)) map.set(o.taskId, new Map());
    const days = map.get(o.taskId);
    days.set(o.date, (days.get(o.date) || 0) + q);
  });
  return map;
};

/**
 * Each item's pace: Map taskId → { qty, days, crewDays, perDay, perCrewDay,
 * from, to, crewsFromPlans }. ctx: { plans (Lookahead { days }), workTypes
 * (Map), registries }. Items without approved orders are absent.
 */
export const paceByTask = (tasks = [], orders = [], { plans = null, workTypes = new Map(), registries = {} } = {}) => {
  const byTask = approvedByTaskDate(orders);
  const dayPlans = plans?.days || {};
  const out = new Map();
  tasks.forEach((task) => {
    if (!task || task.isGroup) return;
    const dates = byTask.get(task.id);
    if (!dates) return;
    const crewLabour = positive(workTypes.get(task.workTypeId)?.crew?.labour);
    const planned = Math.max(1, Math.round(positive(task.crews) || 1));
    let qty = 0;
    let crewDays = 0;
    let crewsFromPlans = 0;
    dates.forEach((q, date) => {
      qty += q;
      const people = (dayPlans[date]?.assignments || []).filter((a) => a && a.taskId === task.id).reduce((n, a) => n + peopleOf(a.who, registries), 0);
      if (people > 0 && crewLabour > 0) {
        crewDays += people / crewLabour;
        crewsFromPlans += 1;
      } else {
        crewDays += planned;
      }
    });
    const sorted = [...dates.keys()].sort();
    out.set(task.id, {
      qty,
      days: dates.size,
      crewDays,
      perDay: qty / dates.size,
      perCrewDay: crewDays > 0 ? qty / crewDays : 0,
      from: sorted[0],
      to: sorted[sorted.length - 1],
      crewsFromPlans,
    });
  });
  return out;
};

/** Pooled pace per work type: Map workTypeId → { qty, days, crewDays, perCrewDay, taskIds }. */
export const paceByWorkType = (paces, tasks = []) => {
  const out = new Map();
  tasks.forEach((task) => {
    const p = paces.get(task.id);
    if (!p || !task.workTypeId) return;
    const row = out.get(task.workTypeId) || { workTypeId: task.workTypeId, qty: 0, days: 0, crewDays: 0, perCrewDay: 0, taskIds: [] };
    row.qty += p.qty;
    row.days += p.days;
    row.crewDays += p.crewDays;
    row.taskIds.push(task.id);
    row.perCrewDay = row.crewDays > 0 ? row.qty / row.crewDays : 0;
    out.set(task.workTypeId, row);
  });
  return out;
};

const median = (values) => {
  const v = [...values].sort((a, b) => a - b);
  if (!v.length) return 0;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};

/**
 * What the library should say, per work type, from every project:
 * projects = [{ project, tasks, orders, plans }], registries global.
 * → Map workTypeId → { workTypeId, rate (median per crew-day, 2 dp), days,
 *   samples, projects, current, change (rate ÷ current − 1, null without a
 *   current value), suggest }.
 */
export const learnedProductivity = (projects = [], workTypes = new Map(), registries = {}) => {
  const samples = new Map();
  projects.forEach(({ project, tasks = [], orders = [], plans = null }) => {
    const paces = paceByTask(tasks, orders, { plans, workTypes, registries });
    tasks.forEach((task) => {
      const p = paces.get(task.id);
      if (!p || !task.workTypeId || !(p.perCrewDay > 0)) return;
      if (!samples.has(task.workTypeId)) samples.set(task.workTypeId, []);
      samples.get(task.workTypeId).push({ rate: p.perCrewDay, days: p.days, projectId: project?.id || '' });
    });
  });
  const out = new Map();
  samples.forEach((list, workTypeId) => {
    const rate = round2(median(list.map((x) => x.rate)));
    const days = list.reduce((n, x) => n + x.days, 0);
    const current = positive(workTypes.get(workTypeId)?.productivity);
    const change = current ? rate / current - 1 : null;
    out.set(workTypeId, {
      workTypeId,
      rate,
      days,
      samples: list.length,
      projects: new Set(list.map((x) => x.projectId)).size,
      current,
      change,
      suggest: days >= LEARN_MIN_DAYS && rate > 0 && (change === null || Math.abs(change) > LEARN_THRESHOLD),
    });
  });
  return out;
};

/** The work type after a person accepts what was learned (history kept). */
export const acceptLearned = (workType, learned, { at = new Date().toISOString(), by = '' } = {}) => ({
  ...workType,
  productivity: learned.rate,
  learned: { rate: learned.rate, days: learned.days, samples: learned.samples, projects: learned.projects, at },
  history: [...(Array.isArray(workType.history) ? workType.history : []), { at, by, field: 'productivity', from: workType.productivity, to: learned.rate, source: 'learned', days: learned.days }],
});

/**
 * Items of a work type that haven't started (no executed quantity), aren't
 * pinned and are timed by productivity, re-timed at a new productivity:
 * [{ id, patch: { productivity, duration } }]. computedById: engine tasks.
 */
export const retimePatches = (tasks = [], computedById = new Map(), workTypeId, productivity) =>
  tasks
    .filter((t) => !t.isGroup && t.workTypeId === workTypeId && !t.pinned && (t.durationSource || 'productivity') === 'productivity')
    .filter((t) => !(computedById.get(t.id)?.actualQty > 0))
    .map((t) => {
      const duration = durationFor(t.quantity, { productivity, crews: t.crews });
      if (duration === null || (duration === Number(t.duration) && productivity === Number(t.productivity))) return null;
      return { id: t.id, patch: { productivity, duration } };
    })
    .filter(Boolean);

/** Working days still needed at the item's own pace (null without a pace). */
export const daysLeftAtPace = (remainingQty, pace) => {
  if (!pace || !(pace.perDay > 0)) return null;
  const left = Math.max(0, Number(remainingQty) || 0);
  return left === 0 ? 0 : Math.ceil(left / pace.perDay);
};

/**
 * Crews to plan for an item: its planned daily quantity (qty ÷ duration)
 * over what one crew does a day — the observed pace when there is one,
 * else the planned productivity. → { crews, people, basis } | null.
 */
export const suggestedCrews = (task, { pace = null, workType = null } = {}) => {
  const qty = positive(task?.quantity ?? task?.qty);
  const duration = positive(task?.duration);
  if (!qty || !duration) return null;
  const observed = pace?.perCrewDay > 0 ? pace.perCrewDay : 0;
  const perCrew = observed || positive(task.productivity) || positive(workType?.productivity);
  if (!perCrew) return null;
  const crews = Math.max(1, Math.ceil(qty / duration / perCrew - 1e-9));
  const labour = positive(workType?.crew?.labour);
  return { crews, people: labour ? crews * labour : null, basis: observed ? 'observed' : 'planned', perCrew: round2(perCrew) };
};
