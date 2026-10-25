// ─────────────────────────────────────────────────────────────
// taskDetailsModel — the full task details page's rules (pure).
//
// Element columns ("quantity types", e.g. C25 / C20) and elements
// (manholes, sections, stations) live on a task as `elementColumns` and
// `elements`. This module sums them, compares each column with its linked
// BOQ leaf, sorts the elements map, rolls up the orders on the item, and
// edits columns / elements immutably. BOQ linking itself stays in
// projectModel (toggleBoqLink / linkExistingBoq).
// Tested in __tests__/taskDetailsModel.test.js.
// ─────────────────────────────────────────────────────────────

export const ELEMENT_STATUSES = ['not_started', 'in_progress', 'completed', 'on_hold'];
/** Read order: in progress, on hold, not started, completed last. */
const STATUS_SORT = { in_progress: 0, on_hold: 1, not_started: 2, completed: 3 };

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const clamp01 = (v) => Math.min(1, Math.max(0, toNum(v)));
const wbsParts = (wbs) => String(wbs || '').split('.').map((n) => parseInt(n, 10) || 0);
const byWbs = (a, b) => {
  const ap = wbsParts(a.wbs);
  const bp = wbsParts(b.wbs);
  for (let i = 0; i < Math.max(ap.length, bp.length); i++) if ((ap[i] || 0) !== (bp[i] || 0)) return (ap[i] || 0) - (bp[i] || 0);
  return 0;
};

/** Σ per column over all elements: { [colId]: number }. */
export const columnSums = (columns = [], elements = []) => {
  const sums = Object.fromEntries(columns.map((c) => [c.id, 0]));
  elements.forEach((el) => columns.forEach((c) => (sums[c.id] += toNum(el?.values?.[c.id]))));
  return sums;
};

/** How many elements are in each status. */
export const statusCounts = (elements = []) => {
  const counts = { not_started: 0, in_progress: 0, completed: 0, on_hold: 0 };
  elements.forEach((el) => {
    if (counts[el.status] !== undefined) counts[el.status] += 1;
  });
  return counts;
};

/**
 * One card per column: contract (linked leaf's quantity, else the column sum
 * with waste), executed / remaining / rate from the linked leaf, and the
 * reconciliation delta (leaf's element sum − its contract quantity).
 */
export const quantityRows = (columns = [], sums = {}, computedById = new Map()) =>
  columns.map((col) => {
    const rawSum = sums[col.id] || 0;
    const waste = toNum(col.wasteFactorPct);
    const leaf = col.linkedTaskId ? computedById.get(col.linkedTaskId) || null : null;
    const contract = leaf ? toNum(leaf.quantity) : rawSum * (1 + waste / 100);
    const executed = leaf ? toNum(leaf.actualQty) : null;
    return {
      col,
      leaf,
      rawSum,
      waste,
      contract,
      executed,
      remaining: executed != null ? contract - executed : null,
      rate: leaf && contract > 0 ? clamp01(executed / contract) : null,
      reconDelta: leaf && leaf.elementSum != null ? toNum(leaf.elementSum) - contract : null,
    };
  });

/** Elements in read order (stable within a status): [{ el, index }]. */
export const sortedElements = (elements = []) =>
  elements
    .map((el, index) => ({ el, index }))
    .sort((a, b) => (STATUS_SORT[a.el.status] ?? 2) - (STATUS_SORT[b.el.status] ?? 2) || a.index - b.index);

/** Direct WBS children of a group, in WBS order. */
export const directChildren = (tasks = [], task) => {
  if (!task?.wbs || !task.isGroup) return [];
  const depth = task.wbs.split('.').length;
  return tasks.filter((t) => t.wbs && t.wbs.startsWith(`${task.wbs}.`) && t.wbs.split('.').length === depth + 1).sort(byWbs);
};

/** Children that can be linked to a column: leaves not already BOQ-linked. */
export const linkableLeaves = (children = []) => children.filter((c) => !c.isGroup && !c.boqLink);

/** Orders on the item's scope: per contractor (count, quantity, expenses) and evidence counts. */
export const orderRollup = (scopeOrders = [], contractors = []) => {
  const byContractor = new Map();
  let tests = 0;
  let completions = 0;
  let expenses = 0;
  scopeOrders.forEach((o) => {
    if (o.type === 'concrete_test' || o.type === 'soil_test') tests += 1;
    if (o.type === 'completion') completions += 1;
    if (o.family === 'expense') expenses += toNum(o.amount);
    if (o.who?.kind !== 'contractor' || !o.who.contractorId) return;
    const entry = byContractor.get(o.who.contractorId) || {
      id: o.who.contractorId,
      name: contractors.find((c) => c.id === o.who.contractorId)?.name || null,
      count: 0,
      qty: 0,
      expense: 0,
    };
    entry.count += 1;
    if (o.family === 'value') entry.qty += toNum(o.quantity);
    else entry.expense += toNum(o.amount);
    byContractor.set(o.who.contractorId, entry);
  });
  return { contractors: [...byContractor.values()].sort((a, b) => b.count - a.count), tests, completions, expenses };
};

/** Whole days from start to end ('YYYY-MM-DD'), or null. */
export const spanDays = (start, end) => {
  const s = Date.parse(start);
  const e = Date.parse(end);
  return Number.isFinite(s) && Number.isFinite(e) ? Math.max(0, Math.round((e - s) / 86400000)) : null;
};

/* ─────────────── edits (return task patches) ─────────────── */

export const newElement = (id) => ({ id, name: '', location: '', status: 'not_started', notes: '', values: {} });

export const newColumn = (id, { name, unit }) => ({ id, name, unit, wasteFactorPct: 0, linkedTaskId: null });

export const patchElement = (elements, id, patch) => elements.map((el) => (el.id === id ? { ...el, ...patch } : el));

export const setElementValue = (elements, id, colId, raw) =>
  elements.map((el) => (el.id === id ? { ...el, values: { ...el.values, [colId]: raw === '' ? '' : toNum(raw) } } : el));

export const patchColumn = (columns, id, patch) => columns.map((c) => (c.id === id ? { ...c, ...patch } : c));

/** Removing a column also removes its values from every element. */
export const removeColumnPatch = (columns, elements, colId) => ({
  elementColumns: columns.filter((c) => c.id !== colId),
  elements: elements.map((el) => {
    const values = { ...el.values };
    delete values[colId];
    return { ...el, values };
  }),
});
