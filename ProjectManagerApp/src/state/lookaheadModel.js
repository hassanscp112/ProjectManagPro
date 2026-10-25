// ─────────────────────────────────────────────────────────────
// lookaheadModel — the Lookahead screen's rules as pure functions.
//
// Monthly targets grouped by top-level section and compared with the
// approved quantity orders of that month; daily assignments checked
// against that day's orders (done = at least one approved order on the
// task) → the day's completion rate (PPC). Storage stays in
// utils/PlanningStore.js. Tested in __tests__/lookaheadModel.test.js.
// ─────────────────────────────────────────────────────────────

const isValueOrder = (o) => o && o.family === 'value' && o.taskId;

/** Top-level sections with their leaf items: [{ section, leaves }]. */
export const planSections = (tasks = []) =>
  tasks
    .filter((t) => t.wbs && !t.wbs.includes('.'))
    .map((section) => ({
      section,
      leaves: section.isGroup ? tasks.filter((t) => !t.isGroup && t.wbs && t.wbs.startsWith(`${section.wbs}.`)) : [section],
    }))
    .filter((entry) => entry.leaves.length > 0);

/** Approved quantity per task over one month ('YYYY-MM'): Map taskId → qty. */
export const monthActuals = (orders = [], mKey) => {
  const map = new Map();
  orders.forEach((o) => {
    if (!isValueOrder(o) || o.status !== 'approved' || (o.date || '').slice(0, 7) !== mKey) return;
    const q = Number(o.quantity);
    if (Number.isFinite(q)) map.set(o.taskId, (map.get(o.taskId) || 0) + q);
  });
  return map;
};

/** Month totals: targets count, Σ target, Σ executed (each task once), rate. */
export const monthSummary = (targets = [], actuals = new Map()) => {
  let target = 0;
  let actual = 0;
  const seen = new Set();
  targets.forEach((row) => {
    const q = Number(row.quantity);
    if (Number.isFinite(q)) target += q;
    if (!seen.has(row.taskId)) {
      seen.add(row.taskId);
      actual += actuals.get(row.taskId) || 0;
    }
  });
  return { count: targets.length, target, actual, rate: target > 0 ? actual / target : null };
};

/** Executed share of one target row, or null without a target quantity. */
export const targetRate = (target, actuals = new Map()) => {
  const q = Number(target.quantity);
  return Number.isFinite(q) && q > 0 ? (actuals.get(target.taskId) || 0) / q : null;
};

/** Quantity orders (any status) on one date: Map taskId → orders. */
export const dayOrdersByTask = (orders = [], date) => {
  const map = new Map();
  orders.forEach((o) => {
    if (!isValueOrder(o) || o.date !== date) return;
    if (!map.has(o.taskId)) map.set(o.taskId, []);
    map.get(o.taskId).push(o);
  });
  return map;
};

const hasApproved = (list) => (list || []).some((o) => o.status === 'approved');

/** Whether a daily assignment was carried out (an approved order that day). */
export const assignmentDone = (assignment, byTask) => hasApproved(byTask.get(assignment.taskId));

/** The day's completion: { done, total, rate (PPC) or null, approvedOrders }. */
export const dayCompletion = (assignments = [], byTask = new Map()) => {
  const done = assignments.filter((a) => assignmentDone(a, byTask)).length;
  let approvedOrders = 0;
  byTask.forEach((list) => {
    approvedOrders += list.filter((o) => o.status === 'approved').length;
  });
  return { done, total: assignments.length, rate: assignments.length ? done / assignments.length : null, approvedOrders };
};

/** Tone for a rate: month targets are met at 100%, a day's PPC is good from 80%. */
export const rateTone = (rate, good = 1) => {
  if (rate == null) return 'neutral';
  if (rate >= good) return 'success';
  return rate >= 0.5 ? 'warning' : 'danger';
};
