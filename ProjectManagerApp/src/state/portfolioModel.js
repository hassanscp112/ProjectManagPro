// ─────────────────────────────────────────────────────────────
// portfolioModel — rules of the projects level (above every project):
// checking a new project's details, the tasks a new project starts with
// (blank / copied from another project / from a template), and the summary
// shown on each project card. Pure: storage is passed in, nothing touches
// React. Tests: __tests__/portfolioModel.test.js.
// ─────────────────────────────────────────────────────────────

import { ORDERS_STORAGE_KEY } from '../utils/OrderEngine.js';
import { PLANS_STORAGE_KEY } from '../utils/PlanningStore.js';
import { learnedProductivity } from '../utils/Productivity.js';
import { GanttEngine } from '../utils/GanttEngine.js';
import { generateProject, isPlanTemplate } from '../utils/TemplateEngine.js';
import { planProject } from '../utils/planning/autoPlan.js';
import { loadWorkTypes } from '../utils/planning/WorkTypes.js';
import { keyFor, projectStartDate } from '../utils/Projects.js';
import { DEFAULT_META, addMainTask, loadMeta, loadTasks } from './projectModel.js';

export const START_KINDS = ['template', 'boq', 'blank', 'copy'];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Problems with a new project's details: { name?: 'required', startDate?: 'invalid' }. */
export const validateProjectDraft = (draft = {}) => {
  const errors = {};
  if (!String(draft.name || '').trim()) errors.name = 'required';
  if (!ISO_DATE.test(String(draft.startDate || '')) || Number.isNaN(Date.parse(draft.startDate))) errors.startDate = 'invalid';
  return errors;
};

/** Trimmed details to store. */
export const cleanProjectDraft = (draft = {}) => ({
  name: String(draft.name || '').trim(),
  contract: String(draft.contract || '').trim(),
  location: String(draft.location || '').trim(),
  startDate: String(draft.startDate || ''),
});

/** A blank project: one empty main group to start planning in. */
export const blankProjectTasks = ({ id, name, startDate }) => addMainTask([], { id, name, start: startDate });

const shiftDate = (iso, days) => {
  if (!ISO_DATE.test(String(iso || ''))) return iso;
  const d = new Date(`${iso}T00:00:00Z`);
  return new Date(d.getTime() + days * DAY_MS).toISOString().slice(0, 10);
};

// What a task learned from site work; a copy starts without it.
const EXECUTION_FIELDS = ['orderSource', 'baselineQty', 'execVariance', 'scopeVariance'];

/**
 * Another project's task tree for a new project: same structure, quantities,
 * prices and links, nothing executed, dates moved by the gap between the two
 * start dates.
 */
export const copyProjectTasks = (tasks = [], fromStart, toStart) => {
  const from = Date.parse(`${fromStart}T00:00:00Z`);
  const to = Date.parse(`${toStart}T00:00:00Z`);
  const days = Number.isNaN(from) || Number.isNaN(to) ? 0 : Math.round((to - from) / DAY_MS);
  return tasks.map((task) => {
    const copy = JSON.parse(JSON.stringify(task));
    EXECUTION_FIELDS.forEach((field) => delete copy[field]);
    if (!copy.isGroup) copy.actualQuantity = 0;
    if (copy.manualStart) copy.manualStart = shiftDate(copy.manualStart, days);
    return copy;
  });
};

/**
 * A new project's meta: always a draft (planning), no baseline yet; a
 * generated plan brings its planning settings (calendar, markups, crews).
 */
export const newProjectMeta = (planning = null) => (planning ? { ...DEFAULT_META, variations: [], planning } : { ...DEFAULT_META, variations: [] });

const loadOrders = (storage, project) => {
  try {
    const parsed = JSON.parse(storage?.getItem(keyFor(project, ORDERS_STORAGE_KEY)) || 'null');
    return Array.isArray(parsed?.orders) ? parsed.orders : [];
  } catch {
    return [];
  }
};

const loadPlansOf = (storage, project) => {
  try {
    const parsed = JSON.parse(storage?.getItem(keyFor(project, PLANS_STORAGE_KEY)) || 'null');
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * What happened on site in each project, for learning productivity:
 * [{ project, tasks, orders, plans }] read from each project's own stores.
 */
export const projectsActivity = (projects = [], storage = globalThis.localStorage) =>
  projects.map((project) => ({ project, tasks: loadTasks(storage, project), orders: loadOrders(storage, project), plans: loadPlansOf(storage, project) }));

/** Learned productivity per work type from every project (utils/Productivity). */
export const learnedFromProjects = (projects, workTypes, registries = {}, storage = globalThis.localStorage) =>
  learnedProductivity(projectsActivity(projects, storage), workTypes, registries);

/**
 * Card figures for one project, read from its own stores: status, contract
 * value, actual and planned progress (percent), item count, schedule span
 * and how many orders were recorded.
 */
export const summarizeProject = (project, storage = globalThis.localStorage) => {
  const tasks = loadTasks(storage, project);
  const meta = loadMeta(storage, project);
  const orders = loadOrders(storage, project);
  let result;
  try {
    result = tasks.length ? GanttEngine.calculate(tasks, projectStartDate(project), meta, orders) : null;
  } catch {
    result = null; // a broken project still gets a card
  }
  return {
    status: meta.status || 'draft',
    totalCost: result?.projectTotalCost || 0,
    progress: result?.projectTotalProgress || 0,
    plannedProgress: result?.projectPlannedProgress || 0,
    itemCount: tasks.filter((t) => t && t.isGroup === false).length,
    startDate: result?.scheduleStartDate || projectStartDate(project),
    endDate: result?.scheduleEndDate || null,
    orderCount: orders.length,
  };
};

/** Projects ordered for the list: most recently created first, the first (legacy) one by its date too. */
export const sortProjects = (projects = []) =>
  [...projects].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

/**
 * A template's generated tasks and stats for the given values, or null if
 * it can't be generated. Building templates (schema 2) go through the
 * auto-planner (options: { lang, workTypes, markups }) and also return
 * `planning` for the new project's meta.
 */
export const previewTemplate = (template, values, startDate, rateLibrary, options = {}) => {
  if (!template) return null;
  try {
    if (isPlanTemplate(template)) {
      return planProject(template, values, {
        startDate,
        lang: options.lang || 'ar',
        rates: rateLibrary,
        workTypes: options.workTypes || loadWorkTypes(),
        markups: options.markups,
      });
    }
    return generateProject(template, values, { startDate, rateLibrary });
  } catch {
    return null;
  }
};

/** A template's variables at their default values. */
export const templateDefaults = (template) => Object.fromEntries((template?.variables || []).map((v) => [v.key, v.default]));
