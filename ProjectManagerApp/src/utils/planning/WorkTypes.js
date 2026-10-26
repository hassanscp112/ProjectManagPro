// ─────────────────────────────────────────────────────────────
// WorkTypes — the shared library of work types (global store).
//
// A work type is one kind of site work: unit, trade (crew), productivity
// per crew per working day, crew composition, the rate that prices it,
// matching keywords and what orders taught about its real pace. Templates,
// the plan wizard, BOQ matching and the Lookahead all read it.
//
// Storage: localStorage 'pm-work-types' →
//   { items: [workType], seedVersion, removedSeeds: [id] }
// Seeds (planning/workTypeSeeds.js) are added on first use; a later seed
// version adds only new seed ids, never one the user removed.
// Tested in __tests__/workTypes.test.js.
// ─────────────────────────────────────────────────────────────

import { seedWorkTypes } from './workTypeSeeds.js';
import { isTrade } from './trades.js';

export const WORK_TYPES_KEY = 'pm-work-types';
export const WORK_TYPE_SEED_VERSION = 1;

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `wt_${Date.now()}_${Math.random().toString(36).slice(2)}`;

const readStore = () => {
  try {
    const raw = localStorage.getItem(WORK_TYPES_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeStore = (doc) => {
  try {
    localStorage.setItem(WORK_TYPES_KEY, JSON.stringify(doc));
  } catch {
    /* storage full / unavailable — keep working in memory */
  }
};

const removedOf = (store) => (Array.isArray(store?.removedSeeds) ? store.removedSeeds : []);

/** The library (seeded on first use, topped up with new seeds once). */
export const loadWorkTypes = () => {
  const store = readStore();
  if (store && Array.isArray(store.items)) {
    if ((Number(store.seedVersion) || 0) >= WORK_TYPE_SEED_VERSION) return store.items;
    const have = new Set(store.items.map((w) => w && w.id));
    const removed = new Set(removedOf(store));
    const items = [...store.items, ...seedWorkTypes().filter((w) => !have.has(w.id) && !removed.has(w.id))];
    writeStore({ items, seedVersion: WORK_TYPE_SEED_VERSION, removedSeeds: [...removed] });
    return items;
  }
  const items = seedWorkTypes();
  writeStore({ items, seedVersion: WORK_TYPE_SEED_VERSION, removedSeeds: [] });
  return items;
};

/** Replace the whole list. */
export const saveWorkTypes = (items) => {
  const list = Array.isArray(items) ? items : [];
  writeStore({ items: list, seedVersion: WORK_TYPE_SEED_VERSION, removedSeeds: removedOf(readStore()) });
  return list;
};

/** Clean a work type from an editor (defaults, numbers, known trade). */
export const cleanWorkType = (wt = {}) => {
  const productivity = Number(wt.productivity);
  const fixedDays = parseInt(wt.fixedDays, 10);
  const labour = parseInt(wt.crew?.labour, 10);
  return {
    id: wt.id || uid(),
    name: String(wt.name || '').trim(),
    nameEn: String(wt.nameEn || '').trim(),
    unit: String(wt.unit || '').trim(),
    trade: isTrade(wt.trade) ? wt.trade : 'general',
    productivity: Number.isFinite(productivity) && productivity > 0 ? productivity : 0,
    crew: {
      labour: Number.isFinite(labour) && labour > 0 ? labour : 0,
      equipment: Object.fromEntries(Object.entries(wt.crew?.equipment || {}).filter(([, n]) => Number(n) > 0).map(([k, n]) => [k, Number(n)])),
    },
    rateId: wt.rateId || null,
    keywords: Array.isArray(wt.keywords) ? wt.keywords.filter(Boolean) : [],
    aliases: Array.isArray(wt.aliases) ? wt.aliases.filter(Boolean) : [],
    fixedDays: Number.isFinite(fixedDays) && fixedDays > 0 ? fixedDays : null,
    legacy: Boolean(wt.legacy),
    checked: Boolean(wt.checked),
    source: wt.source || 'user',
    learned: wt.learned || null,
    history: Array.isArray(wt.history) ? wt.history : [],
  };
};

/** Insert or replace one work type. Returns the saved item. */
export const upsertWorkType = (wt) => {
  const clean = cleanWorkType(wt);
  const items = loadWorkTypes();
  const next = items.some((w) => w.id === clean.id) ? items.map((w) => (w.id === clean.id ? clean : w)) : [...items, clean];
  saveWorkTypes(next);
  return clean;
};

/** Remove one work type (a removed seed is never seeded again). */
export const deleteWorkType = (id) => {
  const items = loadWorkTypes();
  const target = items.find((w) => w.id === id);
  const next = items.filter((w) => w.id !== id);
  const store = readStore();
  const removed = new Set(removedOf(store));
  if (target && target.source === 'seed') removed.add(id);
  writeStore({ items: next, seedVersion: WORK_TYPE_SEED_VERSION, removedSeeds: [...removed] });
  return next;
};

/** Map id → work type. */
export const workTypeMap = (items) => new Map((items || []).map((w) => [w.id, w]));

/** Display / generated name in a language (English falls back to Arabic). */
export const workTypeName = (wt, lang) => (wt ? (lang === 'en' && wt.nameEn ? wt.nameEn : wt.name) : '');

/**
 * Days for a quantity: the fixed duration, or ceil(qty ÷ (productivity ×
 * crews)) in normal working days (1–365); null when it can't be computed.
 * (A reduced-pace calendar stretches the dates later, not this number.)
 */
export const durationFor = (qty, { productivity, crews = 1, fixedDays = null } = {}) => {
  if (fixedDays) return fixedDays;
  const q = Number(qty);
  const p = Number(productivity);
  const c = Math.max(1, Number(crews) || 1);
  if (!(q > 0) || !(p > 0)) return null;
  return Math.min(365, Math.max(1, Math.ceil(q / (p * c))));
};
