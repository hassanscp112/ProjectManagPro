// ─────────────────────────────────────────────────────────────
// financeModel — the Finance ledgers' rules as pure functions.
//
// Building a record from the form (machinery totals = machine + driver +
// fuel; payroll net = salary − advance when the status is the
// "deducted" value), the filters each ledger offers, totals, and the
// editable dropdown lists. Storage stays in utils/Finance.js.
// Tested in __tests__/financeModel.test.js.
// ─────────────────────────────────────────────────────────────

/** Payroll status value that deducts the advance — stored data, not UI text. */
export const DEDUCTED_STATUS = 'مستقطع';

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/** Form draft → stored record, per ledger. */
export const buildRecord = {
  machinery: (d) => {
    const machineHours = num(d.machineHours);
    const machineRate = num(d.machineRate);
    const driverHours = num(d.driverHours);
    const driverRate = num(d.driverRate);
    const fuelLiters = num(d.fuelLiters);
    const fuelPrice = num(d.fuelPrice);
    const machineTotal = machineHours * machineRate;
    const driverTotal = driverHours * driverRate;
    const fuelTotal = fuelLiters * fuelPrice;
    return {
      date: d.date,
      machineName: (d.machineName || '').trim(),
      machineType: d.machineType || '',
      machineSize: d.machineSize || '',
      badge: (d.badge || '').trim(),
      machineHours,
      machineRate,
      machineTotal,
      operator: (d.operator || '').trim(),
      driverHours,
      driverRate,
      driverTotal,
      fuelLiters,
      fuelPrice,
      fuelTotal,
      totalPrice: machineTotal + driverTotal + fuelTotal,
    };
  },
  materials: (d) => ({
    date: d.date,
    receipt: (d.receipt || '').trim(),
    details: (d.details || '').trim(),
    materialType: d.materialType || '',
    quantity: (d.quantity || '').trim(),
    totalPrice: num(d.totalPrice),
  }),
  pettyCash: (d) => ({
    date: d.date,
    expenseType: d.expenseType || '',
    notes: (d.notes || '').trim(),
    totalPrice: num(d.totalPrice),
  }),
  payroll: (d) => {
    const salary = num(d.salary);
    const advancePayment = num(d.advancePayment);
    return {
      date: d.date,
      employee: (d.employee || '').trim(),
      salary,
      advancePayment,
      status: d.status || '',
      totalPrice: d.status === DEDUCTED_STATUS ? salary - advancePayment : salary,
    };
  },
};

/** Fields each ledger requires before saving. */
export const REQUIRED_FIELDS = {
  machinery: ['date', 'machineName', 'machineHours', 'machineRate', 'operator'],
  materials: ['date', 'details', 'quantity', 'totalPrice'],
  pettyCash: ['date', 'totalPrice'],
  payroll: ['date', 'employee', 'salary'],
};

export const missingFields = (ledger, draft) =>
  (REQUIRED_FIELDS[ledger] || []).filter((f) => String(draft[f] ?? '').trim() === '');

/** The record field each ledger filters on (besides dates). */
export const FILTER_FIELDS = {
  machinery: ['machineType', 'operator'],
  materials: ['materialType'],
  pettyCash: ['expenseType'],
  payroll: ['employee'],
};

/** Records within [from, to] whose filter fields equal the chosen values ('' = any). */
export const filterLedger = (records = [], filters = {}) =>
  records.filter((r) => {
    if (filters.from && r.date < filters.from) return false;
    if (filters.to && r.date > filters.to) return false;
    return Object.entries(filters).every(([k, v]) => k === 'from' || k === 'to' || !v || r[k] === v);
  });

export const ledgerTotal = (records = []) => records.reduce((s, r) => s + (Number(r.totalPrice) || 0), 0);

/** Totals per ledger and overall. */
export const financeTotals = (data) => {
  const out = {};
  let total = 0;
  ['machinery', 'materials', 'pettyCash', 'payroll'].forEach((l) => {
    out[l] = ledgerTotal(data[l]);
    total += out[l];
  });
  return { ...out, total };
};

/** Newest first; ids as the legacy screen made them (timestamp strings). */
export const addRecord = (data, ledger, record, id) => ({ ...data, [ledger]: [{ id, ...record }, ...(data[ledger] || [])] });

export const deleteRecord = (data, ledger, id) => ({ ...data, [ledger]: (data[ledger] || []).filter((r) => r.id !== id) });

/** Dropdown lists: add a trimmed, new value; remove one. */
export const addListItem = (list = [], raw) => {
  const v = String(raw || '').trim();
  return v && !list.includes(v) ? [...list, v] : list;
};

export const removeListItem = (list = [], value) => list.filter((x) => x !== value);
