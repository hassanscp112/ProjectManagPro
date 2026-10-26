// ─────────────────────────────────────────────────────────────
// ResourceLeveler — fit the schedule to the crews, people and equipment the
// project has (projectMeta.planning.resources, see resources.js).
//
// Leveling is an explicit action, never part of calculate():
//   1. Fit crews: a task asking for more crews (or the people / equipment
//      they bring) than the project has gets fewer crews, and a longer
//      duration when it is productivity-driven.
//   2. Fixed work is never moved: pinned tasks, started or finished ones
//      (orders recorded), and everything they wait for.
//   3. Serial schedule generation on the working-time axis: tasks in logic
//      order, the one with the least room first (latest start, then early
//      start, then list order); each starts at the first moment its links
//      allow AND every limited resource it needs is free for its whole
//      duration.
//   4. The result is written as leveling links (task.levelLinks, FS 0 to at
//      most three tasks that free the resource: "waits for the masonry crew
//      of floor 1"), so the engine reproduces it and the person's own links
//      stay untouched. Clear removes them.
//   5. People teams named as a trade's crews are given to the tasks
//      (task.teamIds), the team a task waits for first.
//
// levelResources(tasks, ctx) → { patches: [{ id, patch }], tasks, before,
// after, report }; clearLeveling(tasks, ctx) → { patches, count }.
// ctx: { projectStart, meta, orders }. Pure; tested in
// __tests__/resourceLeveler.test.js.
// ─────────────────────────────────────────────────────────────

import { GanttEngine } from '../GanttEngine.js';
import { readLevelLinks, readLinks } from './links.js';
import { linkBound } from './network.js';
import { capacitiesOf, demandOf } from './resources.js';
import { UNITS_PER_DAY, dayIndex, getCalendar } from './WorkCalendar.js';
import { durationFor } from './WorkTypes.js';

const MAX_WAITS = 3;
const wholeDuration = (task) => Math.max(0, parseInt(task.duration, 10) || 0);
const sameList = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);

/**
 * Tasks leveling must not move: pinned, started or done (from the computed
 * tasks: executed quantity > 0), and — so they really stay put — every task
 * they wait for, through logic links and their own leveling links.
 */
export const fixedTaskIds = (tasks, computed) => {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const seeds = computed.filter((c) => c.pinned || c.actualQty > 0).map((c) => c.id);
  const fixed = new Set();
  const stack = [...seeds];
  while (stack.length) {
    const id = stack.pop();
    if (fixed.has(id) || !byId.has(id)) continue;
    fixed.add(id);
    const t = byId.get(id);
    [...readLinks(t), ...readLevelLinks(t)].forEach((l) => {
      if (byId.has(l.id) && !fixed.has(l.id)) stack.push(l.id);
    });
  }
  return fixed;
};

// Crews a task can have within the limits (null = no limit applies).
const crewsAllowed = (task, caps) => {
  const crews = Math.max(1, Math.round(Number(task.crews) || 1));
  let allowed = null;
  demandOf(task).forEach((amount, key) => {
    if (!caps.has(key)) return;
    const perCrew = amount / crews;
    const n = perCrew > 0 ? Math.floor(caps.get(key) / perCrew + 1e-9) : Infinity;
    allowed = allowed === null ? n : Math.min(allowed, n);
  });
  return allowed;
};

/** Step 1: fewer crews where the project hasn't enough. → { patch, change } | null */
const fitCrews = (task, caps) => {
  if (!task.trade || task.isGroup) return null;
  const crews = Math.max(1, Math.round(Number(task.crews) || 1));
  const allowed = crewsAllowed(task, caps);
  if (allowed === null || allowed >= crews) return null;
  const next = Math.max(1, allowed);
  if (next === crews) return null;
  const patch = { crews: next };
  if (task.resources && typeof task.resources === 'object') {
    patch.resources = Object.fromEntries(Object.entries(task.resources).map(([k, v]) => [k, Math.round(((Number(v) || 0) / crews) * next * 100) / 100]));
  }
  if ((task.durationSource || 'productivity') === 'productivity') {
    const days = durationFor(task.quantity, { productivity: task.productivity, crews: next });
    if (days !== null) patch.duration = days;
  }
  return { patch, change: { crews: [crews, next], duration: [wholeDuration(task), patch.duration ?? wholeDuration(task)] } };
};

// Use of one resource: intervals [s, e) with an amount.
const peakUse = (list, a, b) => {
  const events = [];
  list.forEach((u) => {
    if (u.s < b && u.e > a) events.push([Math.max(u.s, a), u.amount], [u.e, -u.amount]);
  });
  events.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  let use = 0;
  let peak = 0;
  events.forEach(([, d]) => {
    use += d;
    if (use > peak) peak = use;
  });
  return peak;
};

/**
 * The leveled schedule. Returns the patches to apply (one undo step), the
 * leveled task list, the engine results before and after, and a report:
 * { blocked: null | 'noLimits' | 'cycle', endBefore, endAfter, daysBefore,
 *   daysAfter, moved: [{ id, from, to, days, waitsFor }], crewChanges,
 *   conflicts: [{ code: 'tooBig', id, resource, demand, capacity }],
 *   remaining: overloads left (fixed work), fixedCount, linkCount }.
 */
export const levelResources = (tasks, { projectStart, meta = {}, orders = [] } = {}) => {
  const planning = meta?.planning || {};
  const caps = capacitiesOf(planning.resources);
  const cal = getCalendar(planning.calendar);
  const before = GanttEngine.calculate(tasks, projectStart, meta, orders);
  const report = {
    blocked: null,
    endBefore: before.scheduleEndDate,
    endAfter: before.scheduleEndDate,
    daysBefore: before.projectWorkingDays,
    daysAfter: before.projectWorkingDays,
    moved: [],
    crewChanges: [],
    conflicts: [],
    remaining: before.overloads || [],
    fixedCount: 0,
    linkCount: 0,
  };
  if (!caps.size) return { patches: [], tasks, before, after: before, report: { ...report, blocked: 'noLimits' } };
  if (before.warnings.some((w) => w.code === 'dependencyCycle')) return { patches: [], tasks, before, after: before, report: { ...report, blocked: 'cycle' } };

  const fixed = fixedTaskIds(tasks, before.tasks);
  report.fixedCount = fixed.size;

  // 1. Crews within the limits; movable tasks lose their old leveling.
  const base = tasks.map((t) => {
    if (fixed.has(t.id)) return t;
    const fit = fitCrews(t, caps);
    if (fit) report.crewChanges.push({ id: t.id, ...fit.change });
    const next = { ...t, ...(fit ? fit.patch : {}) };
    delete next.levelLinks;
    delete next.teamIds;
    return next;
  });
  const logic = GanttEngine.calculate(base, projectStart, meta, orders);
  const comp = logic.tasks;
  const index = new Map(comp.map((c, i) => [c.id, i]));
  const n = comp.length;

  // 2. Fixed work first, where it is.
  const S = new Array(n).fill(null);
  const F = new Array(n).fill(null);
  const durOf = (i) => wholeDuration(base[i]) * UNITS_PER_DAY;
  const uses = new Map(); // resource → [{ s, e, amount, i }]
  const place = (i, s, demand) => {
    S[i] = s;
    F[i] = s + durOf(i);
    if (F[i] <= s) return;
    demand.forEach(([key, amount]) => {
      if (!uses.has(key)) uses.set(key, []);
      uses.get(key).push({ s, e: F[i], amount, i });
    });
  };
  const limitedOf = (i) => [...demandOf(comp[i])].filter(([key]) => caps.has(key));
  comp.forEach((c, i) => {
    if (fixed.has(c.id)) place(i, logic.timing.ES.get(c.id), limitedOf(i));
  });

  // 3. Everything else in logic order, least room first.
  // (Fixed work never waits for movable work — see fixedTaskIds.)
  const preds = comp.map((c) => (fixed.has(c.id) ? [] : c.links.filter((l) => l.id !== c.id && index.has(l.id))));
  const succs = comp.map(() => []);
  const waiting = preds.map((list, i) => {
    const open = [...new Set(list.map((l) => l.id))].filter((id) => !fixed.has(id));
    open.forEach((id) => succs[index.get(id)].push(i));
    return open.length;
  });
  const earlyStart = comp.map((c) => logic.timing.ES.get(c.id));
  const lateStart = comp.map((c, i) => earlyStart[i] + (Number.isFinite(c.totalFloat) ? c.totalFloat * UNITS_PER_DAY : 0));
  const comesFirst = (a, b) => lateStart[a] - lateStart[b] || earlyStart[a] - earlyStart[b] || a - b;
  const ready = comp.map((c, i) => i).filter((i) => !fixed.has(comp[i].id) && waiting[i] === 0);
  const waitsFor = new Map();
  while (ready.length) {
    let at = 0;
    for (let k = 1; k < ready.length; k++) if (comesFirst(ready[k], ready[at]) < 0) at = k;
    const i = ready[at];
    ready.splice(at, 1);
    const c = comp[i];
    const dur = durOf(i);
    let es = null;
    preds[i].forEach((l) => {
      const p = index.get(l.id);
      const bound = linkBound(cal, l, S[p], F[p], dur);
      if (es === null || bound > es) es = bound;
    });
    if (es === null) es = cal.cum(dayIndex(c.manualStart));

    const demand = dur > 0
      ? limitedOf(i).map(([key, amount]) => {
          const capacity = caps.get(key);
          if (amount > capacity) report.conflicts.push({ code: 'tooBig', id: c.id, resource: key, demand: amount, capacity });
          return [key, Math.min(amount, capacity)];
        })
      : [];
    let start = es;
    if (demand.length) {
      const fits = (t) => demand.every(([key, amount]) => peakUse(uses.get(key) || [], t, t + dur) + amount <= caps.get(key));
      if (!fits(es)) {
        const candidates = [...new Set(demand.flatMap(([key]) => (uses.get(key) || []).map((u) => u.e)).filter((e) => e > es))].sort((a, b) => a - b);
        start = candidates.find(fits) ?? candidates[candidates.length - 1] ?? es;
        // Wait for the tasks that free the resource at that moment.
        const keys = new Set(demand.map(([key]) => key));
        const freeing = [...keys].flatMap((key) => (uses.get(key) || []).filter((u) => u.e === start).map((u) => ({ i: u.i, crew: key.startsWith('crew:') })));
        const picked = [];
        freeing
          .sort((a, b) => Number(b.crew) - Number(a.crew) || a.i - b.i)
          .forEach((f) => {
            if (picked.length < MAX_WAITS && !picked.includes(f.i)) picked.push(f.i);
          });
        if (picked.length) waitsFor.set(i, picked);
      }
    }
    place(i, start, demand);
    succs[i].forEach((j) => {
      waiting[j] -= 1;
      if (waiting[j] === 0) ready.push(j);
    });
  }

  // 4. Leveling links, 5. People teams.
  const teamsOf = planning.resources?.teams || {};
  const teamIds = new Map();
  Object.entries(teamsOf).forEach(([trade, list]) => {
    const teams = (Array.isArray(list) ? list : []).filter(Boolean);
    if (!teams.length) return;
    const busy = new Map(teams.map((id) => [id, -Infinity]));
    const order = comp.map((c, i) => i).filter((i) => comp[i].trade === trade && !comp[i].isGroup && S[i] !== null);
    order.sort((a, b) => S[a] - S[b] || a - b);
    order.forEach((i) => {
      const c = comp[i];
      if (fixed.has(c.id)) {
        (Array.isArray(c.teamIds) ? c.teamIds : []).forEach((id) => busy.has(id) && busy.set(id, Math.max(busy.get(id), F[i])));
        return;
      }
      const need = Math.max(1, Math.round(Number(c.crews) || 1));
      const preferred = (waitsFor.get(i) || []).flatMap((p) => teamIds.get(p) || []);
      const free = [...new Set([...preferred, ...teams])].filter((id) => busy.has(id) && busy.get(id) <= S[i]);
      const chosen = free.slice(0, need);
      chosen.forEach((id) => busy.set(id, F[i]));
      if (chosen.length) teamIds.set(i, chosen);
    });
  });

  const leveled = base.map((t, i) => {
    if (fixed.has(t.id)) return t;
    const next = { ...t };
    const waits = waitsFor.get(i);
    if (waits) next.levelLinks = waits.map((p) => ({ id: comp[p].id, type: 'FS', lag: 0 }));
    if (teamIds.has(i)) next.teamIds = teamIds.get(i);
    return next;
  });

  const patches = [];
  tasks.forEach((t, i) => {
    const next = leveled[i];
    const patch = {};
    if (!sameList(readLevelLinks(t), readLevelLinks(next))) patch.levelLinks = next.levelLinks;
    if (!sameList(t.teamIds, next.teamIds)) patch.teamIds = next.teamIds;
    ['crews', 'duration', 'resources'].forEach((k) => {
      if (JSON.stringify(t[k]) !== JSON.stringify(next[k])) patch[k] = next[k];
    });
    if (Object.keys(patch).length) patches.push({ id: t.id, patch });
  });

  const after = GanttEngine.calculate(leveled, projectStart, meta, orders);
  const beforeById = new Map(before.tasks.map((c) => [c.id, c]));
  after.tasks.forEach((c, i) => {
    const old = beforeById.get(c.id);
    if (c.isGroup || !old || old.startDate === c.startDate) return;
    const days = (after.timing.ES.get(c.id) - before.timing.ES.get(c.id)) / UNITS_PER_DAY;
    report.moved.push({ id: c.id, from: old.startDate, to: c.startDate, days, waitsFor: (waitsFor.get(i) || []).map((p) => comp[p].id) });
  });
  report.moved.sort((a, b) => b.days - a.days);
  report.endAfter = after.scheduleEndDate;
  report.daysAfter = after.projectWorkingDays;
  report.remaining = after.overloads;
  report.linkCount = waitsFor.size;
  // The engine must reproduce the leveled starts exactly (0 = it does).
  report.mismatch = after.tasks.filter((c, i) => S[i] !== null && after.timing.ES.get(c.id) !== S[i]).length;
  return { patches, tasks: leveled, before, after, report };
};

/** Take the leveling out again (fixed work keeps its own). → { patches, count } */
export const clearLeveling = (tasks, { projectStart, meta = {}, orders = [] } = {}) => {
  const computed = GanttEngine.calculate(tasks, projectStart, meta, orders);
  const fixed = fixedTaskIds(tasks, computed.tasks);
  const patches = [];
  tasks.forEach((t) => {
    if (fixed.has(t.id)) return;
    const patch = {};
    if (t.levelLinks !== undefined) patch.levelLinks = undefined;
    if (t.teamIds !== undefined) patch.teamIds = undefined;
    if (Object.keys(patch).length) patches.push({ id: t.id, patch });
  });
  return { patches, count: patches.length };
};
