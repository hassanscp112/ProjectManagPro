// ─────────────────────────────────────────────────────────────
// CriticalPath — CPM backward pass over the computed schedule.
//
// The forward pass (early dates) already exists in GanttEngine:
//   startDate / endDate are the early start/finish of each leaf.
// This module walks the network backwards from the project end to
// compute latest finish (LF) per leaf, derives latest start
// (LS = LF − duration) and total float (LS − ES). Zero-float
// leaves form the critical path.
//
// Every link counts (all predecessors, plus leveling links — so after
// leveling the path is resource-critical). Times are working-time units
// of the project calendar (100 = one working day), so float is in
// working days. Constraint inversions per successor S (lag L):
//   FS: T.LF ≤ S.LS − L
//   SS: T.LS ≤ S.LS − L   → T.LF ≤ S.LS − L + T.dur
//   FF: T.LF ≤ S.LF − L
//   SF: T.LS ≤ S.LF − L   → T.LF ≤ S.LF − L + T.dur
// An acyclic network is solved in one reverse topological pass; a network
// with a cycle falls back to the old relaxation (same results as before).
// ─────────────────────────────────────────────────────────────

import { readLevelLinks, readLinks } from './planning/links.js';
import { unshiftByLag } from './planning/network.js';
import { UNITS_PER_DAY, dayIndex, identityCalendar } from './planning/WorkCalendar.js';

const linksOf = (t) => {
  const logic = Array.isArray(t.links) ? t.links : readLinks(t).map((l) => ({ ...l, lag: Number(l.lag) || 0 }));
  const level = Array.isArray(t.levelLinks) && t.links ? t.levelLinks : readLevelLinks(t).map((l) => ({ ...l, type: 'FS', lag: Number(l.lag) || 0 }));
  return level.length ? [...logic, ...level] : logic;
};

/**
 * @param {Array} computedTasks — engine output (needs id, isGroup, startDate,
 *   endDate and links — or dependsOn/depType/lag — on leaves)
 * @param {{ cal, ES: Map, EF: Map }} [timing] — the forward pass in working
 *   units; without it, every day counts (dates give the times)
 * @returns {{ criticalIds: Set<string>, floatById: Map<string, number> }}
 *   floatById is in whole working days; groups are excluded. Cycles /
 *   unresolved dates degrade gracefully, never throw.
 */
export const computeCriticalPath = (computedTasks, timing = null) => {
  const empty = { criticalIds: new Set(), floatById: new Map() };
  if (!Array.isArray(computedTasks) || computedTasks.length === 0) return empty;

  const leaves = computedTasks.filter(
    (t) => !t.isGroup && t.startDate && t.endDate && dayIndex(t.startDate) != null && dayIndex(t.endDate) != null
  );
  if (leaves.length === 0) return empty;

  const cal = (timing && timing.cal) || identityCalendar();
  const esOf = new Map();
  const durOf = new Map();
  leaves.forEach((t) => {
    const es = timing && timing.ES.has(t.id) ? timing.ES.get(t.id) : dayIndex(t.startDate) * UNITS_PER_DAY;
    const ef = timing && timing.EF.has(t.id) ? timing.EF.get(t.id) : dayIndex(t.endDate) * UNITS_PER_DAY;
    esOf.set(t.id, es);
    durOf.set(t.id, Math.max(0, ef - es));
  });

  // Successors: S links to T ⇒ S constrains T's latest dates.
  const byId = new Map(leaves.map((t) => [t.id, t]));
  const successors = new Map(leaves.map((t) => [t.id, []]));
  const indegree = new Map(leaves.map((t) => [t.id, 0]));
  leaves.forEach((s) => {
    linksOf(s).forEach((link) => {
      if (link.id === s.id || !byId.has(link.id)) return;
      successors.get(link.id).push({ s, link });
      indegree.set(s.id, indegree.get(s.id) + 1);
    });
  });

  const projectEnd = leaves.reduce((max, t) => Math.max(max, esOf.get(t.id) + durOf.get(t.id)), -Infinity);
  const latestFinish = new Map(leaves.map((t) => [t.id, projectEnd]));
  const latestStartOf = (t) => latestFinish.get(t.id) - durOf.get(t.id);

  const boundFrom = (t, { s, link }) => {
    const myDur = durOf.get(t.id);
    switch (link.type) {
      case 'SS':
        return unshiftByLag(cal, latestStartOf(s), link) + myDur;
      case 'FF':
        return unshiftByLag(cal, latestFinish.get(s.id), link);
      case 'SF':
        return unshiftByLag(cal, latestFinish.get(s.id), link) + myDur;
      case 'FS':
      default:
        return unshiftByLag(cal, latestStartOf(s), link);
    }
  };

  // Topological order (Kahn). Complete ⇒ acyclic ⇒ one reverse pass.
  const order = [];
  const queue = leaves.filter((t) => indegree.get(t.id) === 0);
  for (let i = 0; i < queue.length; i++) {
    const t = queue[i];
    order.push(t);
    successors.get(t.id).forEach(({ s }) => {
      const left = indegree.get(s.id) - 1;
      indegree.set(s.id, left);
      if (left === 0) queue.push(s);
    });
  }

  if (order.length === leaves.length) {
    for (let i = order.length - 1; i >= 0; i--) {
      const t = order[i];
      let lf = latestFinish.get(t.id);
      for (const edge of successors.get(t.id)) {
        const bound = boundFrom(t, edge);
        if (bound < lf) lf = bound;
      }
      latestFinish.set(t.id, lf);
    }
  } else {
    // Relaxation to fixpoint. Visiting in reverse array order converges fast
    // (dependencies usually point backwards); the iteration cap guards cycles.
    const ordered = [...leaves].reverse();
    for (let iteration = 0; iteration < leaves.length + 1; iteration++) {
      let changed = false;
      for (const t of ordered) {
        let lf = latestFinish.get(t.id);
        for (const edge of successors.get(t.id)) {
          const bound = boundFrom(t, edge);
          if (bound < lf) {
            lf = bound;
            changed = true;
          }
        }
        latestFinish.set(t.id, lf);
      }
      if (!changed) break;
    }
  }

  const criticalIds = new Set();
  const floatById = new Map();
  leaves.forEach((t) => {
    const floatDays = Math.round((latestStartOf(t) - esOf.get(t.id)) / UNITS_PER_DAY) || 0; // `|| 0` turns -0 into 0
    floatById.set(t.id, floatDays);
    if (floatDays <= 0) criticalIds.add(t.id);
  });

  return { criticalIds, floatById };
};
