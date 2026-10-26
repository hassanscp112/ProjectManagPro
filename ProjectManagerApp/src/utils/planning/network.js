// ─────────────────────────────────────────────────────────────
// network — the forward pass of the schedule (early dates).
//
// Runs on the working-time axis of a WorkCalendar (100 units = one normal
// working day). Each task starts at its own start date (manualStart or the
// project start) unless it has links; then it starts at the LATEST of its
// link constraints, and leveling links (crew hand-overs) can only delay it
// further. Link bounds, with lag L (working days, or calendar days when
// lagUnit is 'cd'):
//   FS  start ≥ pred.finish + L      SS  start ≥ pred.start + L
//   FF  finish ≥ pred.finish + L     SF  finish ≥ pred.start + L
//
// The traversal is an iterative depth-first walk in task order that
// reproduces the old recursive engine exactly — same warnings, same order,
// same cycle text, same "a task re-entered in a cycle falls back to its own
// start" rule — without recursion depth limits. Tested through
// __tests__/ganttEngine*.test.js and __tests__/network.test.js.
// ─────────────────────────────────────────────────────────────

import { UNITS_PER_DAY, dateOf, dayIndex } from './WorkCalendar.js';

/** Working time at the anchor of a link, shifted by its lag. */
export const shiftByLag = (cal, anchor, anchorIsFinish, link) => {
  if (link.lagUnit === 'cd' && !cal.isIdentity) {
    const day = anchorIsFinish ? cal.endDayOf(anchor) : cal.startDayOf(anchor);
    return cal.cum(day + link.lag);
  }
  return anchor + link.lag * UNITS_PER_DAY;
};

/** Latest allowed anchor of a predecessor for a successor value V (inverse of shiftByLag). */
export const unshiftByLag = (cal, value, link) => {
  if (link.lagUnit === 'cd' && !cal.isIdentity) return cal.cum(cal.lastDayAtOrBefore(value) - link.lag);
  return value - link.lag * UNITS_PER_DAY;
};

/** Earliest start a link allows (units), given the predecessor's ES/EF and the task's duration. */
export const linkBound = (cal, link, predES, predEF, durUnits) => {
  switch (link.type) {
    case 'SS':
      return shiftByLag(cal, predES, false, link);
    case 'FF':
      return shiftByLag(cal, predEF, true, link) - durUnits;
    case 'SF':
      return shiftByLag(cal, predES, false, link) - durUnits;
    case 'FS':
    default:
      return shiftByLag(cal, predEF, true, link);
  }
};

/**
 * The person's logic always wins over a crew hand-over: a leveling link
 * "T waits for P" is dropped when P itself (through logic links) comes after
 * T — a stale leveling result after the logic was edited. Mutates the
 * computed tasks' levelLinks; costs nothing when there are none.
 */
const dropStaleLevelLinks = (tasks, tasksById) => {
  const comesAfter = (p, t) => {
    const stack = [p];
    const seen = new Set();
    while (stack.length) {
      const x = stack.pop();
      if (x === t) return true;
      if (seen.has(x)) continue;
      seen.add(x);
      (x.links || []).forEach((l) => {
        const pred = tasksById.get(l.id);
        if (pred && pred !== x) stack.push(pred);
      });
    }
    return false;
  };
  tasks.forEach((t) => {
    if (!t.levelLinks || !t.levelLinks.length) return;
    t.levelLinks = t.levelLinks.filter((l) => {
      const p = tasksById.get(l.id);
      return !p || p === t || !comesAfter(p, t);
    });
  });
};

/**
 * Early dates for every computed task (groups included, before roll-up).
 * tasks carry `links` (normalized logic links) and `levelLinks`, plus the
 * parsed `duration` and `manualStart`. Sets startDate / endDate /
 * drivingLinkId on each task and returns { ES, EF } Maps (units).
 * `warn(task, code, params)` records a warning.
 */
export const forwardPass = (tasks, tasksById, { cal, projectStart, warn }) => {
  const ES = new Map();
  const EF = new Map();
  const state = new Map();
  const durUnits = (t) => t.duration * UNITS_PER_DAY;

  const baseline = (t) => {
    const k = dayIndex(t.manualStart || projectStart);
    const es = cal.cum(k);
    ES.set(t.id, es);
    EF.set(t.id, es + durUnits(t));
  };

  const finalize = (t, es) => {
    const ef = es + durUnits(t);
    ES.set(t.id, es);
    EF.set(t.id, ef);
    t.startDate = dateOf(cal.startDayOf(es));
    t.endDate = t.duration === 0 ? t.startDate : dateOf(cal.endDayOf(ef));
  };

  // One frame per task being resolved; the frames are the old recursion path.
  // A frame walks the logic links, then the leveling links (those are
  // silent: no warnings, and a cycle through one is simply ignored).
  const stack = [];
  const enter = (t, viaLevel = false) => {
    state.set(t.id, 'visiting');
    baseline(t);
    finalize(t, ES.get(t.id));
    const links = t.links || [];
    const level = t.levelLinks || [];
    stack.push({ t, viaLevel, items: level.length ? [...links, ...level] : links, logicCount: links.length, i: 0, best: null, levelBest: null, driving: null, pending: null });
  };
  const apply = (f, link, pred) => {
    const bound = linkBound(cal, link, ES.get(pred.id), EF.get(pred.id), durUnits(f.t));
    if (f.i >= f.logicCount) {
      if (f.levelBest === null || bound > f.levelBest) f.levelBest = bound;
    } else if (f.best === null || bound > f.best) {
      f.best = bound;
      f.driving = link.id;
    }
  };

  // True when the path from `pred` down to the current task was entered
  // through a leveling link.
  const throughLevelLink = (pred) => {
    for (let i = stack.length - 1; i >= 0 && stack[i].t !== pred; i--) if (stack[i].viaLevel) return true;
    return false;
  };

  const resolve = (root) => {
    if (state.get(root.id) === 'done') return;
    enter(root);
    while (stack.length) {
      const f = stack[stack.length - 1];
      if (f.pending) {
        apply(f, f.pending.link, f.pending.pred);
        f.pending = null;
        f.i += 1;
        continue;
      }
      if (f.i >= f.items.length) {
        let es = f.best === null ? ES.get(f.t.id) : f.best;
        if (f.levelBest !== null && f.levelBest > es) es = f.levelBest;
        finalize(f.t, es);
        f.t.drivingLinkId = f.driving;
        state.set(f.t.id, 'done');
        stack.pop();
        continue;
      }
      const link = f.items[f.i];
      if (f.i >= f.logicCount) {
        const pred = tasksById.get(link.id);
        const st = pred && pred.id !== f.t.id ? state.get(pred.id) : 'skip';
        if (st === 'done') {
          apply(f, link, pred);
          f.i += 1;
        } else if (st === 'visiting' || st === 'skip') {
          f.i += 1;
        } else {
          f.pending = { link, pred };
          enter(pred, true);
        }
        continue;
      }
      if (link.id === f.t.id) {
        warn(f.t, 'selfDependency', {});
        f.i += 1;
        continue;
      }
      const pred = tasksById.get(link.id);
      if (!pred) {
        warn(f.t, 'missingPredecessor', { id: link.id });
        f.i += 1;
        continue;
      }
      const st = state.get(pred.id);
      if (st === 'done') {
        apply(f, link, pred);
        f.i += 1;
      } else if (st === 'visiting' && throughLevelLink(pred)) {
        // A loop that passes through a crew hand-over contradicts the logic
        // (stale leveling): ignore this link rather than report a cycle.
        f.i += 1;
      } else if (st === 'visiting') {
        // Cycle: the re-entered task falls back to its own start date.
        const cycle = [...stack.map((x) => x.t), pred].map((item) => item.wbs || item.id).join(' > ');
        warn(pred, 'dependencyCycle', { cycle });
        baseline(pred);
        finalize(pred, ES.get(pred.id));
        state.set(pred.id, 'done');
        apply(f, link, pred);
        f.i += 1;
      } else {
        f.pending = { link, pred };
        enter(pred);
      }
    }
  };

  dropStaleLevelLinks(tasks, tasksById);
  tasks.forEach(resolve);
  return { ES, EF };
};
