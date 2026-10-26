// ─────────────────────────────────────────────────────────────
// links — a task's predecessors, read and written in one place.
//
// A task may wait for several others: task.predecessors =
//   [{ id, type: 'FS'|'SS'|'FF'|'SF', lag, lagUnit?: 'wd'|'cd' }]
// (lag in working days; lagUnit 'cd' = calendar days, e.g. curing).
// The legacy single link (dependsOn / depType / lag) is ALWAYS slot 0:
// readLinks takes it from those fields and predecessors[1..] are the extra
// links (predecessors[0] is only a mirror). So code written for one
// predecessor keeps working as it looks: clearing dependsOn drops the first
// link. writeLinks mirrors slot 0 back into the legacy fields.
//
// levelLinks: [{ id, type: 'FS', lag: 0 }] are written only by resource
// leveling (crew hand-overs) and kept apart from the logic links.
// Tested in __tests__/links.test.js.
// ─────────────────────────────────────────────────────────────

export const LINK_TYPES = ['FS', 'SS', 'FF', 'SF'];

const isLinkEntry = (l) => l && l.id !== null && l.id !== undefined && l.id !== '';

/** The task's logic links, slot 0 from the legacy fields. Values are raw. */
export const readLinks = (task) => {
  if (!task) return [];
  const extra = Array.isArray(task.predecessors) ? task.predecessors : [];
  const links = [];
  if (task.dependsOn) {
    const mirror = extra[0];
    const first = { id: task.dependsOn, type: task.depType, lag: task.lag };
    if (mirror && mirror.id === task.dependsOn && mirror.lagUnit === 'cd') first.lagUnit = 'cd';
    links.push(first);
  }
  extra.slice(1).forEach((l) => {
    if (isLinkEntry(l)) links.push(l.lagUnit === 'cd' ? { id: l.id, type: l.type, lag: l.lag, lagUnit: 'cd' } : { id: l.id, type: l.type, lag: l.lag });
  });
  return links;
};

const cleanLink = (l) => {
  const lag = Number(l.lag);
  const out = { id: l.id, type: LINK_TYPES.includes(l.type) ? l.type : 'FS', lag: Number.isFinite(lag) ? Math.trunc(lag) : 0 };
  if (l.lagUnit === 'cd') out.lagUnit = 'cd';
  return out;
};

/**
 * The task with these logic links: slot 0 goes to dependsOn/depType/lag,
 * the full list to predecessors (kept only when there is more than one link
 * or a calendar-day lag; otherwise the key is removed).
 */
export const writeLinks = (task, links = []) => {
  const list = (Array.isArray(links) ? links : []).filter(isLinkEntry).map(cleanLink);
  const next = {
    ...task,
    dependsOn: list[0] ? list[0].id : null,
    depType: list[0] ? list[0].type : '',
    lag: list[0] ? list[0].lag : 0,
  };
  if (list.length > 1 || list.some((l) => l.lagUnit === 'cd')) next.predecessors = list;
  else delete next.predecessors;
  return next;
};

/** The leveling links of a task ([] when none). */
export const readLevelLinks = (task) => (Array.isArray(task?.levelLinks) ? task.levelLinks.filter(isLinkEntry) : []);

/** True when the task links (logic or leveling) to any id in the set. */
export const hasLinkTo = (task, ids) =>
  readLinks(task).some((l) => ids.has(l.id)) || readLevelLinks(task).some((l) => ids.has(l.id));

/**
 * The task without its links to the given ids (deleted tasks). Returns the
 * same object when nothing changes; a plain legacy task gives exactly
 * { ...task, dependsOn: null, depType: '', lag: 0 }.
 */
export const removeLinksTo = (task, ids) => {
  if (!hasLinkTo(task, ids)) return task;
  const hasExtra = Array.isArray(task.predecessors) || Array.isArray(task.levelLinks);
  if (!hasExtra) return { ...task, dependsOn: null, depType: '', lag: 0 };
  let next = writeLinks(task, readLinks(task).filter((l) => !ids.has(l.id)));
  if (Array.isArray(task.levelLinks)) {
    next = { ...next, levelLinks: task.levelLinks.filter((l) => !ids.has(l.id)) };
  }
  return next;
};

/* ─────────────── text form (the grid cell) ─────────────── */

/**
 * Links as short text, e.g. "2.1FS+3; 2.4SS; 3.2FF-2d" — predecessors by
 * WBS, FS+0 shortened to the WBS alone, a trailing 'd' marks calendar days.
 */
export const formatLinks = (links, wbsOf) =>
  (links || [])
    .map((l) => {
      const ref = wbsOf(l.id) || String(l.id);
      const lag = Number(l.lag) || 0;
      const type = l.type || 'FS';
      if (type === 'FS' && lag === 0 && l.lagUnit !== 'cd') return ref;
      const sign = lag > 0 ? `+${lag}` : lag < 0 ? String(lag) : '';
      return `${ref}${type}${sign}${sign && l.lagUnit === 'cd' ? 'd' : ''}`;
    })
    .join('; ');

const LINK_TEXT = /^\s*([^\s;,]+?)\s*(FS|SS|FF|SF)?\s*([+-]\s*\d+)?\s*(d)?\s*$/i;

/**
 * Parse the grid text back into links. `idOf(wbs)` resolves a WBS to a task
 * id. → { links, errors: [text that did not parse or resolve] }.
 */
export const parseLinks = (text, idOf) => {
  const links = [];
  const errors = [];
  String(text || '')
    .split(/[;,،]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const m = part.match(LINK_TEXT);
      const id = m ? idOf(m[1]) : null;
      if (!m || !id) {
        errors.push(part);
        return;
      }
      const link = { id, type: (m[2] || 'FS').toUpperCase(), lag: m[3] ? parseInt(m[3].replace(/\s/g, ''), 10) : 0 };
      if (m[4] && link.lag !== 0) link.lagUnit = 'cd';
      if (!links.some((l) => l.id === link.id)) links.push(link);
    });
  return { links, errors };
};
