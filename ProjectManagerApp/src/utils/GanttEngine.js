import { sumValueOrdersByTask, sumExpenses } from './OrderEngine.js';
import { computeCriticalPath } from './CriticalPath.js';

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

const isDescendantOf = (task, parent) => {
  if (!task.wbs || !parent.wbs || task.id === parent.id) return false;
  return task.wbs.startsWith(`${parent.wbs}.`);
};

const compareByWbsDepth = (a, b) => {
  const aDepth = (a.wbs || '').split('.').length;
  const bDepth = (b.wbs || '').split('.').length;
  return bDepth - aDepth;
};

const addTaskWarning = (task, warning, allWarnings) => {
  task.warnings.push(warning);
  allWarnings.push({
    taskId: task.id,
    wbs: task.wbs,
    name: task.name,
    message: warning,
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
const progressAtDate = (task, dateMs) => {
  const start = parseDate(task.startDate);
  const end = parseDate(task.endDate);
  if (!start || !end) return 0;
  const startMs = start.getTime();
  const endMs = end.getTime();
  if (dateMs <= startMs) return 0;
  if (dateMs >= endMs) return 1;
  return (dateMs - startMs) / (endMs - startMs);
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
export const buildSCurve = (leafTasks, scheduleStart, scheduleEnd) => {
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

  const points = [];
  for (let offset = 0; offset <= totalDays; offset += stepDays) {
    const t = startMs + offset * DAY_MS;
    let pv = 0;
    let ev = 0;
    let ac = 0;
    leafTasks.forEach((task) => {
      const frac = progressAtDate(task, t);
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
        addTaskWarning(task, `المعرّف WBS مكرر (${task.wbs})`, warnings);
      });
    });

    computedTasks.forEach(task => {
      if (task.actualQty > task.qty && task.qty > 0) {
        addTaskWarning(task, 'الكمية المنفذة أكبر من الكمية المخططة', warnings);
      }
      if (task.dependsOn && !VALID_DEP_TYPES.has(task.depType)) {
        task.depType = 'FS';
        addTaskWarning(task, 'نوع العلاقة غير محدد أو غير صحيح، تم اعتماد FS', warnings);
      }
    });

    const state = new Map();
    const applyBaselineSchedule = (task) => {
      task.startDate = task.manualStart || projectStart;
      task.endDate = addDays(task.startDate, task.duration);
    };

    const resolveTaskSchedule = (task, stack = []) => {
      const currentState = state.get(task.id);
      if (currentState === 'done') return;

      if (currentState === 'visiting') {
        const cycle = [...stack, task].map(item => item.wbs || item.id).join(' > ');
        addTaskWarning(task, `توجد دورة في العلاقات: ${cycle}`, warnings);
        applyBaselineSchedule(task);
        state.set(task.id, 'done');
        return;
      }

      state.set(task.id, 'visiting');
      applyBaselineSchedule(task);

      if (task.dependsOn) {
        if (task.dependsOn === task.id) {
          addTaskWarning(task, 'لا يمكن ربط الفقرة بنفسها', warnings);
        } else {
          const dependency = tasksById.get(task.dependsOn);

          if (!dependency) {
            addTaskWarning(task, `الفقرة السابقة غير موجودة (${task.dependsOn})`, warnings);
          } else {
            resolveTaskSchedule(dependency, [...stack, task]);

            if (dependency.startDate && dependency.endDate) {
              switch (task.depType) {
                case 'FS':
                  task.startDate = addDays(dependency.endDate, task.lag);
                  task.endDate = addDays(task.startDate, task.duration);
                  break;
                case 'SS':
                  task.startDate = addDays(dependency.startDate, task.lag);
                  task.endDate = addDays(task.startDate, task.duration);
                  break;
                case 'FF':
                  task.endDate = addDays(dependency.endDate, task.lag);
                  task.startDate = addDays(task.endDate, -task.duration);
                  break;
                case 'SF':
                  task.endDate = addDays(dependency.startDate, task.lag);
                  task.startDate = addDays(task.endDate, -task.duration);
                  break;
                default:
                  break;
              }
            }
          }
        }
      }

      state.set(task.id, 'done');
    };

    computedTasks.forEach(task => resolveTaskSchedule(task));

    computedTasks
      .filter(task => task.isGroup)
      .sort(compareByWbsDepth)
      .forEach(group => {
        const descendants = computedTasks.filter(task => isDescendantOf(task, group));
        if (descendants.length === 0) return;

        const leafDescendants = descendants.filter(task => !task.isGroup);
        group.totalCost = leafDescendants.reduce((sum, task) => sum + task.totalCost, 0);
        group.actualCost = leafDescendants.reduce((sum, task) => sum + task.actualCost, 0);
        group.progress = group.totalCost > 0 ? clamp(group.actualCost / group.totalCost, 0, 1) : 0;

        const starts = descendants.map(task => task.startDate).filter(Boolean).sort();
        const ends = descendants.map(task => task.endDate).filter(Boolean).sort();
        if (starts.length > 0 && ends.length > 0) {
          group.startDate = starts[0];
          group.endDate = ends[ends.length - 1];
          group.duration = daysBetween(group.startDate, group.endDate);
        }
      });

    const leafTasks = computedTasks.filter(task => !task.isGroup);
    const projectTotalCost = leafTasks.reduce((sum, task) => sum + task.totalCost, 0);
    const projectActualCost = leafTasks.reduce((sum, task) => sum + task.actualCost, 0);
    const projectTotalProgress = projectTotalCost > 0 ? (projectActualCost / projectTotalCost) * 100 : 0;

    computedTasks.forEach(task => {
      task.weight = projectTotalCost > 0 ? task.totalCost / projectTotalCost : 0;
      task.weightedProgress = task.progress * task.weight;
      
      let plannedProgress = 0;
      const start = parseDate(task.startDate);
      const end = parseDate(task.endDate);
      const today = new Date();
      // Reset time for today to start of day UTC to match parseDate
      const todayMs = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
      
      if (start && end) {
        const startMs = start.getTime();
        const endMs = end.getTime();
        if (todayMs >= endMs) {
          plannedProgress = 1;
        } else if (todayMs <= startMs) {
          plannedProgress = 0;
        } else {
          plannedProgress = (todayMs - startMs) / (endMs - startMs);
        }
      }
      task.plannedProgress = plannedProgress;
      task.plannedCost = task.totalCost * plannedProgress;
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
    const sCurve = buildSCurve(leafTasks, scheduleStartDate, scheduleEndDate);
    const perWbsEvm = buildPerWbsEvm(computedTasks);

    // Critical path (CPM backward pass) — flags leaves with zero float.
    const { criticalIds, floatById } = computeCriticalPath(computedTasks);
    computedTasks.forEach(task => {
      if (!task.isGroup) {
        task.isCritical = criticalIds.has(task.id);
        task.totalFloat = floatById.has(task.id) ? floatById.get(task.id) : null;
      }
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
      warnings,
    };
  }
}
