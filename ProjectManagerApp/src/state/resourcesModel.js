// ─────────────────────────────────────────────────────────────
// resourcesModel — pure rules behind the Resources page (#/schedule/resources):
// what the project's items use, edits to projectMeta.planning.resources,
// labels, and the per-resource summary of the weekly use chart.
// Shape of planning.resources: see utils/planning/resources.js.
// Tested in __tests__/resourcesModel.test.js.
// ─────────────────────────────────────────────────────────────

import { readLevelLinks } from '../utils/planning/links.js';
import { taskResources } from '../utils/planning/resources.js';
import { TRADES } from '../utils/planning/trades.js';

const blank = (v) => v === '' || v === null || v === undefined;
const whole = (v) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * What the items use, per trade (leaf count, most crews on one item, most
 * people on one item) and per equipment type (items, most at once).
 * → { trades: [{ trade, count, maxCrews, maxLabour }], equipment: [{ type, count, max }],
 *     untraded: leaves without a trade }
 */
export const resourceUsage = (tasks = []) => {
  const trades = new Map();
  const equipment = new Map();
  let untraded = 0;
  tasks.forEach((t) => {
    if (!t || t.isGroup) return;
    if (!t.trade) {
      untraded += 1;
    } else {
      const row = trades.get(t.trade) || { trade: t.trade, count: 0, maxCrews: 0, maxLabour: 0 };
      row.count += 1;
      row.maxCrews = Math.max(row.maxCrews, Math.max(1, Math.round(Number(t.crews) || 1)));
      row.maxLabour = Math.max(row.maxLabour, Number(t.resources?.labour) || 0);
      trades.set(t.trade, row);
    }
    Object.entries(t.resources || {}).forEach(([type, amount]) => {
      if (type === 'labour' || !(Number(amount) > 0)) return;
      const row = equipment.get(type) || { type, count: 0, max: 0 };
      row.count += 1;
      row.max = Math.max(row.max, Number(amount));
      equipment.set(type, row);
    });
  });
  const order = (trade) => (TRADES.includes(trade) ? TRADES.indexOf(trade) : TRADES.length);
  return {
    trades: [...trades.values()].sort((a, b) => order(a.trade) - order(b.trade) || a.trade.localeCompare(b.trade)),
    equipment: [...equipment.values()].sort((a, b) => a.type.localeCompare(b.type)),
    untraded,
  };
};

/** planning.resources without empty parts (absent = no limits at all). */
export const cleanResources = (resources = {}) => {
  const out = {};
  const crews = Object.fromEntries(Object.entries(resources.crews || {}).filter(([, n]) => whole(n)).map(([k, n]) => [k, whole(n)]));
  if (Object.keys(crews).length) out.crews = crews;
  if (whole(resources.labour)) out.labour = whole(resources.labour);
  const equipment = Object.fromEntries(Object.entries(resources.equipment || {}).filter(([, n]) => whole(n)).map(([k, n]) => [k, whole(n)]));
  if (Object.keys(equipment).length) out.equipment = equipment;
  const teams = Object.fromEntries(Object.entries(resources.teams || {}).filter(([, ids]) => Array.isArray(ids) && ids.length));
  if (Object.keys(teams).length) out.teams = teams;
  return out;
};

const withPart = (resources, part, key, value) => {
  const map = { ...(resources?.[part] || {}) };
  if (blank(value) || !whole(value)) delete map[key];
  else map[key] = whole(value);
  return cleanResources({ ...resources, [part]: map });
};

/** Crews available for a trade (blank = no limit). */
export const setCrewLimit = (resources, trade, value) => withPart(resources, 'crews', trade, value);
/** Units of an equipment type on site (blank = no limit). */
export const setEquipmentLimit = (resources, type, value) => withPart(resources, 'equipment', type, value);
/** People on site at once (blank = no limit). */
export const setLabourLimit = (resources, value) => cleanResources({ ...resources, labour: blank(value) ? null : value });

/** A People team in or out of a trade's crews (a team works for one trade). */
export const toggleTeam = (resources, trade, teamId) => {
  const teams = {};
  Object.entries(resources?.teams || {}).forEach(([k, ids]) => {
    teams[k] = (ids || []).filter((id) => id !== teamId || k === trade);
  });
  const current = teams[trade] || [];
  teams[trade] = current.includes(teamId) ? current.filter((id) => id !== teamId) : [...current, teamId];
  return cleanResources({ ...resources, teams });
};

/** A resource key ('crew:masonry', 'labour', 'eq:crane') in words. */
export const resourceLabel = (t, key) => {
  if (key === 'labour') return t('schedule.res.labour');
  if (key.startsWith('crew:')) return t('schedule.res.crewOf', { trade: t(`planning.trade.${key.slice(5)}`) });
  if (key.startsWith('eq:')) return equipmentLabel(t, key.slice(3));
  return key;
};

const KNOWN_EQUIPMENT = ['crane', 'excavator', 'loader', 'roller', 'pump', 'mixer', 'truck'];
export const EQUIPMENT_TYPES = KNOWN_EQUIPMENT;
/** An equipment type in words (unknown types as typed). */
export const equipmentLabel = (t, type) => (KNOWN_EQUIPMENT.includes(type) ? t(`schedule.eq.${type}`) : type);

/**
 * Per resource of the weekly chart: peak, capacity and how many weeks go
 * over it, the most overloaded first, then limited ones, then by name.
 */
export const histogramSummary = (histogram = []) =>
  histogram
    .map((h) => {
      const peak = h.weeks.reduce((m, w) => Math.max(m, w.peak), 0);
      const over = h.capacity == null ? 0 : h.weeks.filter((w) => w.peak > h.capacity).length;
      return { resource: h.resource, capacity: h.capacity, peak, over };
    })
    .sort((a, b) => b.over - a.over || Number(b.capacity != null) - Number(a.capacity != null) || a.resource.localeCompare(b.resource));

/** Bucket size for the chart: a week, or two once the plan runs past two years. */
export const bucketDaysFor = (startDate, endDate) => {
  const days = (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000;
  return Number.isFinite(days) && days > 730 ? 14 : 7;
};

/**
 * Items planned from a work type but without people / equipment figures
 * (plans made before resources existed): the patches that fill them from
 * the work type's crew × the item's crews. workTypes: Map id → work type.
 */
export const fillResourcesPatches = (tasks = [], workTypes = new Map()) =>
  tasks
    .filter((t) => !t.isGroup && t.workTypeId && !t.resources && workTypes.has(t.workTypeId))
    .map((t) => ({ id: t.id, patch: { resources: taskResources(workTypes.get(t.workTypeId), t.crews) } }))
    .filter((p) => p.patch.resources);

/** The tasks a task waits for through leveling (crew hand-overs), in order. */
export const waitsForOf = (task, tasks = []) => {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return readLevelLinks(task).map((l) => byId.get(l.id)).filter(Boolean);
};

/** Names of the People teams on a task. */
export const teamNamesOf = (task, teams = []) => {
  const byId = new Map(teams.map((t) => [t.id, t]));
  return (Array.isArray(task?.teamIds) ? task.teamIds : []).map((id) => byId.get(id)?.name).filter(Boolean);
};

/** The calendar preset to show for a project's planning ('custom' once edited). */
export const calendarPresetOf = (planning) => {
  if (planning?.calendarPreset) return planning.calendarPreset;
  return planning?.calendar ? 'custom' : 'allDays';
};
