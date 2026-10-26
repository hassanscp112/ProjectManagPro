// ─────────────────────────────────────────────────────────────
// autoPlan — from plan items to a priced, scheduled task tree.
//
//   priceItems(items, ctx)      unit cost from the rate library, contract
//                               price = cost × (1 + markups%)
//   scheduleItems(items, ctx)   trade, productivity, crews → duration
//   itemsToTasks(items, ctx)    WBS (sections, one group per level),
//                               names in the wizard's language, links
//   planProject(template, values, options)  all of it in one call
//
// Each step takes the person's overrides (quantity, cost, productivity,
// crews, dropped items, switched-off links) so the wizard can re-run the
// whole pipeline on every change. Prices are copied into the tasks
// (copy-on-generate): later library edits never touch a project.
// Tested in __tests__/autoPlan.test.js.
// ─────────────────────────────────────────────────────────────

import { translate } from '../../i18n/index.js';
import { findRateById, findRateByName } from '../RateLibrary.js';
import { OTHER_SECTION, applyBoq } from './boqPlan.js';
import { expandTemplate, resolveLinks } from './generator.js';
import { writeLinks } from './links.js';
import { taskResources } from './resources.js';
import { durationFor, workTypeMap, workTypeName } from './WorkTypes.js';

export const DEFAULT_MARKUPS = { overhead: 10, contingency: 5, profit: 10 };
export const PLANNING_VERSION = 1;

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `tsk_${Date.now()}_${Math.random().toString(36).slice(2)}`;

/** Σ of the markup percentages (negative / invalid count as 0). */
export const markupPercent = (markups = {}) =>
  ['overhead', 'contingency', 'profit'].reduce((sum, k) => sum + Math.max(0, Number(markups?.[k]) || 0), 0);

/** Contract unit price for a direct cost: cost × (1 + Σ% / 100), whole dinars. */
export const priceWithMarkups = (cost, markups) => Math.round((Math.max(0, Number(cost) || 0) * (100 + markupPercent(markups))) / 100);

const asMap = (items) => (items instanceof Map ? items : workTypeMap(items));

/**
 * Unit, rate and prices for each item. ctx: { workTypes, rates, markups,
 * costOverrides: { itemKey: cost } }. An item from a contract BOQ keeps the
 * BOQ's price (contractRate) as its unit price — markups don't apply, the
 * rate library's cost shows the margin. `priced` = it has a price.
 */
export const priceItems = (items, { workTypes = [], rates = [], markups = DEFAULT_MARKUPS, costOverrides = {} } = {}) => {
  const wts = asMap(workTypes);
  return items.map((item) => {
    const wt = wts.get(item.workTypeId) || null;
    const rate = wt ? findRateById(rates, wt.rateId) || findRateByName(rates, wt.name) : null;
    const override = Number(costOverrides[item.key]);
    const unitCost = Number.isFinite(override) && override >= 0 && costOverrides[item.key] !== '' && costOverrides[item.key] != null ? override : rate ? Math.max(0, Number(rate.unitPrice) || 0) : 0;
    const contract = Number(item.contractRate) > 0 ? Math.round(Number(item.contractRate) * 100) / 100 : null;
    return {
      ...item,
      unit: item.unit || (wt ? wt.unit : rate ? rate.unit : ''),
      rateId: rate ? rate.id : null,
      unitCost,
      unitPrice: contract ?? priceWithMarkups(unitCost, markups),
      priced: contract ? true : unitCost > 0,
    };
  });
};

/** Default target durations (working days) that size the crews on a task. */
export const CREW_TARGET_DAYS = { level: 20, once: 40 };
export const MAX_CREWS_PER_TASK = 6;

/**
 * Crews to put on one task: as many as it takes to finish within the
 * target days (one per level, longer for building-wide items), 1 to 6 —
 * what a planner does when sizing gangs. The person can fix it per trade.
 */
export const autoCrews = (qty, productivity, target) => {
  const q = Number(qty);
  const p = Number(productivity);
  if (!(q > 0) || !(p > 0) || !(target > 0)) return 1;
  return Math.min(MAX_CREWS_PER_TASK, Math.max(1, Math.ceil(q / (p * target))));
};

/**
 * Trade, productivity, crews and duration for each item. ctx:
 * { workTypes, productivity: { workTypeId: qtyPerCrewDay }, crews: { trade: n }
 *   (crews per task for that trade; default: autoCrews), targetDays }.
 * Items without a productivity get 1 day and noProductivity: true.
 */
export const scheduleItems = (items, { workTypes = [], productivity = {}, crews = {}, targetDays = CREW_TARGET_DAYS } = {}) => {
  const wts = asMap(workTypes);
  return items.map((item) => {
    const wt = wts.get(item.workTypeId) || null;
    const trade = wt ? wt.trade : 'general';
    const p = Number(productivity[item.workTypeId]) > 0 ? Number(productivity[item.workTypeId]) : wt ? Number(wt.productivity) || 0 : 0;
    const fixed = Number(crews[trade]);
    const target = item.levelIndex === null ? targetDays.once : targetDays.level;
    const crewCount = fixed >= 1 ? Math.round(fixed) : Math.max(item.crews || 1, autoCrews(item.qty, p, target));
    const fixedDays = wt?.fixedDays || null;
    const days = durationFor(item.qty, { productivity: p, crews: crewCount, fixedDays });
    return {
      ...item,
      trade,
      productivity: p,
      crews: crewCount,
      duration: days ?? 1,
      durationSource: fixedDays ? 'fixed' : days ? 'productivity' : 'manual',
      noProductivity: days === null,
    };
  });
};

/* ─────────────── names ─────────────── */

const ORDINALS = 10;

/** A level's name in a language: basement, ground floor, first…tenth floor, floor N. */
export const levelName = (level, lang = 'ar') => {
  if (!level) return '';
  if (level.kind === 'basement') return translate(lang, 'planning.level.basement');
  if (level.ordinal === 0) return translate(lang, 'planning.level.ground');
  if (level.ordinal <= ORDINALS) return translate(lang, `planning.level.floor${level.ordinal}`);
  return translate(lang, 'planning.level.floorN', { n: level.ordinal });
};

const itemName = (item, wt, lang) => (lang === 'en' ? item.nameEn || workTypeName(wt, 'en') || item.name : item.name || workTypeName(wt, 'ar')) || item.workTypeId;

/* ─────────────── tasks ─────────────── */

/**
 * The task tree: one top-level group per template section (the 'level'
 * section becomes one group per level), leaves in element order. ctx:
 * { template, levels, workTypes, startDate, lang, wbsOffset, dropped:
 * Set(itemKey), disabledLinks: Set('from>to') }. Leaves without links start
 * on the start date. → { tasks, idByKey }.
 */
export const itemsToTasks = (items, { template, levels = [], workTypes = [], startDate, lang = 'ar', wbsOffset = 1, dropped = new Set(), disabledLinks = new Set() } = {}) => {
  const wts = asMap(workTypes);
  // Removed items (dropped by the person, or template work the BOQ leaves out)
  // make no task; the items waiting for them inherit their predecessors.
  const removed = new Set([...dropped, ...items.filter((it) => it.leftOut).map((it) => it.key)]);
  const kept = items.filter((it) => !removed.has(it.key));
  const idByKey = new Map(kept.map((it) => [it.key, uid()]));
  const byKey = new Map(items.map((it) => [it.key, it]));
  const effectiveLinks = (item) => {
    const out = [];
    const seen = new Set();
    const visit = (links, depth) =>
      links.forEach((l) => {
        if (depth === 0 && disabledLinks.has(`${item.key}>${l.to}`)) return;
        if (!removed.has(l.to)) {
          if (idByKey.has(l.to) && !seen.has(l.to) && l.to !== item.key) {
            seen.add(l.to);
            out.push(l);
          }
          return;
        }
        if (depth > 25 || seen.has(`~${l.to}`)) return;
        seen.add(`~${l.to}`);
        const ghost = byKey.get(l.to);
        if (ghost) visit(ghost.links || [], depth + 1);
      });
    visit(item.links || [], 0);
    return out;
  };
  const tasks = [];
  let top = Math.max(0, parseInt(wbsOffset, 10) || 0);

  const group = (name) => {
    const task = { id: uid(), wbs: String(top), name, isGroup: true, manualStart: null, duration: 1, quantity: 0, actualQuantity: 0, unitPrice: 0, unit: '', dependsOn: null, depType: '', lag: 0 };
    top += 1;
    return task;
  };
  const leaf = (item, wbs) => {
    const wt = wts.get(item.workTypeId) || null;
    const base = itemName(item, wt, lang);
    const level = item.levelIndex !== null ? levels[item.levelIndex] : null;
    const links = effectiveLinks(item).map((l) => ({ id: idByKey.get(l.to), type: l.type, lag: l.lag, ...(l.lagUnit === 'cd' ? { lagUnit: 'cd' } : {}) }));
    const task = writeLinks(
      {
        id: idByKey.get(item.key),
        wbs,
        name: level ? translate(lang, 'planning.gen.atLevel', { name: base, level: levelName(level, lang) }) : base,
        isGroup: false,
        manualStart: null,
        duration: item.duration ?? 1,
        quantity: item.qty,
        actualQuantity: 0,
        unitPrice: item.unitPrice ?? 0,
        unit: item.unit || (wt ? wt.unit : ''),
        workTypeId: item.workTypeId,
        trade: item.trade || (wt ? wt.trade : 'general'),
        crews: item.crews || 1,
        // People and equipment it uses at once: the work type's crew × crews.
        ...(taskResources(wt, item.crews || 1) ? { resources: taskResources(wt, item.crews || 1) } : {}),
        productivity: item.productivity ?? (wt ? wt.productivity : 0),
        durationSource: item.durationSource || 'productivity',
        unitCost: item.unitCost ?? 0,
        templateKey: item.elementKey,
        floor: item.levelIndex,
        ...(item.boqRow !== undefined ? { boqNo: item.boqNo || '' } : {}),
      },
      links
    );
    if (!links.length) task.manualStart = startDate;
    return task;
  };

  (template?.sections || []).forEach((section) => {
    const ofSection = kept.filter((it) => it.section === section.key);
    if (!ofSection.length) return;
    const blocks =
      section.key === 'level'
        ? levels.map((level) => ({ name: levelName(level, lang), items: ofSection.filter((it) => it.levelIndex === level.index) }))
        : [{ name: lang === 'en' ? section.nameEn || section.name : section.name, items: ofSection }];
    blocks.forEach((block) => {
      if (!block.items.length) return;
      const g = group(block.name);
      tasks.push(g);
      block.items.forEach((item, i) => tasks.push(leaf(item, `${g.wbs}.${i + 1}`)));
    });
  });
  return { tasks, idByKey };
};

/**
 * Everything at once: expand → links → prices → durations → tasks.
 * options: { startDate, lang, workTypes, rates, markups, levelOverrides,
 * qtyOverrides: { itemKey: qty }, costOverrides, productivity, crews,
 * dropped: Set, disabledLinks: Set, calendar, wbsOffset }.
 * → { levels, items, tasks, stats, issues, planning }.
 */
export const planProject = (template, values = {}, options = {}) => {
  const {
    startDate,
    lang = 'ar',
    workTypes = [],
    rates = [],
    markups = DEFAULT_MARKUPS,
    levelOverrides = [],
    qtyOverrides = {},
    costOverrides = {},
    productivity = {},
    crews = {},
    dropped = new Set(),
    disabledLinks = new Set(),
    calendar = null,
    wbsOffset = 1,
    boq = null, // { lines, assignments: Map row → workTypeId }
  } = options;
  const wts = asMap(workTypes);
  const expanded = expandTemplate(template, values, { levelOverrides });
  // A contract BOQ replaces the template's quantities and prices.
  const fromBoq = boq ? applyBoq(expanded.items, boq.lines, boq.assignments, wts) : null;
  const skeleton = fromBoq ? { ...template, sections: [...(template.sections || []), OTHER_SECTION] } : template;
  const withQty = (fromBoq ? fromBoq.items : expanded.items).map((it) => {
    const q = Number(qtyOverrides[it.key]);
    const base = { ...it, qtyBase: it.qty };
    return qtyOverrides[it.key] !== undefined && qtyOverrides[it.key] !== '' && Number.isFinite(q) && q >= 0 ? { ...base, qty: q, qtyEdited: true } : base;
  });
  const linked = resolveLinks(withQty, skeleton, expanded.levels.length);
  const priced = priceItems(linked.items, { workTypes: wts, rates, markups, costOverrides });
  const items = scheduleItems(priced, { workTypes: wts, productivity, crews });
  const { tasks } = itemsToTasks(items, { template: skeleton, levels: expanded.levels, workTypes: wts, startDate, lang, wbsOffset, dropped, disabledLinks });

  const live = items.filter((it) => !dropped.has(it.key) && !it.leftOut);
  const nameOf = (it) => tasks.find((t) => t.templateKey === it.elementKey && t.floor === it.levelIndex)?.name || it.key;
  const missingTypes = [...new Set(live.filter((it) => it.workTypeId && !wts.has(it.workTypeId)).map((it) => it.workTypeId))];
  const stats = {
    taskCount: tasks.length,
    groupCount: tasks.filter((t) => t.isGroup).length,
    leafCount: tasks.filter((t) => !t.isGroup).length,
    directCost: live.reduce((s, it) => s + it.qty * it.unitCost, 0),
    totalCost: live.reduce((s, it) => s + it.qty * it.unitPrice, 0),
    pricedCount: live.filter((it) => it.priced).length,
    unpriced: live.filter((it) => !it.priced).map(nameOf),
    noProductivity: live.filter((it) => it.noProductivity).map(nameOf),
    levelCount: expanded.levels.length,
    boq: fromBoq ? fromBoq.info : null,
  };
  return {
    levels: expanded.levels,
    items,
    tasks,
    stats,
    issues: [...expanded.issues, ...linked.issues, ...missingTypes.map((id) => ({ code: 'unknownWorkType', workTypeId: id }))],
    planning: { version: PLANNING_VERSION, calendar, markups: { ...DEFAULT_MARKUPS, ...markups }, crews: { ...crews } },
  };
};
