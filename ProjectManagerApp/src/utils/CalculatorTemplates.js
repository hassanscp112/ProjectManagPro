// ═══════════════════════════════════════════════════════════
// CalculatorTemplates — persistence for the BOQ take-off grids.
// Storage key: 'pm-calculator-templates'
//   [{ id, name, columns: [{ id, name, source: 'input'|'design'|'formula',
//      formula, testValue }], rows: [{ id, name, values: { [colId]: n } }] }]
// Row math lives in CalculatorEngine; grid edits in state/libraryModel.js.
// ═══════════════════════════════════════════════════════════

export const CALC_TEMPLATES_KEY = 'pm-calculator-templates';

export const loadCalcTemplates = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CALC_TEMPLATES_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((t) => t && t.id && Array.isArray(t.columns) && Array.isArray(t.rows)) : [];
  } catch {
    return [];
  }
};

export const saveCalcTemplates = (templates) => {
  try {
    localStorage.setItem(CALC_TEMPLATES_KEY, JSON.stringify(templates));
  } catch {
    // storage full / unavailable — keep working in memory
  }
};
