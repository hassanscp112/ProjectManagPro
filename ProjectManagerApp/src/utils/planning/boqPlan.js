// ─────────────────────────────────────────────────────────────
// boqPlan — a contract BOQ poured into a building template.
//
// The template is the logic skeleton (levels, sequence, links); the BOQ is
// the contract (quantities, descriptions, prices). For every work type the
// BOQ lines were matched to:
//   · each line is spread over that work type's template items (per level,
//     or once) in proportion to the template's own quantities — so floor
//     items get each floor's share and building-wide items get it all;
//   · several lines of one work type (blockwork 20 cm and 15 cm…) become
//     variants of the same items, linked the same way;
//   · template items with no BOQ line are left out (not in the contract) —
//     they stay in the list marked leftOut, so the items waiting for them
//     inherit their predecessors (autoPlan.itemsToTasks);
//   · a line of a work type the template doesn't use takes the place of a
//     template work type of the same family (ceramic tiles where the
//     template has porcelain; brick walls where it has block walls);
//   · lines of other work types, or of none, go to "Other BOQ items"
//     without links (the review flags them).
// Items keep the line's description, unit and price (contract rate).
// Pure; tested in __tests__/boqPlan.test.js.
// ─────────────────────────────────────────────────────────────

export const OTHER_SECTION = { key: 'other', name: 'فقرات أخرى من جدول الكميات', nameEn: 'Other BOQ items' };

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * items: expanded template items; lines: BOQ item lines; assignments: Map
 * row → workTypeId | null. → { items, info: { lines, placed, unplaced,
 * unassigned, leftOut: [elementKey], unitMismatch: [row] } }.
 */
export const applyBoq = (items, lines, assignments, workTypes = new Map()) => {
  const itemLines = (lines || []).filter((l) => l.kind === 'item');
  const byType = new Map();
  items.forEach((it) => {
    if (!byType.has(it.workTypeId)) byType.set(it.workTypeId, []);
    byType.get(it.workTypeId).push(it);
  });
  // A template work type of the same family takes a line whose own type the template lacks.
  const familySlot = (wtId) => {
    const family = workTypes.get(wtId)?.family;
    if (!family) return null;
    return [...byType.keys()].find((id) => workTypes.get(id)?.family === family) || null;
  };
  const linesByType = new Map();
  const other = [];
  itemLines.forEach((line) => {
    const wt = assignments.get(line.row) || null;
    const slot = wt && byType.has(wt) ? wt : wt ? familySlot(wt) : null;
    if (slot) {
      if (!linesByType.has(slot)) linesByType.set(slot, []);
      linesByType.get(slot).push({ ...line, workTypeId: wt });
    } else {
      other.push({ line, workTypeId: wt });
    }
  });

  const out = [];
  const leftOut = new Set();
  const unitMismatch = [];
  items.forEach((it) => {
    const typeLines = linesByType.get(it.workTypeId);
    if (!typeLines) {
      leftOut.add(it.elementKey);
      out.push({ ...it, leftOut: true });
      return;
    }
    const siblings = byType.get(it.workTypeId);
    const total = siblings.reduce((s, x) => s + x.qty, 0);
    const share = total > 0 ? it.qty / total : 1 / siblings.length;
    typeLines.forEach((line) => {
      out.push({
        ...it,
        workTypeId: line.workTypeId,
        key: typeLines.length > 1 ? `${it.key}#${line.row}` : it.key,
        qty: round2(line.qty * share),
        unit: line.unit || it.unit,
        name: line.description,
        nameEn: line.description,
        contractRate: Number(line.rate) > 0 ? Number(line.rate) : null,
        boqRow: line.row,
        boqNo: line.no || '',
      });
    });
  });

  other.forEach(({ line, workTypeId }, i) => {
    const wt = workTypeId ? workTypes.get(workTypeId) : null;
    out.push({
      key: `boq#${line.row}`,
      elementKey: `boq${i}`,
      levelIndex: null,
      section: OTHER_SECTION.key,
      workTypeId: workTypeId || null,
      name: line.description,
      nameEn: line.description,
      qty: Number(line.qty) || 0,
      qtyFormula: '',
      unit: line.unit || (wt ? wt.unit : ''),
      crews: 1,
      rules: [],
      contractRate: Number(line.rate) > 0 ? Number(line.rate) : null,
      boqRow: line.row,
      boqNo: line.no || '',
      unplaced: true,
    });
  });

  itemLines.forEach((line) => {
    const wt = workTypes.get(assignments.get(line.row));
    if (wt && line.unit && wt.unit && line.unit !== wt.unit) unitMismatch.push(line.row);
  });

  return {
    items: out,
    info: {
      lines: itemLines.length,
      placed: itemLines.length - other.length,
      unplaced: other.filter((o) => o.workTypeId).length,
      unassigned: other.filter((o) => !o.workTypeId).length,
      leftOut: [...leftOut],
      unitMismatch,
    },
  };
};
