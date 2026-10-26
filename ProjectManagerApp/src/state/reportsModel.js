// ─────────────────────────────────────────────────────────────
// reportsModel — the Reports area's rules as pure functions.
//
// Daily: one day's orders grouped by item (+ expenses), the days to
// print in a range, and the site-notes filters. Monthly: BOQ progress
// per section (before vs within the month), the month's orders and
// variation orders, quantities per contractor, the money summary.
// Activity: feed filters, one item's story totals, the heatmap (days,
// buckets, Saturday-first weeks) and the empty-days radar.
// Dates are 'YYYY-MM-DD' strings handled as UTC days.
// Tested in __tests__/reportsModel.test.js.
// ─────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const asArray = (v) => (Array.isArray(v) ? v : []);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const parseDay = (s) => new Date(`${s}T00:00:00Z`);
const fmtDay = (d) => d.toISOString().slice(0, 10);

/** Any stored date ('YYYY-MM-DD' or full ISO) → 'YYYY-MM-DD' ('' if none). */
export const dayOf = (value) => {
  const s = String(value || '');
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : fmtDay(d);
};

export const addDays = (day, n) => fmtDay(new Date(parseDay(day).getTime() + n * DAY_MS));

/** 'YYYY-MM' → { start, end, prevEnd } as 'YYYY-MM-DD'. */
export const monthBounds = (mKey) => {
  const [y, m] = String(mKey).split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  return { start: fmtDay(start), end: fmtDay(end), prevEnd: fmtDay(new Date(start.getTime() - DAY_MS)) };
};

export const addMonths = (mKey, n) => {
  const [y, m] = String(mKey).split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return fmtDay(d).slice(0, 7);
};

/**
 * Money value of an order: quantity × the item's contract unit price for
 * quantity orders (falls back to its amount), the amount for expenses.
 */
export const orderValue = (order, taskById) => {
  if (order.family === 'value') {
    const price = num(taskById.get(order.taskId)?.unitPrice);
    const qty = num(order.quantity);
    if (qty && price) return qty * price;
  }
  return num(order.amount);
};

/* ─────────────── Daily ─────────────── */

/**
 * One day's orders: quantity orders grouped by item (orders without an
 * item share one group), expenses, the totals, and `photoIds` — the
 * photos (FileDB ids, `order.evidence`) of all of them, in report order.
 */
export const dayReport = (orders = [], tasks = [], day) => {
  const taskById = new Map(asArray(tasks).map((t) => [t.id, t]));
  const groups = [];
  const byKey = new Map();
  const expenses = [];
  let count = 0;
  let value = 0;
  let expenseTotal = 0;
  let pending = 0;
  asArray(orders).forEach((o) => {
    if (!o || dayOf(o.date) !== day) return;
    count += 1;
    if (o.status !== 'approved') pending += 1;
    if (o.family === 'value') {
      const key = o.taskId || '';
      let g = byKey.get(key);
      if (!g) {
        const task = o.taskId ? taskById.get(o.taskId) : null;
        g = {
          key,
          taskId: o.taskId || '',
          wbs: task?.wbs || o.taskWbs || '',
          name: task?.name || o.taskName || '',
          unit: task?.unit || o.unit || '',
          orders: [],
          qty: 0,
          value: 0,
        };
        byKey.set(key, g);
        groups.push(g);
      }
      g.orders.push(o);
      g.qty += num(o.quantity);
      g.value += orderValue({ ...o, amount: 0 }, taskById);
    } else if (o.family === 'expense') {
      expenses.push(o);
      expenseTotal += num(o.amount);
    }
  });
  groups.forEach((g) => {
    value += g.value;
  });
  const photoIds = [
    ...new Set(
      [...groups.flatMap((g) => g.orders), ...expenses].flatMap((o) => asArray(o.evidence).filter((id) => typeof id === 'string' && id))
    ),
  ];
  return { groups, expenses, count, value, expenseTotal, pending, photoIds, isEmpty: count === 0 };
};

/** Site notes in a range, by engineer: newest day first. */
export const filterNotes = (notes = [], { from = '', to = '', engineer = '' } = {}) =>
  asArray(notes)
    .filter((n) => n && (!from || n.date >= from) && (!to || n.date <= to) && (!engineer || n.engineer === engineer))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.timestamp || 0) - (a.timestamp || 0));

/** Engineers named in the notes, sorted. */
export const engineersOf = (notes = []) => [...new Set(asArray(notes).map((n) => n?.engineer).filter(Boolean))].sort();

/** Days in [from, to] with orders or notes, newest first (what a range prints). */
export const reportDays = (orders = [], notes = [], from, to) => {
  const days = new Set();
  asArray(orders).forEach((o) => {
    const d = dayOf(o?.date);
    if (d && d >= from && d <= to) days.add(d);
  });
  asArray(notes).forEach((n) => {
    if (n?.date && n.date >= from && n.date <= to) days.add(n.date);
  });
  return [...days].sort().reverse();
};

/* ─────────────── Monthly ─────────────── */

export const EXPENSE_CATEGORIES = ['materials', 'payroll', 'machinery', 'fuel', 'other'];

const qtyByUnit = (list, taskById) => {
  const map = new Map();
  list.forEach((o) => {
    const unit = String(taskById.get(o.taskId)?.unit || o.unit || '').trim();
    map.set(unit, (map.get(unit) || 0) + num(o.quantity));
  });
  return [...map.entries()];
};

/**
 * The monthly report for 'YYYY-MM' from the order ledger and computed tasks.
 * Executed quantities count approved quantity orders only.
 */
export const monthlyReport = ({ orders = [], tasks = [], variations = [], month }) => {
  const { start, end, prevEnd } = monthBounds(month);
  const taskById = new Map(asArray(tasks).map((t) => [t.id, t]));
  const inMonth = (d) => d && d >= start && d <= end;
  const all = asArray(orders).filter(Boolean);
  const approvedValue = all.filter((o) => o.family === 'value' && o.status === 'approved');
  const before = approvedValue.filter((o) => {
    const d = dayOf(o.date);
    return d && d <= prevEnd;
  });
  const within = approvedValue.filter((o) => inMonth(dayOf(o.date)));
  const sectionOf = (o) => String(taskById.get(o.taskId)?.wbs || o.taskWbs || '').split('.')[0];

  const boqRows = asArray(tasks)
    .filter((g) => g.isGroup && g.wbs && !g.wbs.includes('.'))
    .map((g) => {
      const leaves = tasks.filter((t) => !t.isGroup && t.wbs && t.wbs.startsWith(`${g.wbs}.`));
      const units = [...new Set(leaves.map((t) => (t.unit || '').trim()).filter(Boolean))];
      const contractQty = leaves.reduce((s, t) => s + num(t.qty ?? t.quantity), 0);
      const prevQty = before.filter((o) => sectionOf(o) === g.wbs).reduce((s, o) => s + num(o.quantity), 0);
      const monthQty = within.filter((o) => sectionOf(o) === g.wbs).reduce((s, o) => s + num(o.quantity), 0);
      const totalQty = prevQty + monthQty;
      return {
        id: g.id,
        wbs: g.wbs,
        name: g.name,
        unit: units.length === 1 ? units[0] : '',
        contractQty,
        prevQty,
        monthQty,
        totalQty,
        remaining: contractQty - totalQty,
        rate: contractQty > 0 ? totalQty / contractQty : null,
      };
    });
  const boqTotals = boqRows.reduce(
    (acc, r) => ({
      contractQty: acc.contractQty + r.contractQty,
      prevQty: acc.prevQty + r.prevQty,
      monthQty: acc.monthQty + r.monthQty,
      totalQty: acc.totalQty + r.totalQty,
      remaining: acc.remaining + r.remaining,
    }),
    { contractQty: 0, prevQty: 0, monthQty: 0, totalQty: 0, remaining: 0 }
  );
  boqTotals.rate = boqTotals.contractQty > 0 ? boqTotals.totalQty / boqTotals.contractQty : null;

  const monthOrders = all.filter((o) => inMonth(dayOf(o.date))).sort((a, b) => dayOf(a.date).localeCompare(dayOf(b.date)));
  const monthVariations = asArray(variations)
    .filter((v) => v && inMonth(dayOf(v.date)))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const byContractor = new Map();
  const internal = [];
  within.forEach((o) => {
    const who = o.who || {};
    if (who.kind === 'contractor' && who.contractorId != null) {
      const id = String(who.contractorId);
      if (!byContractor.has(id)) byContractor.set(id, []);
      byContractor.get(id).push(o);
    } else if (who.kind === 'team' || who.kind === 'workers') {
      internal.push(o);
    }
  });
  const sum = (list) => list.reduce((s, o) => s + orderValue(o, taskById), 0);
  const contractors = [...byContractor.entries()].map(([contractorId, list]) => ({
    contractorId,
    count: list.length,
    qtyByUnit: qtyByUnit(list, taskById),
    value: sum(list),
  }));
  const internalRow = internal.length ? { count: internal.length, qtyByUnit: qtyByUnit(internal, taskById), value: sum(internal) } : null;

  const monthExpenses = monthOrders.filter((o) => o.family === 'expense');
  const known = new Set(EXPENSE_CATEGORIES.filter((c) => c !== 'other'));
  const expenses = EXPENSE_CATEGORIES.map((key) => ({
    key,
    amount: monthExpenses
      .filter((o) => (key === 'other' ? !known.has(o.category) : o.category === key))
      .reduce((s, o) => s + num(o.amount), 0),
  }));
  const expensesTotal = expenses.reduce((s, r) => s + r.amount, 0);
  const valueTotal = sum(monthOrders.filter((o) => o.family === 'value'));

  return {
    bounds: { start, end },
    boqRows,
    boqTotals,
    monthOrders,
    monthVariations,
    contractors,
    internal: internalRow,
    expenses,
    expensesTotal,
    valueTotal,
    net: valueTotal - expensesTotal,
  };
};

/* ─────────────── Activity ─────────────── */

/**
 * Feed entries matching a kind chip ('all' | 'value' | 'expense' |
 * 'variation' | 'event'), a date range and an actor search.
 */
export const filterFeed = (feed = [], { chip = 'all', from = '', to = '', actor = '' } = {}) => {
  const q = actor.trim().toLowerCase();
  return asArray(feed).filter((e) => {
    if (chip === 'variation' || chip === 'event') {
      if (e.kind !== chip) return false;
    } else if (chip !== 'all' && !(e.kind === 'order' && e.family === chip)) return false;
    if (from && (e.date || '') < from) return false;
    if (to && (e.date || '') > to) return false;
    if (q && !(e.actor || '').toLowerCase().includes(q)) return false;
    return true;
  });
};

/** One item's history totals (orders of any status count as recorded work). */
export const taskStoryTotals = (task, { orders = [], variations = [], events = [], tasks = [] } = {}) => {
  const taskById = new Map(asArray(tasks).map((t) => [t.id, t]));
  const own = asArray(orders).filter((o) => o && o.taskId === task.id);
  const value = own.filter((o) => o.family === 'value');
  const executedQty = value.reduce((s, o) => s + num(o.quantity), 0);
  const contractQty = num(task.quantity);
  return {
    unit: task.unit || '',
    contractQty,
    executedQty,
    variance: executedQty - contractQty,
    contractValue: contractQty * num(task.unitPrice),
    executedValue: value.reduce((s, o) => s + orderValue({ ...o, amount: 0 }, taskById), 0),
    orderCount: own.length,
    approvedCount: own.filter((o) => o.status === 'approved').length,
    variationCount: asArray(variations).filter((v) => v && v.taskId === task.id).length,
    eventCount: asArray(events).filter((e) => e && e.refId === task.id).length,
  };
};

/**
 * Per day: count = all orders (was work recorded?), value = approved
 * quantity orders at contract price (the heatmap intensity).
 */
export const dayStats = (orders = [], tasks = []) => {
  const taskById = new Map(asArray(tasks).map((t) => [t.id, t]));
  const map = new Map();
  asArray(orders).forEach((o) => {
    const d = dayOf(o?.date);
    if (!d) return;
    const cur = map.get(d) || { count: 0, value: 0 };
    cur.count += 1;
    if (o.family === 'value' && o.status === 'approved') cur.value += orderValue({ ...o, amount: 0 }, taskById);
    map.set(d, cur);
  });
  return map;
};

/** Intensity bucket 0–4 (quarters of the busiest day). */
export const heatBucket = (value, max) => {
  if (!(value > 0) || !(max > 0)) return 0;
  const r = value / max;
  return r <= 0.25 ? 1 : r <= 0.5 ? 2 : r <= 0.75 ? 3 : 4;
};

/**
 * Week columns (Saturday → Friday, the site week) from the 1st of the month
 * 11 months back up to today, oldest first: [{ month, days: [{ date } | null] }].
 * `month` is set (1–12) on the week where a month's 1st falls.
 */
export const heatCalendar = (today) => {
  const t = parseDay(today);
  let start = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 11, 1));
  start = new Date(start.getTime() - ((start.getUTCDay() + 1) % 7) * DAY_MS); // back to Saturday
  const weeks = [];
  for (let cursor = start; cursor <= t; cursor = new Date(cursor.getTime() + 7 * DAY_MS)) {
    let month = null;
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(cursor.getTime() + i * DAY_MS);
      if (d > t) {
        days.push(null);
        continue;
      }
      if (d.getUTCDate() === 1) month = d.getUTCMonth() + 1;
      days.push({ date: fmtDay(d) });
    }
    weeks.push({ month, days });
  }
  return weeks;
};

/** The last `n` days up to today: how many had orders and how many were empty. */
export const gapRadar = (stats, today, n = 90) => {
  let recorded = 0;
  for (let i = 0; i < n; i++) if ((stats.get(addDays(today, -i))?.count || 0) > 0) recorded += 1;
  return { recorded, empty: n - recorded };
};
