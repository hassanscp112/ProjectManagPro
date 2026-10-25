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
// Constraint inversions per successor S (with lag, in days):
//   FS: T.LF ≤ S.LS − lag
//   SS: T.LS ≤ S.LS − lag   → T.LF ≤ S.LS − lag + T.dur
//   FF: T.LF ≤ S.LF − lag
//   SF: T.LS ≤ S.LF − lag   → T.LF ≤ S.LF − lag + T.dur
// ─────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

const toMs = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some((p) => !Number.isFinite(p))) return null;
  return Date.UTC(parts[0], parts[1] - 1, parts[2]);
};

/**
 * @param {Array} computedTasks — engine output (needs id, isGroup, startDate,
 *   endDate, dependsOn, depType, lag on leaves)
 * @returns {{ criticalIds: Set<string>, floatById: Map<string, number> }}
 *   floatById is in whole days; groups are excluded. Cycles / unresolved
 *   dates degrade gracefully (empty result), never throw.
 */
export const computeCriticalPath = (computedTasks) => {
  const empty = { criticalIds: new Set(), floatById: new Map() };
  if (!Array.isArray(computedTasks) || computedTasks.length === 0) return empty;

  const leaves = computedTasks.filter(
    (t) => !t.isGroup && t.startDate && t.endDate && toMs(t.startDate) != null && toMs(t.endDate) != null
  );
  if (leaves.length === 0) return empty;

  const byId = new Map(leaves.map((t) => [t.id, t]));
  const durMs = new Map(leaves.map((t) => [t.id, Math.max(0, toMs(t.endDate) - toMs(t.startDate))]));

  // Successors: S depends on T ⇒ S constrains T's latest dates.
  const successors = new Map(leaves.map((t) => [t.id, []]));
  leaves.forEach((t) => {
    if (t.dependsOn && byId.has(t.dependsOn) && t.dependsOn !== t.id) {
      successors.get(t.dependsOn).push(t);
    }
  });

  const projectEndMs = leaves.reduce((max, t) => Math.max(max, toMs(t.endDate)), -Infinity);
  const latestFinish = new Map(leaves.map((t) => [t.id, projectEndMs]));
  const latestStartOf = (t) => latestFinish.get(t.id) - durMs.get(t.id);

  // Relaxation to fixpoint. Visiting in reverse array order converges fast
  // (dependencies usually point backwards); the iteration cap guards cycles.
  const ordered = [...leaves].reverse();
  for (let iteration = 0; iteration < leaves.length + 1; iteration++) {
    let changed = false;
    for (const t of ordered) {
      let lf = latestFinish.get(t.id);
      for (const s of successors.get(t.id)) {
        const lag = Number(s.lag) || 0;
        const sLS = latestStartOf(s);
        const sLF = latestFinish.get(s.id);
        const myDur = durMs.get(t.id);
        let bound;
        switch (s.depType) {
          case 'SS':
            bound = sLS - lag * DAY_MS + myDur;
            break;
          case 'FF':
            bound = sLF - lag * DAY_MS;
            break;
          case 'SF':
            bound = sLF - lag * DAY_MS + myDur;
            break;
          case 'FS':
          default:
            bound = sLS - lag * DAY_MS;
            break;
        }
        if (bound < lf) {
          lf = bound;
          changed = true;
        }
      }
      latestFinish.set(t.id, lf);
    }
    if (!changed) break;
  }

  const criticalIds = new Set();
  const floatById = new Map();
  leaves.forEach((t) => {
    const floatDays = Math.round((latestStartOf(t) - toMs(t.startDate)) / DAY_MS);
    floatById.set(t.id, floatDays);
    if (floatDays <= 0) criticalIds.add(t.id);
  });

  return { criticalIds, floatById };
};
