// ─────────────────────────────────────────────────────────────
// libraryModel — the Library area's rules as pure functions.
//
// BOQ take-off grids (rows, cells recalculated by CalculatorEngine,
// column totals), the template builder's draft check, and the virtual
// folders of the Files page. Storage stays in utils/ (CalculatorTemplates,
// TemplateEngine, RateLibrary, FileDB). Tested in __tests__/libraryModel.test.js.
// ─────────────────────────────────────────────────────────────

import { calculateRow } from '../utils/CalculatorEngine.js';

/* ─────────────── BOQ grids ─────────────── */

const SUMMED = new Set(['input', 'design', 'formula']);

/** Σ per column over all rows (every column type is numeric). */
export const columnTotals = (template) => {
  const sums = {};
  template.columns.forEach((col) => {
    if (SUMMED.has(col.source)) sums[col.id] = template.rows.reduce((acc, row) => acc + (parseFloat(row.values[col.id]) || 0), 0);
  });
  return sums;
};

export const addCalcRow = (template, { id, name }) => ({ ...template, rows: [...template.rows, { id, name, values: {} }] });

export const removeCalcRow = (template, rowId) => ({ ...template, rows: template.rows.filter((r) => r.id !== rowId) });

export const renameCalcRow = (template, rowId, name) => ({
  ...template,
  rows: template.rows.map((r) => (r.id === rowId ? { ...r, name } : r)),
});

/** Set one input cell and recompute the row's formula columns. */
export const setCalcCell = (template, rowId, colId, value) => ({
  ...template,
  rows: template.rows.map((r) => (r.id === rowId ? calculateRow({ ...r, values: { ...r.values, [colId]: value } }, template.columns) : r)),
});

/** Insert or replace a grid in the list. */
export const upsertCalcTemplate = (list, template) =>
  list.some((t) => t.id === template.id) ? list.map((t) => (t.id === template.id ? template : t)) : [...list, template];

/* ─────────────── template builder ─────────────── */

/**
 * Check a builder draft and turn it into a template to save:
 * → { error: 'name' | 'elements' } or { template }. Variables without a key
 * are dropped; "repeats per" must name a variable; "depends on" must point
 * at another element.
 */
export const cleanTemplateDraft = (draft) => {
  if (!(draft.name || '').trim()) return { error: 'name' };
  if (!draft.elements.length) return { error: 'elements' };
  const variables = draft.variables.filter((v) => (v.key || '').trim()).map((v) => ({ ...v, key: v.key.trim(), default: Number(v.default) || 0 }));
  const keys = new Set(variables.map((v) => v.key));
  const elements = draft.elements.map((el, i) => {
    const dep = el.depOn === null || el.depOn === '' || el.depOn === undefined ? null : Number(el.depOn);
    return {
      ...el,
      lag: Number(el.lag) || 0,
      repeatsVar: el.repeatsVar && keys.has(el.repeatsVar) ? el.repeatsVar : null,
      depOn: Number.isInteger(dep) && dep >= 0 && dep < draft.elements.length && dep !== i ? dep : null,
    };
  });
  return {
    template: { name: draft.name.trim(), icon: draft.icon || '🏗️', variables, elements, version: 1, source: 'custom' },
  };
};

/* ─────────────── files ─────────────── */

export const FOLDER_ROOT = 'root';
export const FOLDER_TASKS = 'tasks_root';
/** Folder id of a top-level section (the only per-item folders). */
export const sectionFolderId = (section) => `task_${section.id}`;

const topSections = (tasks) => tasks.filter((t) => t.wbs && !t.wbs.includes('.'));

/** Sub-folders of a folder: root → "Items"; Items → one per top-level section. */
export const childFolders = (folderId, tasks = []) => {
  if (folderId === FOLDER_ROOT) return [{ id: FOLDER_TASKS }];
  if (folderId === FOLDER_TASKS) return topSections(tasks).map((s) => ({ id: sectionFolderId(s), task: s }));
  return [];
};

/** Breadcrumb from the root to the folder of an item's top-level section. */
export const folderPathFor = (task, tasks = []) => {
  const path = [{ id: FOLDER_ROOT }, { id: FOLDER_TASKS }];
  const section = task?.wbs ? tasks.find((t) => t.wbs === task.wbs.split('.')[0]) : null;
  if (section) path.push({ id: sectionFolderId(section), task: section });
  return path;
};

/** 1536 → '1.5 KB'. */
export const formatBytes = (bytes) => {
  const b = Number(bytes) || 0;
  if (b === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
  return `${parseFloat((b / 1024 ** i).toFixed(i ? 1 : 0))} ${units[i]}`;
};
