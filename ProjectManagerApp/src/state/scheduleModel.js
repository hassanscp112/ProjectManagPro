// ─────────────────────────────────────────────────────────────
// scheduleModel — the Schedule screen's rules as pure functions.
//
// Timeline scale and header tiers per zoom, which rows show (collapsed
// groups, critical-only, search), which grid fields are locked and why
// (same locks as the old Gantt), a task's scope (itself + descendants),
// and the baseline comparison. Dates are 'YYYY-MM-DD' strings handled
// as UTC days. Tested in __tests__/scheduleModel.test.js.
// ─────────────────────────────────────────────────────────────

import { readLinks } from '../utils/planning/links.js';
import { getTaskAndDescendantIds } from './projectModel.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Pixels per day for each zoom level. */
export const ZOOM_DAY_WIDTH = { week: 12, month: 3, quarter: 1 };

const parseDay = (s) => (s ? new Date(`${s}T00:00:00Z`) : null);
const fmtDay = (d) => d.toISOString().slice(0, 10);

/** Whole days from a to b ('YYYY-MM-DD'). */
export const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / DAY_MS);

/**
 * Visible date range: earliest start → latest end, stretched to include
 * today, plus a 3-week tail. → { start, days }.
 */
export const timelineRange = (tasks = [], fallbackStart, today) => {
  let min = null;
  let max = null;
  tasks.forEach((t) => {
    if (t.startDate && (!min || t.startDate < min)) min = t.startDate;
    if (t.endDate && (!max || t.endDate > max)) max = t.endDate;
  });
  min = min || fallbackStart || today;
  max = max || min;
  if (today && today > max) max = today;
  const end = fmtDay(new Date(parseDay(max).getTime() + 21 * DAY_MS));
  return { start: min, days: Math.max(1, daysBetween(min, end)) };
};

/**
 * Header rows for the timeline: { top, bottom }, each a list of
 * { key, label, days } spans covering the range left to right in time.
 * week: months / week starts · month: years / months · quarter: years / quarters.
 * `monthName(date)` formats a month label (injected so this stays pure).
 */
export const headerTiers = (start, days, zoom, monthName) => {
  const top = [];
  const bottom = [];
  const push = (list, key, label) => {
    const last = list[list.length - 1];
    if (last && last.key === key) last.days += 1;
    else list.push({ key, label, days: 1 });
  };
  const base = parseDay(start).getTime();
  for (let i = 0; i < days; i++) {
    const d = new Date(base + i * DAY_MS);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    if (zoom === 'week') {
      push(top, `${y}-${m}`, `${monthName(d)} ${y}`);
      const date = d.getUTCDate();
      const weekStart = date <= 7 ? 1 : date <= 14 ? 8 : date <= 21 ? 15 : 22;
      push(bottom, `${y}-${m}-${weekStart}`, String(weekStart));
    } else if (zoom === 'month') {
      push(top, `${y}`, String(y));
      // January (and the first month shown) carry the year: the year row's
      // label is usually scrolled out of view.
      const first = bottom.length === 0;
      push(bottom, `${y}-${m}`, m === 0 || first ? `${monthName(d)} ${y}` : monthName(d));
    } else {
      push(top, `${y}`, String(y));
      const q = Math.floor(m / 3) + 1;
      push(bottom, `${y}-Q${q}`, `Q${q}`);
    }
  }
  return { top, bottom };
};

/* ─────────────── rows ─────────────── */

const depthOf = (task) => (task.wbs ? (task.wbs.match(/\./g) || []).length : 0);

/** Ids of every group above a task (by WBS prefix). */
const ancestorIds = (tasks, task) => {
  const ids = [];
  const parts = (task.wbs || '').split('.');
  for (let n = parts.length - 1; n > 0; n--) {
    const prefix = parts.slice(0, n).join('.');
    const parent = tasks.find((t) => t.wbs === prefix);
    if (parent) ids.push(parent.id);
  }
  return ids;
};

/**
 * Rows to draw, in tree order: [{ task, depth, hasChildren, collapsed }].
 * Collapsed groups hide their descendants. With criticalOnly or a search
 * query, matching tasks show with all their parent groups (collapse is
 * ignored so matches are never hidden).
 */
export const visibleRows = (tasks = [], { collapsed = new Set(), criticalOnly = false, query = '' } = {}) => {
  const q = query.trim().toLowerCase();
  const filtering = criticalOnly || q !== '';
  const hasChildren = (task) => tasks.some((t) => t.wbs && task.wbs && t.wbs.startsWith(`${task.wbs}.`));

  let keep = null;
  if (filtering) {
    keep = new Set();
    tasks.forEach((t) => {
      const matchesQuery = !q || `${t.wbs || ''} ${t.name || ''}`.toLowerCase().includes(q);
      const matchesCritical = !criticalOnly || (!t.isGroup && t.isCritical);
      if (matchesQuery && matchesCritical) {
        keep.add(t.id);
        ancestorIds(tasks, t).forEach((id) => keep.add(id));
      }
    });
  }

  const rows = [];
  let hiddenUnder = null; // WBS prefix of a collapsed group
  tasks.forEach((task) => {
    if (keep) {
      if (!keep.has(task.id)) return;
    } else {
      if (hiddenUnder && task.wbs && task.wbs.startsWith(hiddenUnder)) return;
      hiddenUnder = null;
      if (collapsed.has(task.id)) hiddenUnder = `${task.wbs}.`;
    }
    rows.push({ task, depth: depthOf(task), hasChildren: hasChildren(task), collapsed: !keep && collapsed.has(task.id) });
  });
  return rows;
};

/* ─────────────── locks ─────────────── */

/**
 * Why a grid field can't be edited, or null when it can:
 * 'boq' (quantity comes from a linked element column), 'signed'
 * (contract frozen at sign-off), 'orders' (executed comes from approved
 * orders), 'dependency' (start follows the predecessors), 'noDependency'
 * (relation/lag need a predecessor), 'group' (groups are rolled up).
 */
export const fieldLock = (task, field, isSigned) => {
  const linked = (Array.isArray(task.links) ? task.links : readLinks(task)).length > 0;
  if (task.isGroup && !['wbs', 'name'].includes(field)) return 'group';
  switch (field) {
    case 'quantity':
    case 'unit':
      if (task.boqLinked) return 'boq';
      return isSigned ? 'signed' : null;
    case 'unitPrice':
      return isSigned ? 'signed' : null;
    case 'actualQuantity':
      return task.orderSource && task.orderSource.manual === false ? 'orders' : null;
    case 'manualStart':
      return linked ? 'dependency' : null;
    case 'depType':
    case 'lag':
      return task.dependsOn ? null : 'noDependency';
    default:
      return null;
  }
};

/* ─────────────── task scope ─────────────── */

/** Direct children (one WBS level down), in tree order. */
export const childrenOf = (tasks = [], task) => {
  if (!task?.wbs) return [];
  const depth = depthOf(task);
  return tasks.filter((t) => t.wbs && t.wbs.startsWith(`${task.wbs}.`) && depthOf(t) === depth + 1);
};

/** Orders on a task or any of its descendants, newest recorded first. */
export const ordersInScope = (tasks = [], orders = [], taskId) => {
  const ids = getTaskAndDescendantIds(tasks, taskId);
  return orders
    .filter((o) => o && o.taskId && ids.has(o.taskId))
    .sort((a, b) => (b.recordedAt || '').localeCompare(a.recordedAt || ''));
};

/** Status of a computed task for chips: 'done' | 'late' | 'active' | 'notStarted'. */
export const scheduleStatus = (task, today) => {
  if ((task.progress || 0) >= 1) return 'done';
  if (task.endDate && task.endDate < today) return 'late';
  if (task.startDate && task.startDate <= today) return 'active';
  return 'notStarted';
};

/* ─────────────── baseline ─────────────── */

/**
 * Leaves compared with the signed baseline: quantity and unit price then vs
 * now, and the value difference. → { rows, totals } or null when unsigned.
 */
export const baselineComparison = (computedTasks = [], baseline) => {
  if (!baseline || !baseline.tasks) return null;
  const rows = computedTasks
    .filter((t) => !t.isGroup)
    .map((t) => {
      const b = baseline.tasks[t.id];
      const baseQty = b ? Number(b.quantity) || 0 : null;
      const basePrice = b ? Number(b.unitPrice) || 0 : null;
      const qty = Number(t.qty ?? t.quantity) || 0;
      const price = Number(t.price ?? t.unitPrice) || 0;
      const baseValue = b ? baseQty * basePrice : 0;
      const value = qty * price;
      return {
        task: t,
        isNew: !b,
        baseQty,
        qty,
        basePrice,
        price,
        baseValue,
        value,
        deltaValue: value - baseValue,
        changed: !b || baseQty !== qty || basePrice !== price,
      };
    });
  const totals = rows.reduce(
    (acc, r) => ({ baseValue: acc.baseValue + r.baseValue, value: acc.value + r.value, changed: acc.changed + (r.changed ? 1 : 0) }),
    { baseValue: 0, value: 0, changed: 0 }
  );
  return { rows, totals: { ...totals, deltaValue: totals.value - totals.baseValue } };
};
