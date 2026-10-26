// ─────────────────────────────────────────────────────────────
// resources — what a project has (crews per trade, site labour, equipment,
// People teams) and what each task uses, on the working-time axis.
//
// projectMeta.planning.resources (every part optional; absent = unlimited):
//   { crews:     { [trade]: count },      crews available per trade
//     labour:    count,                   people on site at once
//     equipment: { [type]: count },       crane, excavator, loader, pump …
//     teams:     { [trade]: [teamId] } }  People teams that are the crews
// A trade with teams but no crew count has as many crews as teams.
//
// A task uses: its crews of its trade ('crew:<trade>'), its people
// ('labour') and equipment ('eq:<type>') from task.resources (set when the
// plan is generated: crews × the work type's crew).
// Pure; tested in __tests__/resourceLeveler.test.js.
// ─────────────────────────────────────────────────────────────

import { UNITS_PER_DAY, dateOf, dayIndex } from './WorkCalendar.js';

export const crewKey = (trade) => `crew:${trade}`;
export const equipmentKey = (type) => `eq:${type}`;

/** What one task of `crews` crews of a work type uses: { labour, [equipment type]: n }. */
export const taskResources = (workType, crews = 1) => {
  if (!workType) return null;
  const n = Math.max(1, Number(crews) || 1);
  const out = {};
  const labour = Number(workType.crew?.labour) || 0;
  if (labour > 0) out.labour = labour * n;
  Object.entries(workType.crew?.equipment || {}).forEach(([type, count]) => {
    if (Number(count) > 0) out[type] = Number(count) * n;
  });
  return Object.keys(out).length ? out : null;
};

/** The project's limits: Map resource key → capacity (only the limited ones). */
export const capacitiesOf = (resources) => {
  const caps = new Map();
  if (!resources || typeof resources !== 'object') return caps;
  const trades = new Set([...Object.keys(resources.crews || {}), ...Object.keys(resources.teams || {})]);
  trades.forEach((trade) => {
    const count = Number(resources.crews?.[trade]);
    const teams = Array.isArray(resources.teams?.[trade]) ? resources.teams[trade].length : 0;
    const cap = count > 0 ? Math.floor(count) : teams;
    if (cap > 0) caps.set(crewKey(trade), cap);
  });
  if (Number(resources.labour) > 0) caps.set('labour', Math.floor(Number(resources.labour)));
  Object.entries(resources.equipment || {}).forEach(([type, count]) => {
    if (Number(count) > 0) caps.set(equipmentKey(type), Math.floor(Number(count)));
  });
  return caps;
};

/** What a task uses at once: Map resource key → amount (leaves with a trade or resources). */
export const demandOf = (task) => {
  const d = new Map();
  if (!task || task.isGroup) return d;
  if (task.trade) d.set(crewKey(task.trade), Math.max(1, Math.round(Number(task.crews) || 1)));
  Object.entries(task.resources || {}).forEach(([key, amount]) => {
    const n = Number(amount);
    if (!(n > 0)) return;
    d.set(key === 'labour' ? 'labour' : equipmentKey(key), n);
  });
  return d;
};

/** Every limited resource a task needs: [[key, amount]]. */
export const limitedDemand = (task, caps) => [...demandOf(task)].filter(([key]) => caps.has(key));

/**
 * Times a resource is used beyond its capacity, from scheduled tasks:
 * [{ resource, from, to (dates), demand, capacity, taskIds }], merged per
 * stretch. `timing` = { ES, EF } Maps of working-time units.
 */
export const findOverloads = (tasks, timing, caps, cal) => {
  if (!caps.size) return [];
  const byResource = new Map();
  tasks.forEach((t) => {
    if (t.isGroup || !timing.ES.has(t.id)) return;
    const s = timing.ES.get(t.id);
    const e = timing.EF.get(t.id);
    if (!(e > s)) return;
    limitedDemand(t, caps).forEach(([key, amount]) => {
      if (!byResource.has(key)) byResource.set(key, []);
      byResource.get(key).push({ t: s, d: amount, id: t.id }, { t: e, d: -amount, id: t.id });
    });
  });
  const out = [];
  byResource.forEach((events, key) => {
    const cap = caps.get(key);
    events.sort((a, b) => a.t - b.t || a.d - b.d); // ends before starts at the same time
    let usage = 0;
    const active = new Map();
    let open = null;
    events.forEach((ev, i) => {
      usage += ev.d;
      if (ev.d > 0) active.set(ev.id, ev.d);
      else active.delete(ev.id);
      const next = events[i + 1];
      if (next && next.t === ev.t) return; // settle all events at one time first
      if (usage > cap) {
        if (!open) open = { resource: key, start: ev.t, demand: usage, capacity: cap, ids: new Set(active.keys()) };
        open.demand = Math.max(open.demand, usage);
        active.forEach((_, id) => open.ids.add(id));
      } else if (open) {
        out.push({ ...open, end: ev.t });
        open = null;
      }
    });
  });
  return out.map((o) => ({
    resource: o.resource,
    from: dateOf(cal.startDayOf(o.start)),
    to: dateOf(cal.endDayOf(o.end)),
    demand: o.demand,
    capacity: o.capacity,
    taskIds: [...o.ids],
  }));
};

/**
 * Peak use per week for each resource (limited or not, as long as some task
 * uses it): [{ resource, capacity|null, weeks: [{ from: date, peak }] }].
 */
export const resourceHistogram = (tasks, timing, caps, cal, startDate, endDate, bucketDays = 7) => {
  const leaves = tasks.filter((t) => !t.isGroup && timing.ES.has(t.id));
  const keys = new Set();
  leaves.forEach((t) => demandOf(t).forEach((_, key) => keys.add(key)));
  if (!keys.size || !startDate || !endDate) return [];
  const first = dayIndex(startDate);
  const last = dayIndex(endDate);
  if (first === null || last === null) return [];
  const buckets = [];
  for (let k = first; k <= last; k += bucketDays) buckets.push(k);
  return [...keys].sort().map((key) => {
    const uses = leaves
      .map((t) => ({ s: timing.ES.get(t.id), e: timing.EF.get(t.id), d: demandOf(t).get(key) || 0 }))
      .filter((u) => u.d > 0 && u.e > u.s);
    const weeks = buckets.map((k) => {
      const a = cal.cum(k);
      const b = cal.cum(k + bucketDays);
      // Peak = the most in use at any time in the week (checked at each start inside it).
      const points = [a, ...uses.map((u) => u.s).filter((s) => s > a && s < b)];
      const peak = points.reduce((m, p) => Math.max(m, uses.reduce((sum, u) => sum + (u.s <= p && p < u.e ? u.d : 0), 0)), 0);
      return { from: dateOf(k), peak };
    });
    return { resource: key, capacity: caps.has(key) ? caps.get(key) : null, weeks };
  });
};

export { UNITS_PER_DAY };
