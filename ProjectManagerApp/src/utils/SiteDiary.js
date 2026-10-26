// ─────────────────────────────────────────────────────────────
// SiteDiary — persistence for the site diary: one entry per day with
// the weather, working hours, manpower by trade, equipment on site,
// visitors and issues (FIDIC-style contemporary records). Plain JS,
// localStorage only. Screen rules (prefill from the day plan, "same as
// yesterday", totals) live in state/diaryModel.js.
//
// Storage key: 'pm-site-diary' (project-scoped, see storeRegistry)
//   { days: { 'YYYY-MM-DD': {
//       weather: '' | 'sunny' | 'dusty' | 'rain' | 'heat',
//       maxTemp: number | null,          // °C
//       hours: number | null,            // working hours
//       manpower:  [{ id, trade, count }],   // trade '' = general labour
//       equipment: [{ id, type, count }],
//       visitors:  [{ id, name, org, purpose }],
//       issues: string,
//       recordedBy, recordedById, recordedAt,   // first save (currentActor)
//       updatedBy, updatedById, updatedAt,      // last save
//   } } }
// ─────────────────────────────────────────────────────────────

import { currentActor } from './Identity.js';
import { projectKey } from './Projects.js';
import { notifyStoreChange } from './storeEvents.js';

export const SITE_DIARY_STORAGE_KEY = 'pm-site-diary';

export const WEATHER_KINDS = ['sunny', 'dusty', 'rain', 'heat'];

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const asArray = (v) => (Array.isArray(v) ? v : []);
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const count = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : 0);
const numOrNull = (v) => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));

export const createDiaryRowId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `dr_${Date.now()}_${Math.random().toString(36).slice(2)}`;

const normalizeRows = (list, pick, keep) =>
  asArray(list)
    .filter((r) => r && typeof r === 'object')
    .map((r) => ({ id: typeof r.id === 'string' && r.id ? r.id : createDiaryRowId(), ...pick(r) }))
    .filter(keep);

/** A blank day (nothing recorded). */
export const emptyDiaryDay = () => ({
  weather: '',
  maxTemp: null,
  hours: null,
  manpower: [],
  equipment: [],
  visitors: [],
  issues: '',
});

/**
 * Clean one day: known weather only, numbers or null, rows with something
 * in them (a manpower row needs a trade or a count). Stamps are kept.
 */
export const normalizeDiaryDay = (raw) => {
  const d = raw && typeof raw === 'object' ? raw : {};
  const day = {
    weather: WEATHER_KINDS.includes(d.weather) ? d.weather : '',
    maxTemp: numOrNull(d.maxTemp),
    hours: numOrNull(d.hours) === null ? null : Math.max(0, Math.min(24, Number(d.hours))),
    manpower: normalizeRows(d.manpower, (r) => ({ trade: text(r.trade), count: count(r.count) }), (r) => r.trade || r.count),
    equipment: normalizeRows(d.equipment, (r) => ({ type: text(r.type), count: count(r.count) }), (r) => r.type || r.count),
    visitors: normalizeRows(d.visitors, (r) => ({ name: text(r.name), org: text(r.org), purpose: text(r.purpose) }), (r) => r.name || r.org || r.purpose),
    issues: typeof d.issues === 'string' ? d.issues.trim() : '',
  };
  ['recordedBy', 'recordedById', 'recordedAt', 'updatedBy', 'updatedById', 'updatedAt'].forEach((k) => {
    if (d[k] !== undefined && d[k] !== null && d[k] !== '') day[k] = d[k];
  });
  return day;
};

/** True when a day holds nothing worth keeping. */
export const isDiaryDayEmpty = (entry) => {
  if (!entry) return true;
  const d = normalizeDiaryDay(entry);
  return !d.weather && d.maxTemp === null && d.hours === null && !d.manpower.length && !d.equipment.length && !d.visitors.length && !d.issues;
};

const normalizeDiary = (raw) => {
  const days = {};
  const src = raw && typeof raw === 'object' && raw.days && typeof raw.days === 'object' ? raw.days : {};
  Object.entries(src).forEach(([key, value]) => {
    if (DAY_RE.test(key) && value && typeof value === 'object') days[key] = normalizeDiaryDay(value);
  });
  return { days };
};

export const loadSiteDiary = () => {
  try {
    const saved = localStorage.getItem(projectKey(SITE_DIARY_STORAGE_KEY));
    return normalizeDiary(saved ? JSON.parse(saved) : null);
  } catch {
    return { days: {} };
  }
};

export const saveSiteDiary = (diary) => {
  try {
    localStorage.setItem(projectKey(SITE_DIARY_STORAGE_KEY), JSON.stringify(normalizeDiary(diary)));
    notifyStoreChange(SITE_DIARY_STORAGE_KEY);
  } catch {
    // storage full / unavailable — the diary stays in memory for this session
  }
};

export const getDiaryDay = (diary, day) => diary?.days?.[day] || null;

/**
 * Write one day (immutable — returns a NEW diary). Stamps who recorded it
 * first and who changed it last; an empty entry removes the day.
 */
export const putDiaryDay = (diary, day, entry, actor = currentActor(), now = new Date().toISOString()) => {
  const days = { ...(diary?.days || {}) };
  if (!DAY_RE.test(day)) return { days };
  if (isDiaryDayEmpty(entry)) {
    delete days[day];
    return { days };
  }
  const prev = days[day];
  const who = { by: actor?.name || '', id: actor?.id || null };
  days[day] = normalizeDiaryDay({
    ...entry,
    recordedBy: prev ? prev.recordedBy : who.by,
    recordedById: prev ? prev.recordedById : who.id,
    recordedAt: prev ? prev.recordedAt : now,
    updatedBy: who.by,
    updatedById: who.id,
    updatedAt: now,
  });
  return { days };
};

export const removeDiaryDay = (diary, day) => {
  const days = { ...(diary?.days || {}) };
  delete days[day];
  return { days };
};
