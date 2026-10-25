// ─────────────────────────────────────────────────────────────
// OrderEngine — the Order System's pure logic + persistence.
//
// NOTE ON TRANSLATION: display metadata only (type labels, field
// labels, placeholders, family labels, who fallback labels) goes
// through the i18n dictionaries. Codes (type/family/tier), field
// keys and who.kind values are language-independent and NEVER
// translated or persisted differently.
//
// Everything done on site is recorded as an "order" through ONE
// entry screen. Value orders earn BOQ quantities; expense orders
// are money out. Quick orders are approved on save; formal orders
// start 'recorded' and need an explicit approval action.
//
// Storage (localStorage key 'pm-orders'):
//   { orders: Order[], lastWhoByType: { [type]: whoObject } }
//   lastWhoByType powers the smart default "last used contractor".
//
// Registries (localStorage key 'pm-registries', owned by another
// module — read-only here):
//   { contractors: [{id,name,phone,notes}],
//     teams: [{id,name,foremanWorkerId,memberWorkerIds,defaultSize,notes}],
//     workers: [{id,name,trade,dailyRate,phone,notes}] }
// ─────────────────────────────────────────────────────────────

import { loadLanguage, translate } from '../i18n/index.js';
import { notifyStoreChange } from './storeEvents.js';

export const ORDERS_STORAGE_KEY = 'pm-orders';
export const REGISTRIES_STORAGE_KEY = 'pm-registries';

export const WHO_KINDS = ['contractor', 'team', 'workers', 'none'];

/** Localized display text for the ACTIVE language (non-React util context). */
const T = (key, vars) => translate(loadLanguage(), key, vars);

/**
 * Registry of order types — the single source the entry form renders from.
 * Field kinds: 'date' | 'who' | 'task' | 'element' | 'number' | 'unit' |
 *              'amount' | 'text' | 'note'
 * who field modes: 'contractor' (single select) | 'recipient' (kind switches).
 *
 * Display metadata (labelKey / field labelKey / placeholderKey) carries
 * dictionary keys; ORDER_TYPES below wraps the raw specs so `label` and
 * `placeholder` are localized lazily at access time.
 */
const RAW_ORDER_TYPES = {
  quick_work: {
    type: 'quick_work',
    family: 'value',
    tier: 'quick',
    labelKey: 'orders.typeQuickWork',
    icon: '⚡',
    whoDefault: 'contractor',
    fields: [
      { key: 'date', kind: 'date', labelKey: 'orders.fWorkDate', required: true },
      { key: 'who', kind: 'who', mode: 'contractor', labelKey: 'orders.fContractor' },
      { key: 'taskId', kind: 'task', labelKey: 'orders.fTask', required: true },
      { key: 'quantity', kind: 'number', labelKey: 'common.quantity', required: true },
      { key: 'unit', kind: 'unit', labelKey: 'common.unit', placeholderKey: 'orders.phUnit' },
    ],
  },
  completion: {
    type: 'completion',
    family: 'value',
    tier: 'formal',
    labelKey: 'orders.typeCompletion',
    icon: '📋',
    whoDefault: 'none',
    fields: [
      { key: 'date', kind: 'date', labelKey: 'orders.fWorkDate', required: true },
      { key: 'taskId', kind: 'task', labelKey: 'orders.fTask', required: true },
      { key: 'elementId', kind: 'element', labelKey: 'orders.fElement' },
      { key: 'location', kind: 'text', labelKey: 'common.location', placeholderKey: 'orders.phLocationCompletion' },
      { key: 'quantity', kind: 'number', labelKey: 'common.quantity', required: true },
      { key: 'note', kind: 'note', labelKey: 'orders.fNote', placeholderKey: 'orders.phHandoverNote' },
    ],
  },
  concrete_test: {
    type: 'concrete_test',
    family: 'value',
    tier: 'formal',
    labelKey: 'orders.typeConcreteTest',
    icon: '🧪',
    whoDefault: 'none',
    fields: [
      { key: 'date', kind: 'date', labelKey: 'orders.fTestDate', required: true },
      { key: 'taskId', kind: 'task', labelKey: 'orders.fTask', required: true },
      { key: 'location', kind: 'text', labelKey: 'common.location', required: true, placeholderKey: 'orders.phLocationConcrete' },
      { key: 'sampleRef', kind: 'text', labelKey: 'orders.fSampleRef', placeholderKey: 'orders.phSampleRef' },
      { key: 'result', kind: 'text', labelKey: 'orders.fResult', placeholderKey: 'orders.phResult' },
    ],
  },
  soil_test: {
    type: 'soil_test',
    family: 'value',
    tier: 'formal',
    labelKey: 'orders.typeSoilTest',
    icon: '🪨',
    whoDefault: 'none',
    fields: [
      { key: 'date', kind: 'date', labelKey: 'orders.fTestDate', required: true },
      { key: 'location', kind: 'text', labelKey: 'common.location', required: true, placeholderKey: 'orders.phLocationSoil' },
      { key: 'depth', kind: 'text', labelKey: 'orders.fDepth', placeholderKey: 'orders.phDepth' },
      { key: 'result', kind: 'text', labelKey: 'orders.fResult', placeholderKey: 'orders.phDensity' },
    ],
  },
  material: {
    type: 'material',
    family: 'expense',
    tier: 'quick',
    labelKey: 'orders.typeMaterial',
    icon: '🧱',
    whoDefault: 'contractor',
    fields: [
      { key: 'date', kind: 'date', labelKey: 'common.date', required: true },
      { key: 'amount', kind: 'amount', labelKey: 'orders.fAmount', required: true },
      { key: 'who', kind: 'who', mode: 'recipient', labelKey: 'orders.fRecipient' },
      { key: 'taskId', kind: 'task', labelKey: 'orders.fTaskOptional' },
      { key: 'note', kind: 'note', labelKey: 'orders.fDescription', placeholderKey: 'orders.phMaterial' },
    ],
  },
  payroll: {
    type: 'payroll',
    family: 'expense',
    tier: 'quick',
    labelKey: 'orders.typePayroll',
    icon: '💵',
    whoDefault: 'workers',
    fields: [
      { key: 'date', kind: 'date', labelKey: 'common.date', required: true },
      { key: 'amount', kind: 'amount', labelKey: 'orders.fAmount', required: true },
      { key: 'who', kind: 'who', mode: 'recipient', labelKey: 'orders.fRecipient' },
      { key: 'taskId', kind: 'task', labelKey: 'orders.fTaskOptional' },
      { key: 'note', kind: 'note', labelKey: 'orders.fDescription', placeholderKey: 'orders.phPayroll' },
    ],
  },
  machinery: {
    type: 'machinery',
    family: 'expense',
    tier: 'quick',
    labelKey: 'orders.typeMachinery',
    icon: '🚜',
    whoDefault: 'contractor',
    fields: [
      { key: 'date', kind: 'date', labelKey: 'common.date', required: true },
      { key: 'amount', kind: 'amount', labelKey: 'orders.fAmount', required: true },
      { key: 'who', kind: 'who', mode: 'recipient', labelKey: 'orders.fRecipient' },
      { key: 'taskId', kind: 'task', labelKey: 'orders.fTaskOptional' },
      { key: 'note', kind: 'note', labelKey: 'orders.fDescription', placeholderKey: 'orders.phMachinery' },
    ],
  },
  fuel: {
    type: 'fuel',
    family: 'expense',
    tier: 'quick',
    labelKey: 'orders.typeFuel',
    icon: '⛽',
    whoDefault: 'contractor',
    fields: [
      { key: 'date', kind: 'date', labelKey: 'common.date', required: true },
      { key: 'amount', kind: 'amount', labelKey: 'orders.fAmount', required: true },
      { key: 'who', kind: 'who', mode: 'recipient', labelKey: 'orders.fRecipient' },
      { key: 'taskId', kind: 'task', labelKey: 'orders.fTaskOptional' },
      { key: 'note', kind: 'note', labelKey: 'orders.fDescription', placeholderKey: 'orders.phFuel' },
    ],
  },
  other_expense: {
    type: 'other_expense',
    family: 'expense',
    tier: 'quick',
    labelKey: 'orders.typeOtherExpense',
    icon: '🧾',
    whoDefault: 'none',
    fields: [
      { key: 'date', kind: 'date', labelKey: 'common.date', required: true },
      { key: 'amount', kind: 'amount', labelKey: 'orders.fAmount', required: true },
      { key: 'who', kind: 'who', mode: 'recipient', labelKey: 'orders.fRecipient' },
      { key: 'taskId', kind: 'task', labelKey: 'orders.fTaskOptional' },
      { key: 'note', kind: 'note', labelKey: 'orders.fDescription', placeholderKey: 'orders.phOther' },
    ],
  },
};

/** Wrap one raw field so `label` / `placeholder` translate lazily. */
const localizeField = (raw) => {
  const { labelKey, placeholderKey, ...rest } = raw;
  const field = {
    ...rest,
    get label() {
      return T(labelKey);
    },
  };
  // Fields without a placeholderKey expose no `placeholder` prop; number and
  // amount inputs fall back to their own '0' placeholder at render time.
  if (placeholderKey) {
    Object.defineProperty(field, 'placeholder', {
      enumerable: true,
      get() {
        return T(placeholderKey);
      },
    });
  }
  return field;
};

/** Wrap one raw type spec: localized label + localized fields. */
const localizeOrderType = ({ labelKey, ...raw }) => ({
  ...raw,
  get label() {
    return T(labelKey);
  },
  fields: raw.fields.map(localizeField),
});

export const ORDER_TYPES = Object.fromEntries(
  Object.entries(RAW_ORDER_TYPES).map(([type, raw]) => [type, localizeOrderType(raw)])
);

/** Flat ordered list of the type specs above (insertion order preserved). */
export const ORDER_TYPE_LIST = Object.values(ORDER_TYPES);

/** Localized labels for the two order families. */
export const FAMILY_LABELS = {
  get value() {
    return T('orders.familyValue');
  },
  get expense() {
    return T('orders.familyExpense');
  },
};

/* ─────────────────────────────────────────────────────────────
   Date + id helpers
   ───────────────────────────────────────────────────────────── */

/** Format a Date (or parseable value) as a local 'YYYY-MM-DD' string. */
export const formatDateStr = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Today's WORK date as 'YYYY-MM-DD' (local time, not UTC). */
export const todayStr = () => formatDateStr(new Date());

/** The date N days before today as 'YYYY-MM-DD'. */
export const daysAgoStr = (days) => formatDateStr(new Date(Date.now() - days * 24 * 60 * 60 * 1000));

/** Order id: crypto.randomUUID with a Date.now fallback. */
export const createOrderId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ord-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

/* ─────────────────────────────────────────────────────────────
   Persistence (localStorage key 'pm-orders')
   ───────────────────────────────────────────────────────────── */

/**
 * Load { orders, lastWhoByType } from storage (defensive — always returns
 * a well-shaped object even when storage is empty or corrupted).
 */
export const loadOrdersData = () => {
  try {
    const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
    if (!raw) return { orders: [], lastWhoByType: {} };
    const parsed = JSON.parse(raw);
    return {
      orders: Array.isArray(parsed?.orders) ? parsed.orders : [],
      lastWhoByType:
        parsed?.lastWhoByType && typeof parsed.lastWhoByType === 'object'
          ? parsed.lastWhoByType
          : {},
    };
  } catch {
    return { orders: [], lastWhoByType: {} };
  }
};

/** Persist the whole data object. Returns the data written. */
export const saveOrdersData = (data) => {
  const shaped = {
    orders: Array.isArray(data?.orders) ? data.orders : [],
    lastWhoByType:
      data?.lastWhoByType && typeof data.lastWhoByType === 'object'
        ? data.lastWhoByType
        : {},
  };
  localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(shaped));
  notifyStoreChange(ORDERS_STORAGE_KEY);
  return shaped;
};

/**
 * Append an order (newest first) and remember its `who` as the smart
 * default for its type. Returns the updated orders array.
 */
export const addOrder = (order) => {
  const data = loadOrdersData();
  const orders = [order, ...data.orders];
  saveOrdersData({
    orders,
    lastWhoByType: order ? { ...data.lastWhoByType, [order.type]: order.who } : data.lastWhoByType,
  });
  return orders;
};

/** Shallow-merge a patch into one order. Returns the updated orders array. */
export const updateOrder = (id, patch) => {
  const data = loadOrdersData();
  const orders = data.orders.map((o) => (o.id === id ? { ...o, ...patch } : o));
  saveOrdersData({ ...data, orders });
  return orders;
};

/** Remove one order. Returns the updated orders array. */
export const deleteOrder = (id) => {
  const data = loadOrdersData();
  const orders = data.orders.filter((o) => o.id !== id);
  saveOrdersData({ ...data, orders });
  return orders;
};

/** Approve a formal order, recording the approver name. Returns updated array. */
export const approveOrder = (id, approverName) => {
  const name = typeof approverName === 'string' ? approverName.trim() : '';
  return updateOrder(id, { status: 'approved', approvedBy: name || null });
};

/* ─────────────────────────────────────────────────────────────
   Aggregation
   ───────────────────────────────────────────────────────────── */

/**
 * Sum APPROVED value orders per task.
 * @returns {Map<string, {total:number, formalQty:number, quickQty:number, orderCount:number}>}
 *   keyed by taskId. Orders without a taskId (e.g. soil tests) are skipped.
 */
export const sumValueOrdersByTask = (orders) => {
  const map = new Map();
  (Array.isArray(orders) ? orders : []).forEach((o) => {
    if (!o || o.family !== 'value' || o.status !== 'approved' || !o.taskId) return;
    // Only positive finite quantities carry executed work. A zero/garbage-qty
    // order must NOT create an entry — that would override the task's manual
    // actualQuantity with 0 in the engine (order-source wins when an entry exists).
    const q = Number(o.quantity);
    if (!Number.isFinite(q) || q <= 0) return;
    const entry = map.get(o.taskId) || { total: 0, formalQty: 0, quickQty: 0, orderCount: 0 };
    entry.total += q;
    if (o.tier === 'formal') entry.formalQty += q;
    else entry.quickQty += q;
    entry.orderCount += 1;
    map.set(o.taskId, entry);
  });
  return map;
};

/**
 * Sum expense orders within an optional date range (by WORK date).
 * @returns {{ total: number, byCategory: Object<string, number> }}
 *   byCategory keys are the order's `category` (falls back to the type label).
 */
export const sumExpenses = (orders, range) => {
  const result = { total: 0, byCategory: {} };
  const from = range?.dateFrom || null;
  const to = range?.dateTo || null;
  (Array.isArray(orders) ? orders : []).forEach((o) => {
    if (!o || o.family !== 'expense') return;
    if (from && o.date && o.date < from) return;
    if (to && o.date && o.date > to) return;
    const amount = Number(o.amount);
    const value = Number.isFinite(amount) ? amount : 0;
    const category = o.category || ORDER_TYPES[o.type]?.label || T('orders.typeOtherExpense');
    result.total += value;
    result.byCategory[category] = (result.byCategory[category] || 0) + value;
  });
  return result;
};

/** Orders whose WORK date falls within [dateFrom, dateTo] (bounds optional). */
export const ordersInRange = (orders, dateFrom, dateTo) =>
  (Array.isArray(orders) ? orders : []).filter((o) => {
    if (!o) return false;
    if (dateFrom && o.date && o.date < dateFrom) return false;
    if (dateTo && o.date && o.date > dateTo) return false;
    return true;
  });

/** Orders charged to a specific contractor; optional { dateFrom, dateTo } range. */
export const ordersForContractor = (orders, contractorId, range) =>
  (Array.isArray(orders) ? orders : []).filter((o) => {
    if (!o || o.who?.kind !== 'contractor' || o.who.contractorId !== contractorId) return false;
    if (range?.dateFrom && o.date && o.date < range.dateFrom) return false;
    if (range?.dateTo && o.date && o.date > range.dateTo) return false;
    return true;
  });

/* ─────────────────────────────────────────────────────────────
   Draft + who helpers
   ───────────────────────────────────────────────────────────── */

/** Clean a draft `who` for storage: drop empty references down to 'none'. */
export const normalizeWhoForSave = (who) => {
  if (!who || typeof who !== 'object' || !WHO_KINDS.includes(who.kind)) return { kind: 'none' };
  if (who.kind === 'contractor') {
    return who.contractorId ? { kind: 'contractor', contractorId: who.contractorId } : { kind: 'none' };
  }
  if (who.kind === 'team') {
    return who.teamId ? { kind: 'team', teamId: who.teamId } : { kind: 'none' };
  }
  if (who.kind === 'workers') {
    const ids = Array.isArray(who.workerIds) ? who.workerIds.filter(Boolean) : [];
    return ids.length > 0 ? { kind: 'workers', workerIds: ids } : { kind: 'none' };
  }
  return { kind: 'none' };
};

const normalizeWhoForDraft = (who, defaultKind) => {
  if (who && typeof who === 'object' && WHO_KINDS.includes(who.kind)) return { ...who };
  return { kind: WHO_KINDS.includes(defaultKind) ? defaultKind : 'none' };
};

/**
 * Create a fresh form draft for a type, prefilled with today's date and the
 * last-used `who` for that type (the "last used contractor" smart default).
 * `options.tasks` is accepted for API symmetry; the draft starts un-tasked.
 *
 * @param {string} type - one of ORDER_TYPES keys.
 * @param {{ tasks?: Array, lastWho?: Object<string, whoObject> }} [options]
 * @returns {{ type, date, who, taskId, elementId, quantity, unit, amount,
 *             location, sampleRef, result, depth, note } | null}
 */
export const createOrderDraft = (type, options = {}) => {
  const typeSpec = ORDER_TYPES[type];
  if (!typeSpec) return null;
  const lastWhoByType = options.lastWho && typeof options.lastWho === 'object' ? options.lastWho : {};
  return {
    type,
    date: todayStr(),
    who: normalizeWhoForDraft(lastWhoByType[type], typeSpec.whoDefault),
    taskId: '',
    elementId: '',
    quantity: '',
    unit: '',
    amount: '',
    location: '',
    sampleRef: '',
    result: '',
    depth: '',
    note: '',
  };
};

/* ─────────────────────────────────────────────────────────────
   Registries (read-only, owned by another module)
   ───────────────────────────────────────────────────────────── */

/** Load 'pm-registries' defensively; missing lists default to []. */
export const loadRegistries = () => {
  const empty = { contractors: [], teams: [], workers: [] };
  try {
    const raw = localStorage.getItem(REGISTRIES_STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    return {
      contractors: Array.isArray(parsed?.contractors) ? parsed.contractors : [],
      teams: Array.isArray(parsed?.teams) ? parsed.teams : [],
      workers: Array.isArray(parsed?.workers) ? parsed.workers : [],
    };
  } catch {
    return empty;
  }
};

/** Resolve a who object into a short localized display label via registries. */
export const resolveWhoLabel = (who, registries = {}) => {
  if (!who || !WHO_KINDS.includes(who.kind) || who.kind === 'none') return '—';
  if (who.kind === 'contractor') {
    const c = (registries.contractors || []).find((x) => x.id === who.contractorId);
    return c?.name || T('orders.unknownContractor');
  }
  if (who.kind === 'team') {
    const t = (registries.teams || []).find((x) => x.id === who.teamId);
    return t?.name || T('orders.unknownTeam');
  }
  if (who.kind === 'workers') {
    const ids = Array.isArray(who.workerIds) ? who.workerIds : [];
    if (ids.length === 0) return '—';
    const names = ids
      .map((id) => (registries.workers || []).find((w) => w.id === id)?.name)
      .filter(Boolean);
    if (names.length === 0) return T('orders.workerCount', { n: ids.length });
    const shown = names.slice(0, 2).join(T('orders.listSep'));
    return names.length > 2 ? `${shown} +${names.length - 2}` : shown;
  }
  return '—';
};
