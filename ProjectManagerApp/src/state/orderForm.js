// ─────────────────────────────────────────────────────────────
// orderForm — the Record screen's rules as pure functions.
//
// Same behavior as the old OrdersScreen: required-field validation,
// building the stored order (quick → approved at once, formal →
// 'recorded'), the order-log filters and the KPI figures. Plus
// "repeat last order" for one-tap entry on site, the warnings that ask
// "Save anyway?" (draftWarnings) and who may approve an order
// (approvalBlock). No React, no storage:
// tested in __tests__/orderForm.test.js.
// ─────────────────────────────────────────────────────────────

import {
  EXPENSE_FIELD_KINDS,
  ORDER_TYPES,
  createOrderDraft,
  expenseDetails,
  expenseFieldMissing,
  normalizeWhoForSave,
  ordersInRange,
  sumExpenses,
  todayStr,
} from '../utils/OrderEngine.js';
import { can, canApproveRecord } from '../utils/permissions.js';

export const toNumberOrNull = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Required fields the draft is missing → array of field specs. */
export const missingRequiredFields = (draft, spec) => {
  if (!draft || !spec) return [];
  return spec.fields.filter((f) => {
    if (!f.required) return false;
    if (EXPENSE_FIELD_KINDS.includes(f.kind)) return expenseFieldMissing(f, draft); // expense details (OrderEngine)
    if (f.kind === 'task') return !draft.taskId;
    if (f.kind === 'number') return !(Number(draft.quantity) > 0);
    if (f.kind === 'amount') return !(Number(draft.amount) > 0);
    if (f.kind === 'text' || f.kind === 'note') return !String(draft[f.key] || '').trim();
    if (f.kind === 'date') return !draft.date;
    return false;
  });
};

const DETAIL_KEYS = ['location', 'sampleRef', 'result', 'depth', 'note'];

/**
 * The stored order for a valid draft. Quick orders are approved on save
 * (approver = current user); formal orders start as 'recorded'.
 * `evidence`: ids of the photos already stored for this order (FileDB).
 * `recordedById`: the account that records it (currentActor().id; null
 * without accounts), so nobody approves their own formal order.
 */
export const buildOrderFromDraft = (draft, spec, { tasks = [], userName = '', recordedById = null, id, now, evidence = [] }) => {
  const task = tasks.find((t) => t.id === draft.taskId) || null;
  const isValue = spec.family === 'value';
  const isQuick = spec.tier === 'quick';
  const details = {};
  DETAIL_KEYS.forEach((k) => {
    const v = typeof draft[k] === 'string' ? draft[k].trim() : '';
    if (v) details[k] = v;
  });
  Object.assign(details, expenseDetails(draft, spec)); // machinery hours, payroll salary, … (OrderEngine)
  return {
    id,
    type: draft.type,
    family: spec.family,
    tier: spec.tier,
    date: draft.date,
    recordedAt: now,
    recordedBy: userName || '',
    recordedById: recordedById ?? null,
    taskId: task ? task.id : null,
    elementId: draft.elementId || null,
    taskWbs: task?.wbs || '',
    taskName: task?.name || '',
    who: normalizeWhoForSave(draft.who),
    quantity: isValue ? toNumberOrNull(draft.quantity) : null,
    unit: isValue ? String(draft.unit || '').trim() || task?.unit || null : null,
    amount: isValue ? null : toNumberOrNull(draft.amount),
    category: isValue ? null : spec.label,
    details,
    evidence: (Array.isArray(evidence) ? evidence : []).filter(Boolean),
    status: isQuick ? 'approved' : 'recorded',
    approvedBy: isQuick ? userName || null : null,
  };
};

/** The most recently recorded order (by recordedAt), or null. */
export const latestOrder = (orders = []) =>
  orders.reduce((best, o) => (o && (!best || (o.recordedAt || '') > (best.recordedAt || '')) ? o : best), null);

/**
 * A fresh draft that repeats an earlier order: same type, task, unit and
 * who; today's date; quantity/amount, notes and photos left empty.
 */
export const repeatOrderDraft = (order) => {
  if (!order) return null;
  const draft = createOrderDraft(order.type, { lastWho: { [order.type]: order.who } });
  if (!draft) return null;
  return { ...draft, taskId: order.taskId || '', unit: order.unit || '' };
};

export const EMPTY_FILTERS = { from: '', to: '', type: 'all', contractorId: 'all', taskId: 'all' };

export const hasActiveFilters = (f) =>
  !!f.from || !!f.to || f.type !== 'all' || f.contractorId !== 'all' || f.taskId !== 'all';

/** Order log: apply filters, newest work date first (then newest recorded). */
export const filterOrders = (orders = [], f = EMPTY_FILTERS) =>
  orders
    .filter((o) => {
      if (!o) return false;
      if (f.from && o.date < f.from) return false;
      if (f.to && o.date > f.to) return false;
      if (f.type !== 'all' && o.type !== f.type) return false;
      if (f.contractorId !== 'all' && (o.who?.kind !== 'contractor' || o.who.contractorId !== f.contractorId)) return false;
      if (f.taskId !== 'all' && o.taskId !== f.taskId) return false;
      return true;
    })
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.recordedAt || '').localeCompare(a.recordedAt || ''));

/** Formal orders awaiting approval, newest first. */
export const pendingOrders = (orders = []) =>
  orders
    .filter((o) => o && o.tier === 'formal' && o.status === 'recorded')
    .sort((a, b) => (b.recordedAt || '').localeCompare(a.recordedAt || ''));

/** Orders whose work date is `day`, newest recorded first. */
export const ordersOnDay = (orders = [], day) =>
  orders.filter((o) => o && o.date === day).sort((a, b) => (b.recordedAt || '').localeCompare(a.recordedAt || ''));

/** Headline figures for today and the last 7 days. */
export const orderKpis = (orders = [], today, weekStart) => {
  const todays = orders.filter((o) => o && o.date === today);
  const week = ordersInRange(orders, weekStart, today);
  const value = (list) => list.filter((o) => o.family === 'value');
  const sumQty = (list) => list.reduce((sum, o) => sum + (Number(o.quantity) || 0), 0);
  return {
    todayValueCount: value(todays).length,
    todayQty: sumQty(value(todays)),
    todayExpenses: sumExpenses(todays).total,
    weekValueCount: value(week).length,
    weekExpenses: sumExpenses(week).total,
  };
};

/** Contract vs executed for a computed task: { done, total, left, unit } or null. */
export const taskQuantityStatus = (computedTask) => {
  if (!computedTask || computedTask.isGroup) return null;
  const total = Number(computedTask.qty ?? computedTask.quantity) || 0;
  if (total <= 0) return null;
  const done = Number(computedTask.actualQty) || 0;
  return { done, total, left: Math.max(0, total - done), unit: computedTask.unit || '' };
};

/* ─────────────── Warnings before saving ─────────────── */

/** An expense needs this many earlier orders of its type before its amount is compared. */
export const OUTLIER_MIN_SAMPLES = 3;
/** An expense amount above this many times its type's median is flagged. */
export const OUTLIER_FACTOR = 10;

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** One comparable string per "who" (worker order does not matter). */
const whoKey = (who) => {
  const w = normalizeWhoForSave(who);
  if (w.kind === 'contractor') return `contractor:${w.contractorId}`;
  if (w.kind === 'team') return `team:${w.teamId}`;
  if (w.kind === 'workers') return `workers:${[...w.workerIds].sort().join(',')}`;
  return 'none';
};

// Details that tell two orders of one type apart (two concrete tests on one day).
const IDENTIFYING_DETAILS = ['location', 'sampleRef', 'depth'];
const detailText = (source, key) => String(source?.[key] ?? '').trim();

/**
 * Warnings for a draft about to be saved. They never block: the screen
 * asks "Save anyway?" (required fields stay errors, missingRequiredFields).
 * Each is { code, ...figures } and the screen words it:
 *   'duplicate'     an order with the same type, item, work date, quantity
 *                   (or amount), who, location, sample and depth exists { orderId };
 *   'overLeft'      the quantity is over what is left on the item's contract:
 *                   contract − executed − value orders awaiting approval
 *                   { qty, left, pending, unit };
 *   'amountOutlier' an expense amount over OUTLIER_FACTOR × the median of its
 *                   type's earlier orders (at least OUTLIER_MIN_SAMPLES) { amount, median };
 *   'futureDate'    the work date is after today { today };
 *   'beforeStart'   the work date is before the project start { start }.
 * ctx: { orders, tasks (the engine's computed tasks), projectStart, today }.
 */
export const draftWarnings = (draft, { orders = [], tasks = [], projectStart = '', today = todayStr() } = {}) => {
  const spec = draft ? ORDER_TYPES[draft.type] : null;
  if (!spec) return [];
  const isValue = spec.family === 'value';
  const hasQuantity = spec.fields.some((f) => f.kind === 'number');
  const qty = hasQuantity ? toNumberOrNull(draft.quantity) : null;
  const amount = isValue ? null : toNumberOrNull(draft.amount);
  const taskId = draft.taskId || null;
  const list = (Array.isArray(orders) ? orders : []).filter(Boolean);
  const warnings = [];

  const figure = (o) => (isValue ? toNumberOrNull(o.quantity) : toNumberOrNull(o.amount));
  const who = whoKey(draft.who);
  const twin = list.find(
    (o) =>
      o.type === draft.type &&
      (o.taskId || null) === taskId &&
      o.date === draft.date &&
      figure(o) === (isValue ? qty : amount) &&
      whoKey(o.who) === who &&
      IDENTIFYING_DETAILS.every((k) => detailText(o.details, k) === detailText(draft, k))
  );
  if (twin) warnings.push({ code: 'duplicate', orderId: twin.id });

  if (hasQuantity && qty > 0 && taskId) {
    const status = taskQuantityStatus(tasks.find((x) => x && x.id === taskId));
    if (status) {
      const pending = list
        .filter((o) => o.family === 'value' && o.taskId === taskId && o.status === 'recorded' && Number(o.quantity) > 0)
        .reduce((sum, o) => sum + Number(o.quantity), 0);
      const left = Math.max(0, status.total - status.done - pending);
      if (qty > left) warnings.push({ code: 'overLeft', qty, left, pending, unit: String(draft.unit || '').trim() || status.unit });
    }
  }

  if (amount > 0) {
    const earlier = list.filter((o) => o.type === draft.type && Number(o.amount) > 0).map((o) => Number(o.amount));
    if (earlier.length >= OUTLIER_MIN_SAMPLES) {
      const typical = median(earlier);
      if (amount > OUTLIER_FACTOR * typical) warnings.push({ code: 'amountOutlier', amount, median: typical });
    }
  }

  if (draft.date && today && draft.date > today) warnings.push({ code: 'futureDate', today });
  const start = String(projectStart || '').slice(0, 10);
  if (draft.date && start && draft.date < start) warnings.push({ code: 'beforeStart', start });

  return warnings;
};

/* ─────────────── Approving ─────────────── */

/**
 * Why `actor` ({ id, name, role }, Identity.currentActor) may not approve
 * this pending formal order, or null when they may:
 *   'certified' — it is in an issued payment certificate (frozen);
 *   'role'      — their role has no 'orders.approve';
 *   'own'       — they recorded it (permissions.canApproveRecord).
 * Without accounts the one local user (id null) approves everything, as before.
 */
export const approvalBlock = (order, actor, { certified = false } = {}) => {
  if (certified) return 'certified';
  if (!actor || !can(actor.role, 'orders.approve')) return 'role';
  if (!canApproveRecord(actor, order)) return 'own';
  return null;
};

/**
 * The issued payment certificates holding this order (refs from the
 * Certificates.certificatesByOrder() map: [{ id, number, kind, contractorId }]),
 * or null. Such an order is frozen: it is not deleted or approved again.
 */
export const orderLock = (order, byOrder) => {
  const refs = order && byOrder?.get?.(order.id);
  return Array.isArray(refs) && refs.length > 0 ? refs : null;
};
