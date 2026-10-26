// ─────────────────────────────────────────────────────────────
// financeModel — the Finance screen's rules as pure functions.
//
// The four ledgers (machinery, materials, petty cash, payroll) are views
// over expense orders (utils/OrderEngine.js — orders own entry): which
// order types each one shows, its filters and totals, and the draft kept
// after a save for fast repeated entry. Plus the one-time migration of
// the old ledger ('project-manager-finance-data', utils/Finance.js — kept,
// read-only) into expense orders, and the editable dropdown lists.
// Tested in __tests__/financeModel.test.js.
// ─────────────────────────────────────────────────────────────

import { LEDGERS } from '../utils/Finance.js';
import { DEDUCTED_STATUS, ORDER_TYPES, expenseBreakdown } from '../utils/OrderEngine.js';

/** Payroll status value that deducts the advance — stored data, not UI text. */
export { DEDUCTED_STATUS };

/* ── ledgers as views over expense orders ───────────────────────────────── */

/** Expense order types each ledger shows; the first is the one "Add" opens. */
export const LEDGER_TYPES = {
  machinery: ['machinery'],
  materials: ['material'],
  pettyCash: ['other_expense', 'fuel'],
  payroll: ['payroll'],
};

/** The order type "Add" opens on a ledger (null for Lists / unknown). */
export const ledgerAddType = (ledger) => LEDGER_TYPES[ledger]?.[0] || null;

/** The ledger's expense orders, newest work date first (then newest recorded). */
export const ledgerOrders = (orders = [], ledger) => {
  const types = LEDGER_TYPES[ledger] || [];
  return orders
    .filter((o) => o && o.family === 'expense' && types.includes(o.type))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.recordedAt || '').localeCompare(a.recordedAt || ''));
};

/** The order details each ledger filters on (besides dates), and the finance list their values come from. */
export const FILTER_FIELDS = {
  machinery: [
    ['machineType', 'machines'],
    ['driver', 'employees'],
  ],
  materials: [['material', 'materials']],
  pettyCash: [['expenseType', 'expenseTypes']],
  payroll: [['employee', 'employees']],
};

/** Orders within [from, to] whose details equal the chosen values ('' = any). */
export const filterLedger = (orders = [], filters = {}) =>
  orders.filter((o) => {
    if (filters.from && o.date < filters.from) return false;
    if (filters.to && o.date > filters.to) return false;
    return Object.entries(filters).every(([k, v]) => k === 'from' || k === 'to' || !v || o.details?.[k] === v);
  });

const amountOf = (o) => {
  const n = Number(o?.amount);
  return Number.isFinite(n) ? n : 0;
};

export const ledgerTotal = (orders = []) => orders.reduce((s, o) => s + amountOf(o), 0);

/** Totals per ledger and overall (every expense type belongs to one ledger). */
export const financeTotals = (orders = []) => {
  const out = {};
  let total = 0;
  LEDGERS.forEach((l) => {
    out[l] = ledgerTotal(ledgerOrders(orders, l));
    total += out[l];
  });
  return { ...out, total };
};

/** Fields the next draft keeps after a save (the slow-changing ones), per order type. */
export const KEEP_AFTER_SAVE = {
  machinery: ['machineType', 'machineSize', 'driver', 'machineRate', 'driverRate', 'fuelPrice'],
  material: ['material', 'materialUnit', 'unitPrice'],
  other_expense: ['expenseType'],
  payroll: ['payStatus'],
};

/**
 * The draft after saving `saved`: `fresh` (a new draft of the same type)
 * with the same date and the kept fields; a computed amount follows them.
 */
export const draftAfterSave = (saved, fresh) => {
  if (!saved || !fresh) return fresh || null;
  const next = { ...fresh, date: saved.date || fresh.date };
  (KEEP_AFTER_SAVE[saved.type] || []).forEach((k) => {
    next[k] = saved[k] ?? '';
  });
  const b = expenseBreakdown(next.type, next);
  if (b) next.amount = b.amount > 0 ? b.amount : '';
  return next;
};

/* ── one-time migration of the old ledger into expense orders ───────────── */

export const MIGRATION_SOURCE = 'finance-migration';

/** Old ledger → the order type its records become. */
export const LEDGER_ORDER_TYPE = { machinery: 'machinery', materials: 'material', pettyCash: 'other_expense', payroll: 'payroll' };

const text = (v) => (v === null || v === undefined ? '' : String(v).trim());
const number = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
// Empty text and zero numbers carry nothing (the old ledger stored 0 for "not entered").
const compact = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => (typeof v === 'number' ? v !== 0 : Boolean(v))));

/** An old ledger record → its order details (the order form's keys; old-only fields kept). */
export const LEGACY_DETAILS = {
  machinery: (r) =>
    compact({
      machineType: text(r.machineType),
      machineSize: text(r.machineSize),
      driver: text(r.operator),
      machineHours: number(r.machineHours),
      machineRate: number(r.machineRate),
      driverHours: number(r.driverHours),
      driverRate: number(r.driverRate),
      fuelLiters: number(r.fuelLiters),
      fuelPrice: number(r.fuelPrice),
      machineName: text(r.machineName),
      badge: text(r.badge),
    }),
  // The old quantity was free text ("150 م3"): kept as written, never parsed.
  materials: (r) => compact({ material: text(r.materialType), quantityText: text(r.quantity), receipt: text(r.receipt), note: text(r.details) }),
  pettyCash: (r) => compact({ expenseType: text(r.expenseType), note: text(r.notes) }),
  payroll: (r) => compact({ employee: text(r.employee), salary: number(r.salary), advance: number(r.advancePayment), payStatus: text(r.status) }),
};

/** An old record's amount exactly as the old ledger totalled it. */
export const legacyAmount = (r) => Number(r?.totalPrice) || 0;

/** The old ledger's total, as its screen showed it. */
export const legacyTotal = (records = []) => records.reduce((s, r) => s + legacyAmount(r), 0);

// Old ids were Date.now() strings: they say when the record was entered.
const recordedAtOf = (r, now) => {
  const id = text(r?.id);
  if (!/^\d{12,14}$/.test(id)) return now;
  const d = new Date(Number(id));
  return Number.isNaN(d.getTime()) ? now : d.toISOString();
};

/**
 * Each record's source id: its own id, or 'i<index>' when it has none; a
 * repeated id gets '~<index>' so every record maps to exactly one order.
 */
const sourceIdsOf = (records) => {
  const seen = new Set();
  return records.map((r, i) => {
    let sid = text(r?.id) || `i${i}`;
    if (seen.has(sid)) sid = `${sid}~${i}`;
    seen.add(sid);
    return sid;
  });
};

/** The order id a migrated record gets — the same on every device, so a re-run (or a second device) adds nothing. */
export const migratedOrderId = (ledger, sourceId) => `fin-${ledger}-${String(sourceId).replace(/[^\w~-]/g, '_')}`;

/** One old ledger record → an approved expense order with its original date. */
export const legacyRecordToOrder = (ledger, record, { sourceId, actorName = '', now }) => {
  const type = LEDGER_ORDER_TYPE[ledger];
  const by = text(record.recordedBy) || actorName || '';
  return {
    id: migratedOrderId(ledger, sourceId),
    type,
    family: 'expense',
    tier: 'quick',
    date: text(record.date),
    recordedAt: recordedAtOf(record, now),
    recordedBy: by,
    taskId: null,
    elementId: null,
    taskWbs: '',
    taskName: '',
    who: { kind: 'none' },
    quantity: null,
    unit: null,
    amount: legacyAmount(record),
    category: ORDER_TYPES[type].label,
    details: LEGACY_DETAILS[ledger](record),
    evidence: [],
    status: 'approved',
    approvedBy: by || null,
    source: MIGRATION_SOURCE,
    sourceLedger: ledger,
    sourceId,
    migratedAt: now,
  };
};

/**
 * The dry run, and the orders a run would add. A record is skipped when it
 * was moved before (`migration.sourceKeys`, so an order deleted since is
 * not brought back) or its order already exists (another device moved it).
 * @param {{ machinery, materials, pettyCash, payroll }} data  the old ledger
 * @param {Array} orders  the current orders
 * @param {{ migration?, actorName?, now? }} ctx
 * @returns {{ ledgers: [{ ledger, count, total, done, doneTotal, toAdd, addTotal }],
 *             count, total, toAdd, addTotal, orders: Order[], sourceKeys: string[] }}
 */
export const planFinanceMigration = (data = {}, orders = [], { migration = null, actorName = '', now = '' } = {}) => {
  const existingIds = new Set(orders.map((o) => o?.id));
  const done = new Set(Array.isArray(migration?.sourceKeys) ? migration.sourceKeys : []);
  orders.forEach((o) => {
    if (o?.source === MIGRATION_SOURCE && o.sourceLedger) done.add(`${o.sourceLedger}:${o.sourceId}`);
  });
  const added = [];
  const ledgers = LEDGERS.map((ledger) => {
    const records = (Array.isArray(data[ledger]) ? data[ledger] : []).filter((r) => r && typeof r === 'object');
    const ids = sourceIdsOf(records);
    const row = { ledger, count: records.length, total: legacyTotal(records), done: 0, doneTotal: 0, toAdd: 0, addTotal: 0 };
    records.forEach((r, i) => {
      const key = `${ledger}:${ids[i]}`;
      if (done.has(key) || existingIds.has(migratedOrderId(ledger, ids[i]))) {
        row.done += 1;
        row.doneTotal += legacyAmount(r);
        done.add(key);
        return;
      }
      added.push(legacyRecordToOrder(ledger, r, { sourceId: ids[i], actorName, now }));
      row.toAdd += 1;
      row.addTotal += legacyAmount(r);
      done.add(key);
    });
    return row;
  });
  const sum = (k) => ledgers.reduce((s, l) => s + l[k], 0);
  return {
    ledgers,
    count: sum('count'),
    total: sum('total'),
    toAdd: sum('toAdd'),
    addTotal: sum('addTotal'),
    orders: added,
    sourceKeys: [...done].sort(),
  };
};

/** The migrated flag kept beside the old ledger after a run (the first run's date and person stay). */
export const migrationFlag = (plan, { previous = null, actorName = '', now }) => ({
  migratedAt: previous?.migratedAt || now,
  migratedBy: previous?.migratedBy ?? actorName,
  lastRunAt: now,
  count: (Number(previous?.count) || 0) + plan.orders.length,
  sourceKeys: plan.sourceKeys,
});

/** After a move: the old ledger vs the orders it became, per ledger ({ count, total, orders, ordersTotal }). */
export const migrationCheck = (data = {}, orders = []) =>
  LEDGERS.map((ledger) => {
    const records = Array.isArray(data[ledger]) ? data[ledger] : [];
    const moved = orders.filter((o) => o?.source === MIGRATION_SOURCE && o.sourceLedger === ledger);
    return { ledger, count: records.length, total: legacyTotal(records), orders: moved.length, ordersTotal: ledgerTotal(moved) };
  });

/* ── dropdown lists ─────────────────────────────────────────────────────── */

/** Dropdown lists: add a trimmed, new value; remove one. */
export const addListItem = (list = [], raw) => {
  const v = String(raw || '').trim();
  return v && !list.includes(v) ? [...list, v] : list;
};

export const removeListItem = (list = [], value) => list.filter((x) => x !== value);
