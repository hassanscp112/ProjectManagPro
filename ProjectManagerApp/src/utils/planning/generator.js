// ─────────────────────────────────────────────────────────────
// generator — a schema-2 building template + the person's answers →
// plan items (before pricing, durations and task ids).
//
//   templateValues(template, values)          defaults filled, numbers
//   buildLevels(template, vars, overrides)    the building's levels
//   expandTemplate(template, values, opts)    { vars, levels, items, issues }
//   resolveLinks(items, template)             item.links from the rules
//
// An item is one element at one level (or once): key 'element@level'
// ('element' for once-scoped), its quantity from the formula, and its
// link rules. Elements whose condition is false, or whose quantity comes
// out 0, produce no item; links to them are skipped. Pure; tested in
// __tests__/generator.test.js.
// ─────────────────────────────────────────────────────────────

import { LEVEL_USES } from './buildingTemplates.js';
import { conditionHolds, evaluate, quantityOf } from './Formula.js';

/** Use codes as formula constants: RESIDENTIAL = 1 … */
export const USE_CONSTANTS = Object.fromEntries(Object.entries(LEVEL_USES).map(([k, v]) => [k.toUpperCase(), v]));

const MAX_LEVELS = 120;

/** Template variables at their values (defaults for blanks; bool → 0/1). */
export const templateValues = (template, values = {}) => {
  const vars = {};
  (template?.variables || []).forEach((v) => {
    const raw = values ? values[v.key] : undefined;
    let n = raw === undefined || raw === null || raw === '' ? Number(v.default) : Number(raw);
    if (!Number.isFinite(n)) n = Number(v.default) || 0;
    if (v.type === 'bool') n = n ? 1 : 0;
    if (v.type === 'int') n = Math.round(n);
    if (Number.isFinite(v.min) && n < v.min) n = v.min;
    if (Number.isFinite(v.max) && n > v.max) n = v.max;
    vars[v.key] = n;
  });
  return vars;
};

/**
 * The levels of the building, bottom up: an optional basement, then the
 * ground floor and the upper floors. `overrides[index]` may change a
 * level's { area, height, use } (shops on the ground floor, a smaller top
 * floor…). → [{ index, key, kind, ordinal, area, height, use, useCode }].
 */
export const buildLevels = (template, vars, overrides = []) => {
  const cfg = template?.levels || {};
  const floors = Math.min(MAX_LEVELS, Math.max(1, Math.round(Number(vars[cfg.count]) || 1)));
  const area = Math.max(0, Number(vars[cfg.area]) || 0);
  const height = Math.max(0, Number(vars[cfg.height]) || 3);
  const levels = [];
  if (cfg.basement && vars[cfg.basement]) levels.push({ kind: 'basement', ordinal: -1, use: cfg.basementUse || 'parking' });
  for (let i = 0; i < floors; i++) levels.push({ kind: i === 0 ? 'ground' : 'upper', ordinal: i, use: i === 0 && cfg.groundUse ? cfg.groundUse : cfg.use || 'residential' });
  return levels.map((level, index) => {
    const o = (Array.isArray(overrides) && overrides[index]) || {};
    const use = LEVEL_USES[o.use] ? o.use : level.use;
    return {
      ...level,
      index,
      key: level.kind === 'basement' ? 'B' : level.ordinal === 0 ? 'G' : String(level.ordinal),
      area: Number(o.area) > 0 ? Number(o.area) : area,
      height: Number(o.height) > 0 ? Number(o.height) : height,
      use,
      useCode: LEVEL_USES[use] || 0,
    };
  });
};

/** Building-wide formula variables (template values + derived sizes). */
export const buildingVars = (template, vars, levels) => {
  const cfg = template?.levels || {};
  const refArea = Math.max(1, Number(vars[cfg.area]) || 1);
  const ground = levels.find((l) => l.kind !== 'basement') || levels[0];
  const above = levels.filter((l) => l.kind !== 'basement');
  const L = Number(vars.length) || 0;
  const W = Number(vars.width) || 0;
  const perimeter = L > 0 && W > 0 ? 2 * (L + W) : 4.2 * Math.sqrt(refArea);
  return {
    ...USE_CONSTANTS,
    ...vars,
    footprint: ground ? ground.area : refArea,
    perimeter,
    totalArea: levels.reduce((s, l) => s + l.area, 0),
    aboveArea: above.reduce((s, l) => s + l.area, 0),
    roofArea: above.length ? above[above.length - 1].area : refArea,
    buildingHeight: above.reduce((s, l) => s + l.height, 0),
    levelsCount: levels.length,
  };
};

const levelVars = (level, levels, bvars, refArea) => ({
  levelArea: level.area,
  levelHeight: level.height,
  levelPerimeter: bvars.perimeter * Math.sqrt(level.area / Math.max(1, refArea)),
  levelIndex: level.index,
  levelsAbove: levels.length - 1 - level.index,
  levelUse: level.useCode,
  isBasement: level.kind === 'basement' ? 1 : 0,
  isGround: level.kind === 'ground' ? 1 : 0,
  isTop: level.index === levels.length - 1 ? 1 : 0,
  isFirst: level.index === 0 ? 1 : 0,
  isLast: level.index === levels.length - 1 ? 1 : 0,
});

/**
 * Expand a template into plan items. options.levelOverrides: per-level
 * { area, height, use }. → { vars, levels, items, issues } where issues are
 * formula problems: { code: 'formula', elementKey, error, names? }.
 */
export const expandTemplate = (template, values = {}, { levelOverrides = [] } = {}) => {
  const vars = templateValues(template, values);
  const levels = buildLevels(template, vars, levelOverrides);
  const bvars = buildingVars(template, vars, levels);
  const refArea = Math.max(1, Number(vars[template?.levels?.area]) || 1);
  const issues = [];
  const reported = new Set();
  const check = (el, src, ctx) => {
    if (!src || reported.has(`${el.key}:${src}`)) return;
    const { error, names } = evaluate(src, ctx);
    if (!error) return;
    reported.add(`${el.key}:${src}`);
    issues.push({ code: 'formula', elementKey: el.key, error, ...(names ? { names } : {}) });
  };

  const items = [];
  const addItem = (el, ctx, level) => {
    check(el, el.when, ctx);
    if (!conditionHolds(el.when, ctx)) return;
    check(el, el.qty, ctx);
    const qty = quantityOf(el.qty, ctx);
    if (!(qty > 0)) return;
    items.push({
      key: level ? `${el.key}@${level.key}` : el.key,
      elementKey: el.key,
      levelIndex: level ? level.index : null,
      section: el.section,
      workTypeId: el.workType,
      name: el.name || null,
      nameEn: el.nameEn || null,
      qty,
      qtyFormula: el.qty,
      crews: Math.max(1, Number(el.crews) || 1),
      rules: Array.isArray(el.links) ? el.links : [],
    });
  };

  (template?.elements || []).forEach((el) => {
    if (!el || !el.key) return;
    if (el.scope === 'level' || el.section === 'level') {
      levels.forEach((level) => addItem(el, { ...bvars, ...levelVars(level, levels, bvars, refArea) }, level));
    } else {
      addItem(el, bvars, null);
    }
  });
  return { vars: bvars, levels, items, issues };
};

/* ─────────────── links ─────────────── */

// Targets on the selected level(s). A level can hold several variants of
// one element (BOQ lines of the same work type): all of them are returned.
const pickLevels = (rule, source, targets) => {
  const byLevel = new Map();
  targets.forEach((t) => {
    if (!byLevel.has(t.levelIndex)) byLevel.set(t.levelIndex, []);
    byLevel.get(t.levelIndex).push(t);
  });
  const indexes = [...byLevel.keys()].sort((a, b) => a - b);
  const sel = rule.floor ?? (source.levelIndex === null ? 'last' : 'same');
  const at = (i) => byLevel.get(i) || [];
  if (sel === 'all') return targets;
  if (sel === 'first') return at(indexes[0]);
  if (sel === 'last') return at(indexes[indexes.length - 1]);
  if (source.levelIndex === null) return at(indexes[indexes.length - 1]); // 'same' etc. from a once-scoped item
  if (sel === 'prev') return at(source.levelIndex - 1);
  if (sel === 'next') return at(source.levelIndex + 1);
  if (sel && typeof sel === 'object' && Number.isFinite(Number(sel.offset))) return at(source.levelIndex + Number(sel.offset));
  if (Number.isFinite(Number(sel)) && typeof sel === 'number') return at(sel);
  return at(source.levelIndex); // 'same'
};

const ruleApplies = (rule, item, levelCount) => {
  if (!rule.if || item.levelIndex === null) return true;
  const i = item.levelIndex;
  switch (rule.if) {
    case 'first':
      return i === 0;
    case 'notFirst':
      return i > 0;
    case 'last':
      return i === levelCount - 1;
    case 'notLast':
      return i < levelCount - 1;
    default:
      return true;
  }
};

/**
 * Turn each item's link rules into links to other items:
 * item.links = [{ to: itemKey, type, lag, lagUnit?, rule }]. A per-level
 * item whose rules all point at items that don't exist on its level waits
 * for the level's anchor element (template.levels.anchor, default 'slab')
 * instead of floating to the project start. → { items, issues } with
 * { code: 'unknownLink', elementKey, to } for rules naming no element.
 */
export const resolveLinks = (items, template, levelCount) => {
  const known = new Set((template?.elements || []).map((e) => e && e.key));
  items.forEach((it) => known.add(it.elementKey)); // BOQ-only items
  const byElement = new Map();
  items.forEach((it) => {
    if (!byElement.has(it.elementKey)) byElement.set(it.elementKey, []);
    byElement.get(it.elementKey).push(it);
  });
  const anchorKey = template?.levels?.anchor || 'slab';
  const issues = [];
  const seenIssue = new Set();

  const out = items.map((item) => {
    const links = [];
    const add = (target, rule) => {
      if (target.key === item.key || links.some((l) => l.to === target.key)) return;
      const link = { to: target.key, type: rule.type || 'FS', lag: Math.trunc(Number(rule.lag) || 0), rule: `${item.elementKey}→${target.elementKey}` };
      if (rule.lagUnit === 'cd') link.lagUnit = 'cd';
      links.push(link);
    };
    item.rules.forEach((rule) => {
      if (!ruleApplies(rule, item, levelCount)) return;
      (Array.isArray(rule.to) ? rule.to : [rule.to]).forEach((to) => {
        if (!known.has(to)) {
          if (!seenIssue.has(`${item.elementKey}>${to}`)) {
            seenIssue.add(`${item.elementKey}>${to}`);
            issues.push({ code: 'unknownLink', elementKey: item.elementKey, to });
          }
          return;
        }
        const targets = byElement.get(to) || [];
        if (!targets.length) return;
        const perLevel = targets[0].levelIndex !== null;
        (perLevel ? pickLevels(rule, item, targets) : targets).forEach((target) => add(target, rule));
      });
    });
    if (!links.length && item.rules.length && item.levelIndex !== null && item.elementKey !== anchorKey) {
      const anchor = (byElement.get(anchorKey) || []).find((t) => t.levelIndex === item.levelIndex);
      // Never wait for an anchor that itself waits for this element (a loop).
      const loops = anchor && anchor.rules.some((r) => (Array.isArray(r.to) ? r.to : [r.to]).includes(item.elementKey));
      if (anchor && !loops) add(anchor, { type: 'FS', lag: 0 });
    }
    return { ...item, links };
  });
  return { items: out, issues };
};
