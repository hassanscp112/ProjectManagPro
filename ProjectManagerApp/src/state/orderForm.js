// ─────────────────────────────────────────────────────────────
// orderForm — the Record screen's rules as pure functions.
//
// Same behavior as the old OrdersScreen: required-field validation,
// building the stored order (quick → approved at once, formal →
// 'recorded'), the order-log filters and the KPI figures. Plus
// "repeat last order" for one-tap entry on site. No React, no storage:
// tested in __tests__/orderForm.test.js.
// ─────────────────────────────────────────────────────────────

import { createOrderDraft, normalizeWhoForSave, ordersInRange, sumExpenses } from '../utils/OrderEngine.js';

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
 */
export const buildOrderFromDraft = (draft, spec, { tasks = [], userName = '', id, now }) => {
  const task = tasks.find((t) => t.id === draft.taskId) || null;
  const isValue = spec.family === 'value';
  const isQuick = spec.tier === 'quick';
  const details = {};
  DETAIL_KEYS.forEach((k) => {
    const v = typeof draft[k] === 'string' ? draft[k].trim() : '';
    if (v) details[k] = v;
  });
  return {
    id,
    type: draft.type,
    family: spec.family,
    tier: spec.tier,
    date: draft.date,
    recordedAt: now,
    recordedBy: userName || '',
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
    evidence: [],
    status: isQuick ? 'approved' : 'recorded',
    approvedBy: isQuick ? userName || null : null,
  };
};

/** The most recently recorded order (by recordedAt), or null. */
export const latestOrder = (orders = []) =>
  orders.reduce((best, o) => (o && (!best || (o.recordedAt || '') > (best.recordedAt || '')) ? o : best), null);

/**
 * A fresh draft that repeats an earlier order: same type, task, unit and
 * who; today's date; quantity/amount and notes left empty.
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
