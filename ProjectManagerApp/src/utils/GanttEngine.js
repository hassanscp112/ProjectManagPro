import { sumValueOrdersByTask, sumExpenses } from './OrderEngine.js';
import { computeCriticalPath } from './CriticalPath.js';
import { readLevelLinks, readLinks } from './planning/links.js';
import { forwardPass } from './planning/network.js';
import { capacitiesOf, findOverloads } from './planning/resources.js';
import { UNITS_PER_DAY, dayIndex, getCalendar } from './planning/WorkCalendar.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const VALID_DEP_TYPES = new Set(['FS', 'SS', 'FF', 'SF']);

const parseNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const parseWholeNumber = (value) => {
  const number = parseInt(value, 10);
  return Number.isFinite(number) ? number : 0;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const parseDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(part => !Number.isFinite(part))) return null;

  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
};

const formatDate = (date) => date.toISOString().split('T')[0];

const wbsDepth = (task) => (task.wbs || '').split('.').length;

// A link as the engine reads it: lag parsed to whole days, the type kept raw
// (an invalid one is reported and treated as FS in the warning phase).
const normalizeLink = (link, source) => {
  const out = { id: link.id, type: link.type, lag: parseWholeNumber(link.lag), source };
  if (link.lagUnit === 'cd') out.lagUnit = 'cd';
  if (source === 'level' && !VALID_DEP_TYPES.has(out.type)) out.type = 'FS';
  return out;
};

// Warning codes (stable, translated by the UI) with their Arabic fallback
// message. Params fill the {placeholders} in both.
const WARNING_MESSAGES = {
  duplicateWbs: ({ wbs }) => `المعرّف WBS مكرر (${wbs})`,
  overExecuted: () => 'الكمية المنفذة أكبر من الكمية المخططة',
  invalidDepType: () => 'نوع العلاقة غير محدد أو غير صحيح، تم اعتماد FS',
  dependencyCycle: ({ cycle }) => `توجد دورة في العلاقات: ${cycle}`,
  selfDependency: () => 'لا يمكن ربط الفقرة بنفسها',
  missingPredecessor: ({ id }) => `الفقرة السابقة غير موجودة (${id})`,
  resourceOverload: ({ resource, from, to }) => `يتجاوز الموارد المتاحة (${resource}) من ${from} إلى ${to}`,
};

// task.warnings / result.warnings entries: { code, params, message }.
const addTaskWarning = (task, code, params, allWarnings) => {
  const warning = { code, params, message: WARNING_MESSAGES[code](params) };
  task.warnings.push(warning);
  allWarnings.push({
    taskId: task.id,
    wbs: task.wbs,
    name: task.name,
    ...warning,
  });
};

// Syncs BOQ-linked leaf tasks: their quantity/unit come from the parent task's
// element-column sums. A leaf is BOQ-linked when it carries
// `boqLink: { parentId, colId }` (created from the Task Details sum table).
const resolveBoqLinks = (computedTasks, tasksById, isSigned) => {
  computedTasks.forEach(task => {
    const link = task.boqLink;
    if (!link || !link.parentId || !link.colId) return;

    const parent = tasksById.get(link.parentId);
    if (!parent) return;

    const columns = Array.isArray(parent.elementColumns) ? parent.elementColumns : [];
    const col = columns.find(c => c && c.id === link.colId);
    if (!col) return;

    const elements = Array.isArray(parent.elements) ? parent.elements : [];
    const rawSum = elements.reduce((acc, el) => {
      const v = Number(el && el.values ? el.values[col.id] : undefined);
      return acc + (Number.isFinite(v) ? v : 0);
    }, 0);
    // Waste factor (standard estimating allowance) inflates the take-off sum
    // to the orderable contract quantity (e.g. +5% for concrete spillage).
    const wasteFactor = parseNumber(col.wasteFactorPct);
    const effectiveSum = rawSum * (1 + wasteFactor / 100);

    // Expose both for reconciliation: raw take-off vs effective (with waste).
    task.elementSumRaw = rawSum;
    task.elementSum = effectiveSum;

    // Draft + created leaf: contract qty is driven live by the effective sum.
    // Signed (any mode): contract qty stays frozen (written into raw at sign-off).
    // Existing leaf (mode 'existing'): the pre-populated contract qty is authoritative;
    // the element sum is only exposed for reconciliation, never overwrites the contract.
    if (!isSigned && link.mode !== 'existing') {
      task.qty = Math.max(0, effectiveSum);
      task.quantity = task.qty;
      if (col.unit) task.unit = col.unit;
    }
    task.boqLinked = true;

    // Recompute derived fields because qty may have changed after normalization.
    task.totalCost = task.isGroup ? 0 : task.qty * task.price;
    task.actualCost = task.isGroup ? 0 : task.actualQty * task.price;
    task.progress = task.isGroup || task.qty === 0 ? 0 : clamp(task.actualQty / task.qty, 0, 1);
  });
};

// Utility to add days to a date, assuming 7 working days a week (as per Excel "0000000")
export const addDays = (dateStr, days) => {
  const date = parseDate(dateStr);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
};

export const daysBetween = (startDate, endDate) => {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) return 0;
  return Math.max(0, Math.round((end - start) / DAY_MS));
};

// Linear interpolation of a task's progress fraction at a given point in time.
// Returns 0 before the task starts, 1 after it ends, and a linear fraction in
// between. Mirrors the per-task plannedProgress logic used at "today".
// With a working calendar the fraction is measured in working time, so days
// off add no progress.
const fractionBetween = (startMs, endMs, dateMs, cal) => {
  if (dateMs <= startMs) return 0;
  if (dateMs >= endMs) return 1;
  if (cal && !cal.isIdentity) {
    const a = cal.cum(Math.round(startMs / DAY_MS));
    const b = cal.cum(Math.round(endMs / DAY_MS));
    return b > a ? (cal.cum(Math.round(dateMs / DAY_MS)) - a) / (b - a) : 1;
  }
  return (dateMs - startMs) / (endMs - startMs);
};

const progressAtDate = (task, dateMs, cal) => {
  const start = parseDate(task.startDate);
  const end = parseDate(task.endDate);
  if (!start || !end) return 0;
  return fractionBetween(start.getTime(), end.getTime(), dateMs, cal);
};

// Planned share of a task done by today (a finished window counts as done
// even on its last day — the order of the checks matters for milestones).
const plannedFractionToday = (task, todayMs, cal) => {
  const start = parseDate(task.startDate);
  const end = parseDate(task.endDate);
  if (!start || !end) return 0;
  if (todayMs >= end.getTime()) return 1;
  if (todayMs <= start.getTime()) return 0;
  return progressAtDate(task, todayMs, cal);
};

// Build the S-curve: weekly samples of cumulative Planned Value (PV),
// Earned Value (EV), and Actual Cost (AC) across the whole schedule.
//
// PV at time t  = Σ leaf totalCost × plannedFraction(t)   (what should be done)
// EV at time t  = Σ leaf totalCost × progress              (prorated evenly over
//                  the task window as an approximation of when value was earned)
// AC at time t  = Σ leaf actualCost × plannedFraction(t)   (actual spend prorated
//                  by elapsed time as an approximation of when cost was incurred)
//
// Returns [] when there are no leaf tasks or no schedule window.
export const buildSCurve = (leafTasks, scheduleStart, scheduleEnd, cal = null) => {
  if (!leafTasks.length || !scheduleStart || !scheduleEnd) return [];

  const startMs = parseDate(scheduleStart)?.getTime();
  const endMs = parseDate(scheduleEnd)?.getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return [];

  const totalDays = Math.round((endMs - startMs) / DAY_MS);
  // Weekly buckets; ~1 point per week, capped to keep the chart legible.
  const stepDays = Math.max(7, Math.ceil(totalDays / 60));

  const todayMs = (() => {
    const now = new Date();
    return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  })();

  // Each task's window parsed once (null = no valid dates ⇒ fraction 0).
  const windows = leafTasks.map((task) => {
    const start = parseDate(task.startDate);
    const end = parseDate(task.endDate);
    return start && end ? [start.getTime(), end.getTime()] : null;
  });

  const points = [];
  for (let offset = 0; offset <= totalDays; offset += stepDays) {
    const t = startMs + offset * DAY_MS;
    let pv = 0;
    let ev = 0;
    let ac = 0;
    leafTasks.forEach((task, i) => {
      const w = windows[i];
      const frac = w ? fractionBetween(w[0], w[1], t, cal) : 0;
      pv += task.totalCost * frac;
      ev += task.totalCost * task.progress * frac;
      ac += task.actualCost * frac;
    });
    points.push({
      date: formatDate(new Date(t)),
      pv,
      ev,
      ac,
      isFuture: t > todayMs,
    });
  }

  // Ensure the curve terminates exactly at the schedule end so PV/EV/AC reach
  // their full value (the weekly step can otherwise land short of the end).
  const last = points[points.length - 1];
  if (!last || last.date !== scheduleEnd) {
    let pv = 0;
    let ev = 0;
    let ac = 0;
    leafTasks.forEach((task) => {
      pv += task.totalCost; // past end ⇒ planned fraction = 1
      ev += task.totalCost * task.progress;
      ac += task.actualCost;
    });
    points.push({ date: scheduleEnd, pv, ev, ac, isFuture: endMs > todayMs });
  }
  return points;
};

// Per-WBS EVM roll-up: for each top-level group (WBS with no dots), sum the
// BAC / PV / EV / AC of its leaf descendants and derive SPI / CPI. Returns one
// entry per top-level group that has priced leaf descendants.
export const buildPerWbsEvm = (computedTasks) => {
  const topGroups = computedTasks.filter(
    (t) => t.isGroup && t.wbs && !t.wbs.includes('.')
  );
  return topGroups
    .map((group) => {
      const prefix = `${group.wbs}.`;
      const leaves = computedTasks.filter(
        (t) => !t.isGroup && t.wbs && t.wbs.startsWith(prefix)
      );
      const bac = leaves.reduce((s, t) => s + t.totalCost, 0);
      const pv = leaves.reduce((s, t) => s + (t.plannedCost || 0), 0);
      const ev = leaves.reduce((s, t) => s + t.totalCost * t.progress, 0);
      const ac = leaves.reduce((s, t) => s + t.actualCost, 0);
      const spi = pv > 0 ? ev / pv : 0;
      const cpi = ac > 0 ? ev / ac : 0;
      return {
        wbs: group.wbs,
        name: group.name,
        taskCount: leaves.length,
        bac,
        pv,
        ev,
        ac,
        spi,
        cpi,
      };
    })
    .filter((row) => row.taskCount > 0 && row.bac > 0);
};


// Calculates everything for a list of tasks.
// `orders` (optional) is the order ledger: when a task has approved value
// orders, its executed quantity is DERIVED from them (the foundation rule —
// actuals are recorded as orders, never typed). Tasks without orders keep
// their legacy manual `actualQuantity` (marked orderSource.manual).
export class GanttEngine {
  static calculate(tasks, projectStartDate, projectMeta, orders = []) {
    const warnings = [];
    const projectStart = parseDate(projectStartDate) ? projectStartDate : formatDate(new Date());
    // The project's working calendar (projectMeta.planning.calendar); none =
    // every day is a working day, exactly as before.
    const cal = getCalendar(projectMeta && projectMeta.planning ? projectMeta.planning.calendar : null);

    const orderTotals = sumValueOrdersByTask(orders);

    const computedTasks = tasks.map(task => {
      const qty = Math.max(0, parseNumber(task.quantity));
      const orderTotalsForTask = orderTotals.get(task.id);
      // Orders are the source of executed quantity; manual field is the
      // pre-orders legacy fallback so existing data keeps working.
      const actualQty = orderTotalsForTask
        ? Math.max(0, orderTotalsForTask.total)
        : Math.max(0, parseNumber(task.actualQuantity));
      const orderSource = orderTotalsForTask
        ? {
            manual: false,
            formalQty: orderTotalsForTask.formalQty,
            quickQty: orderTotalsForTask.quickQty,
            orderCount: orderTotalsForTask.orderCount,
          }
        : (parseNumber(task.actualQuantity) > 0 ? { manual: true } : null);
      const price = Math.max(0, parseNumber(task.unitPrice));
      const duration = Math.max(0, parseWholeNumber(task.duration));
      const lag = parseWholeNumber(task.lag);
      const manualStart = parseDate(task.manualStart) ? task.manualStart : projectStart;

      return {
        ...task,
        qty,
        actualQty,
        orderSource,
        price,
        duration,
        lag,
        manualStart,
        totalCost: task.isGroup ? 0 : qty * price,
        actualCost: task.isGroup ? 0 : actualQty * price,
        progress: task.isGroup || qty === 0 ? 0 : clamp(actualQty / qty, 0, 1),
        warnings: [],
        // Every predecessor (slot 0 = dependsOn/depType/lag), lags parsed once.
        links: readLinks(task).map(link => normalizeLink(link, 'logic')),
        levelLinks: readLevelLinks(task).map(link => normalizeLink(link, 'level')),
      };
    });

    const tasksById = new Map(computedTasks.map(task => [task.id, task]));

    // Sync BOQ-linked leaves (quantity/unit driven by parent element sums).
    // Once a baseline is signed, contract quantities are frozen and no longer
    // re-derived from element sums (elementSum is still exposed for reconciliation).
    const isSigned = !!(projectMeta && projectMeta.baseline);
    const baselineTasks = (projectMeta && projectMeta.baseline && projectMeta.baseline.tasks) || {};
    resolveBoqLinks(computedTasks, tasksById, isSigned);

    // Contract-vs-actual (execution) and scope (baseline) variances.
    computedTasks.forEach(task => {
      const baseline = baselineTasks[task.id];
      task.baselineQty = baseline ? Math.max(0, parseNumber(baseline.quantity)) : null;
      task.scopeVariance = task.baselineQty != null ? task.qty - task.baselineQty : 0;
      task.execVariance = task.actualQty - task.qty;
    });

    const wbsGroups = new Map();
    computedTasks.forEach(task => {
      if (!task.wbs) return;
      const existing = wbsGroups.get(task.wbs) || [];
      existing.push(task);
      wbsGroups.set(task.wbs, existing);
    });

    wbsGroups.forEach(group => {
      if (group.length <= 1) return;
      group.forEach(task => {
        addTaskWarning(task, 'duplicateWbs', { wbs: task.wbs }, warnings);
      });
    });

    computedTasks.forEach(task => {
      if (task.actualQty > task.qty && task.qty > 0) {
        addTaskWarning(task, 'overExecuted', {}, warnings);
      }
      task.links.forEach((link, index) => {
        if (VALID_DEP_TYPES.has(link.type)) return;
        link.type = 'FS';
        if (index === 0) {
          task.depType = 'FS';
          addTaskWarning(task, 'invalidDepType', {}, warnings);
        } else {
          addTaskWarning(task, 'invalidDepType', { id: link.id }, warnings);
        }
      });
    });

    // Early dates (iterative walk over every link, on the working calendar).
    const timing = forwardPass(computedTasks, tasksById, {
      cal,
      projectStart,
      warn: (task, code, params) => addTaskWarning(task, code, params, warnings),
    });

    // Group roll-up, deepest groups first: each group's descendants are the
    // tasks whose WBS starts with "<group wbs>." (found through a prefix map,
    // in task order so the cost sums add up exactly as before).
    const byPrefix = new Map();
    computedTasks.forEach(task => {
      if (!task.wbs) return;
      const parts = task.wbs.split('.');
      for (let n = 1; n < parts.length; n++) {
        const prefix = parts.slice(0, n).join('.');
        const list = byPrefix.get(prefix);
        if (list) list.push(task);
        else byPrefix.set(prefix, [task]);
      }
    });
    computedTasks
      .filter(task => task.isGroup)
      .sort((a, b) => wbsDepth(b) - wbsDepth(a))
      .forEach(group => {
        const descendants = group.wbs ? (byPrefix.get(group.wbs) || []).filter(task => task.id !== group.id) : [];
        if (descendants.length === 0) return;

        let totalCost = 0;
        let actualCost = 0;
        let minStart = null;
        let maxEnd = null;
        descendants.forEach(task => {
          if (!task.isGroup) {
            totalCost += task.totalCost;
            actualCost += task.actualCost;
          }
          if (task.startDate && (minStart === null || task.startDate < minStart)) minStart = task.startDate;
          if (task.endDate && (maxEnd === null || task.endDate > maxEnd)) maxEnd = task.endDate;
        });
        group.totalCost = totalCost;
        group.actualCost = actualCost;
        group.progress = group.totalCost > 0 ? clamp(group.actualCost / group.totalCost, 0, 1) : 0;
        if (minStart !== null && maxEnd !== null) {
          group.startDate = minStart;
          group.endDate = maxEnd;
          group.duration = daysBetween(group.startDate, group.endDate);
        }
      });

    // Calendar days each bar spans (leaf durations are working days).
    computedTasks.forEach(task => {
      task.spanDays = daysBetween(task.startDate, task.endDate);
    });

    const leafTasks = computedTasks.filter(task => !task.isGroup);
    const projectTotalCost = leafTasks.reduce((sum, task) => sum + task.totalCost, 0);
    const projectActualCost = leafTasks.reduce((sum, task) => sum + task.actualCost, 0);
    const projectTotalProgress = projectTotalCost > 0 ? (projectActualCost / projectTotalCost) * 100 : 0;

    // "Today" as a UTC day (local calendar date), the same for every task.
    const now = new Date();
    const todayMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    computedTasks.forEach(task => {
      task.weight = projectTotalCost > 0 ? task.totalCost / projectTotalCost : 0;
      task.weightedProgress = task.progress * task.weight;
      task.plannedProgress = plannedFractionToday(task, todayMs, cal);
      task.plannedCost = task.totalCost * task.plannedProgress;
    });

    const projectPlannedCost = leafTasks.reduce((sum, task) => sum + task.plannedCost, 0);
    const projectPlannedProgress = projectTotalCost > 0 ? (projectPlannedCost / projectTotalCost) * 100 : 0;
    const projectDeviation = projectTotalProgress - projectPlannedProgress;

    // ── Earned Value Management (EVM) roll-up ────────────────────────────
    // BAC = budget at completion (Σ leaf totalCost)
    // PV  = planned value  (Σ leaf totalCost × plannedProgress) == projectPlannedCost
    // EV  = earned value   (Σ leaf totalCost × progress)
    // AC  = actual cost    (Σ leaf actualCost)                 == projectActualCost
    // SPI = EV/PV (>1 ahead of schedule), CPI = EV/AC (>1 under budget)
    // EAC = BAC/CPI (forecast at completion), VAC = BAC − EAC
    const bac = projectTotalCost;
    const pv = projectPlannedCost;
    const ac = projectActualCost;
    const ev = leafTasks.reduce((sum, task) => sum + task.totalCost * task.progress, 0);
    const spi = pv > 0 ? ev / pv : 0;
    const cpi = ac > 0 ? ev / ac : 0;
    const eac = cpi > 0 ? bac / cpi : bac;
    const vac = bac - eac;
    const evm = { bac, pv, ev, ac, spi, cpi, eac, vac };

    const startDates = computedTasks.map(task => task.startDate).filter(Boolean).sort();
    const endDates = computedTasks.map(task => task.endDate).filter(Boolean).sort();
    const scheduleStartDate = startDates[0] || projectStart;
    const scheduleEndDate = endDates[endDates.length - 1] || projectStart;

    // S-curve (planned vs earned vs actual over time) + per-WBS EVM roll-up.
    const sCurve = buildSCurve(leafTasks, scheduleStartDate, scheduleEndDate, cal);
    const perWbsEvm = buildPerWbsEvm(computedTasks);

    // Critical path (CPM backward pass) — flags leaves with zero float.
    const { criticalIds, floatById } = computeCriticalPath(computedTasks, { cal, ES: timing.ES, EF: timing.EF });
    computedTasks.forEach(task => {
      if (!task.isGroup) {
        task.isCritical = criticalIds.has(task.id);
        task.totalFloat = floatById.has(task.id) ? floatById.get(task.id) : null;
      }
    });

    // Resources: where the plan asks for more crews / people / equipment than
    // the project has (projectMeta.planning.resources). Only flagged —
    // leveling is the person's explicit action (planning/ResourceLeveler).
    const capacities = capacitiesOf(projectMeta && projectMeta.planning ? projectMeta.planning.resources : null);
    const overloads = capacities.size ? findOverloads(leafTasks, timing, capacities, cal) : [];
    const flagged = new Set();
    overloads.forEach(o => {
      o.taskIds.forEach(id => {
        const key = `${id}|${o.resource}`;
        if (flagged.has(key)) return;
        flagged.add(key);
        addTaskWarning(tasksById.get(id), 'resourceOverload', { resource: o.resource, from: o.from, to: o.to }, warnings);
      });
    });

    // Real money out (expense orders) — separate from valued work so
    // overspend becomes visible (CPI vs expenses).
    const expenses = sumExpenses(orders);

    return {
      tasks: computedTasks,
      projectTotalCost,
      projectActualCost,
      projectTotalProgress,
      projectPlannedProgress,
      projectDeviation,
      evm,
      sCurve,
      perWbsEvm,
      expenses,
      scheduleStartDate,
      scheduleEndDate,
      projectDuration: daysBetween(scheduleStartDate, scheduleEndDate),
      // Working days from start to finish on the project calendar (equals
      // projectDuration when every day is a working day).
      projectWorkingDays: cal.isIdentity
        ? daysBetween(scheduleStartDate, scheduleEndDate)
        : Math.max(0, (cal.cum(dayIndex(scheduleEndDate)) - cal.cum(dayIndex(scheduleStartDate))) / UNITS_PER_DAY),
      calendarIssues: cal.issues,
      // Early start / finish of every task on the working-time axis
      // (100 units = one working day), for leveling and resource charts.
      timing: { ES: timing.ES, EF: timing.EF },
      overloads,
      warnings,
    };
  }
}
