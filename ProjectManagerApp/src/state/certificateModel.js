// Payment certificates (ذرعات) — the rules behind the Certificates screens.
// Pure functions over the certificates store (utils/Certificates.js), the
// order ledger and the task tree; nothing here reads or writes storage.
//
// A certificate is cumulative, the usual interim payment layout:
//   per item   previous qty + this period = to date, each × the rate
//   totals     gross to date − retention − advance recovery − other
//              deductions = net due to date; − previous certificates' net
//              = net payable now.
// "Previous" figures come from the last issued certificate of the same
// series (kind + contractor), frozen, so the previous column always
// matches what was certified then.

import { certificateProblem, previousCertificates } from '../utils/Certificates.js';

const asArray = (value) => (Array.isArray(value) ? value : []);
const dayOf = (value) => String(value || '').slice(0, 10);
/** Money to 2 decimals; quantities to 6 (drops float noise from sums). */
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const roundQty = (n) => Math.round((Number(n) || 0) * 1e6) / 1e6;

const addDay = (ymd) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/** '1.2.10' after '1.2.9' (numeric per segment). */
export const compareWbs = (a, b) => {
  const pa = String(a || '').split('.');
  const pb = String(b || '').split('.');
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    if (pa[i] === undefined) return -1;
    if (pb[i] === undefined) return 1;
    const diff = (Number(pa[i]) || 0) - (Number(pb[i]) || 0);
    if (diff) return diff;
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
};

/**
 * The orders a certificate counts: approved value orders with a positive
 * quantity on an item, dated up to the period end. A subcontractor
 * certificate counts only that contractor's orders.
 */
export const eligibleOrders = (orders, { kind, contractorId, periodEnd }) =>
  asArray(orders).filter((o) => {
    if (!o || o.family !== 'value' || o.status !== 'approved' || !o.taskId) return false;
    const q = Number(o.quantity);
    if (!Number.isFinite(q) || q <= 0) return false;
    if (periodEnd && dayOf(o.date) > periodEnd) return false;
    if (kind === 'subcontractor') return o.who?.kind === 'contractor' && o.who.contractorId === contractorId;
    return true;
  });

/**
 * The rate of an item, or null when there is none (flagged, never zero):
 * a subcontractor's agreed rate, or the BOQ unit price for the main contract.
 */
export const rateFor = (kind, contractorId, taskId, task, rates) => {
  if (kind === 'employer') {
    const price = Number(task?.unitPrice);
    return Number.isFinite(price) && price > 0 ? price : null;
  }
  const rate = rates?.[contractorId]?.[taskId];
  return typeof rate === 'number' && Number.isFinite(rate) && rate >= 0 ? rate : null;
};

const prevCum = (last, row) => Number(last?.totals?.[row]?.cum) || 0;
const triple = (prev, cum) => ({ prev: round2(prev), this: round2(cum - prev), cum: round2(cum) });

/**
 * Totals from the lines, the certificate's terms and deductions and the
 * previous certificates of its series.
 */
export const certificateTotals = (lines, cert, previous = []) => {
  const last = previous[previous.length - 1] || null;
  const terms = cert.terms || {};
  const gross = triple(prevCum(last, 'gross'), lines.reduce((sum, l) => sum + (l.cumAmount ?? 0), 0));

  // Retention on the gross to date, up to the limit (0 = none).
  const retentionRaw = round2((gross.cum * (Number(terms.retentionPct) || 0)) / 100);
  const limit = Number(terms.retentionLimit) || 0;
  const retention = {
    ...triple(prevCum(last, 'retention'), limit > 0 ? Math.min(retentionRaw, limit) : retentionRaw),
    limited: limit > 0 && retentionRaw > limit,
  };

  // Advance recovery: a share of this period's work, never more than what is left of the advance.
  const advancePrev = prevCum(last, 'advance');
  const left = Math.max(0, (Number(terms.advanceAmount) || 0) - advancePrev);
  const wanted = round2((Math.max(0, gross.this) * (Number(terms.advanceRecoveryPct) || 0)) / 100);
  const advanceThis = Math.min(wanted, round2(left));
  const advance = {
    ...triple(advancePrev, advancePrev + advanceThis),
    remaining: round2(left - advanceThis),
    capped: advanceThis < wanted,
  };

  const deductions = triple(
    prevCum(last, 'deductions'),
    prevCum(last, 'deductions') + asArray(cert.deductions).reduce((sum, d) => sum + (Number(d.amount) || 0), 0)
  );
  const netDue = triple(prevCum(last, 'netDue'), gross.cum - retention.cum - advance.cum - deductions.cum);
  const previousNet = round2(previous.reduce((sum, c) => sum + (Number(c.totals?.netPayable) || 0), 0));
  return {
    gross,
    retention,
    advance,
    deductions,
    netDue,
    previousNet,
    netPayable: round2(netDue.cum - previousNet),
    missingRates: lines.filter((l) => l.missingRate).length,
  };
};

/**
 * Everything a certificate shows. An issued certificate returns what was
 * frozen when it was issued, whatever happened to the orders since. A
 * draft is computed live:
 *   { frozen, periodStart, lines, totals, orderIds, problems, issuable }
 * problems: 'missingRates' · 'noLines' · a certificateProblem() code.
 */
export const computeCertificate = (cert, { certificates = [], rates = {}, tasks = [], orders = [] } = {}) => {
  if (cert.status === 'issued') {
    return {
      frozen: true,
      periodStart: cert.periodStart || '',
      lines: asArray(cert.lines),
      totals: cert.totals || {},
      orderIds: asArray(cert.orderIds),
      problems: [],
      issuable: false,
    };
  }

  const previous = previousCertificates(certificates, cert);
  const last = previous[previous.length - 1] || null;
  const certifiedBefore = new Set(previous.flatMap((c) => asArray(c.orderIds)));
  const fresh = eligibleOrders(orders, cert).filter((o) => !certifiedBefore.has(o.id));

  const thisPeriod = new Map();
  fresh.forEach((o) => {
    const entry = thisPeriod.get(o.taskId) || { qty: 0, count: 0 };
    entry.qty += Number(o.quantity);
    entry.count += 1;
    thisPeriod.set(o.taskId, entry);
  });
  const prevLines = new Map(asArray(last?.lines).map((l) => [l.taskId, l]));
  const taskById = new Map(asArray(tasks).map((t) => [t.id, t]));

  const lines = [...new Set([...prevLines.keys(), ...thisPeriod.keys()])]
    .map((taskId) => {
      const task = taskById.get(taskId);
      const prev = prevLines.get(taskId);
      const rate = rateFor(cert.kind, cert.contractorId, taskId, task, rates);
      const prevQty = roundQty(prev?.cumQty);
      const thisQty = roundQty(thisPeriod.get(taskId)?.qty);
      const cumQty = roundQty(prevQty + thisQty);
      const value = (q) => (rate == null ? null : round2(q * rate));
      return {
        taskId,
        wbs: task?.wbs ?? prev?.wbs ?? '',
        name: task?.name ?? prev?.name ?? '',
        unit: task?.unit ?? prev?.unit ?? '',
        missingTask: !task,
        rate,
        missingRate: rate == null,
        prevQty,
        thisQty,
        cumQty,
        prevAmount: value(prevQty),
        thisAmount: value(thisQty),
        cumAmount: value(cumQty),
        orderCount: thisPeriod.get(taskId)?.count || 0,
      };
    })
    .sort((a, b) => compareWbs(a.wbs, b.wbs));

  const totals = certificateTotals(lines, cert, previous);
  const firstOrder = fresh.map((o) => dayOf(o.date)).filter(Boolean).sort()[0] || '';
  const problems = [];
  const periodProblem = certificateProblem(certificates, cert, cert.id);
  if (periodProblem) problems.push(periodProblem);
  if (lines.length === 0) problems.push('noLines');
  if (totals.missingRates > 0) problems.push('missingRates');
  return {
    frozen: false,
    periodStart: last ? addDay(last.periodEnd) : firstOrder,
    lines,
    totals,
    orderIds: fresh.map((o) => o.id),
    problems,
    issuable: problems.length === 0,
  };
};

/** The list: newest period first, then the higher number; filters { kind: 'all' | kind, contractorId }. */
export const filterCertificates = (certificates, { kind = 'all', contractorId = '' } = {}) =>
  asArray(certificates)
    .filter((c) => (kind === 'all' || c.kind === kind) && (!contractorId || c.contractorId === contractorId))
    .sort((a, b) => (b.periodEnd || '').localeCompare(a.periodEnd || '') || b.number - a.number);

/** Contractors that appear on value orders, for pickers (registry order, then unknown ids). */
export const contractorsOnOrders = (orders) => {
  const ids = new Set();
  asArray(orders).forEach((o) => {
    if (o?.family === 'value' && o.who?.kind === 'contractor' && o.who.contractorId) ids.add(o.who.contractorId);
  });
  return ids;
};

/**
 * Rows of the rates editor (contractor × item): every leaf item with each
 * contractor's rate and who has value orders on it. A contractor with
 * orders on an item but no rate is `missing` there.
 *   [{ task, rates: { [contractorId]: number }, worked: Set, missing: Set }]
 * `onlyWorked` keeps the items some shown contractor has orders on.
 */
export const rateRows = ({ tasks = [], orders = [], rates = {}, contractorIds = [], onlyWorked = false, query = '' }) => {
  const worked = new Map();
  asArray(orders).forEach((o) => {
    if (o?.family !== 'value' || o.who?.kind !== 'contractor' || !o.taskId) return;
    if (!(Number(o.quantity) > 0)) return;
    const set = worked.get(o.taskId) || new Set();
    set.add(o.who.contractorId);
    worked.set(o.taskId, set);
  });
  const q = query.trim().toLowerCase();
  return asArray(tasks)
    .filter((t) => t && !t.isGroup)
    .filter((t) => !q || `${t.wbs || ''} ${t.name || ''}`.toLowerCase().includes(q))
    .map((task) => {
      const by = worked.get(task.id) || new Set();
      const shownWorked = new Set(contractorIds.filter((id) => by.has(id)));
      const taskRates = {};
      contractorIds.forEach((id) => {
        const rate = rateFor('subcontractor', id, task.id, task, rates);
        if (rate != null) taskRates[id] = rate;
      });
      return {
        task,
        rates: taskRates,
        worked: shownWorked,
        missing: new Set([...shownWorked].filter((id) => taskRates[id] == null)),
      };
    })
    .filter((row) => !onlyWorked || row.worked.size > 0)
    .sort((a, b) => compareWbs(a.task.wbs, b.task.wbs));
};
