// ─────────────────────────────────────────────────────────────
// Delays — persistence for the delay register: events that held the
// works up, the notice given to the Engineer (FIDIC 20.1) and the
// extension of time claimed / granted. Plain JS, localStorage only.
// The rules (days without double counting, the 28-day notice check,
// totals) live in state/diaryModel.js.
//
// Storage key: 'pm-delays' (project-scoped, see storeRegistry)
//   { events: [{
//       id, title,
//       cause: 'weather' | 'client' | 'design' | 'access' | 'supply' | 'other',
//       start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' | '',   // '' = still going on
//       taskIds: [],                                   // affected BOQ items
//       excusable: boolean,
//       noticeDate: 'YYYY-MM-DD' | '',
//       daysClaimed: number,
//       status: 'draft' | 'submitted' | 'granted' | 'rejected',
//       daysGranted: number,
//       notes,
//       recordedBy, recordedById, createdAt,           // currentActor() on create
//       updatedBy, updatedById, updatedAt,
//   }] }
// ─────────────────────────────────────────────────────────────

import { currentActor } from './Identity.js';
import { projectKey } from './Projects.js';
import { notifyStoreChange } from './storeEvents.js';

export const DELAYS_STORAGE_KEY = 'pm-delays';

export const DELAY_CAUSES = ['weather', 'client', 'design', 'access', 'supply', 'other'];
export const DELAY_STATUSES = ['draft', 'submitted', 'granted', 'rejected'];

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const day = (v) => (typeof v === 'string' && DAY_RE.test(v) ? v : '');
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const days = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v) * 10) / 10 : 0);

export const createDelayId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `dl_${Date.now()}_${Math.random().toString(36).slice(2)}`;

/** Fill missing fields and drop invalid values; unknown extra fields are kept. */
export const normalizeDelay = (raw) => {
  const e = raw && typeof raw === 'object' ? raw : {};
  const start = day(e.start);
  const end = day(e.end);
  return {
    ...e,
    id: typeof e.id === 'string' && e.id ? e.id : createDelayId(),
    title: text(e.title),
    cause: DELAY_CAUSES.includes(e.cause) ? e.cause : 'other',
    start,
    end: end && start && end < start ? start : end,
    taskIds: Array.isArray(e.taskIds) ? [...new Set(e.taskIds.filter((id) => typeof id === 'string' && id))] : [],
    excusable: e.excusable !== false,
    noticeDate: day(e.noticeDate),
    daysClaimed: days(e.daysClaimed),
    status: DELAY_STATUSES.includes(e.status) ? e.status : 'draft',
    daysGranted: days(e.daysGranted),
    notes: text(e.notes),
  };
};

const normalizeState = (raw) => ({
  events: (raw && Array.isArray(raw.events) ? raw.events : []).filter((e) => e && typeof e === 'object').map(normalizeDelay),
});

export const loadDelays = () => {
  try {
    const saved = localStorage.getItem(projectKey(DELAYS_STORAGE_KEY));
    return normalizeState(saved ? JSON.parse(saved) : null);
  } catch {
    return { events: [] };
  }
};

export const saveDelays = (state) => {
  try {
    localStorage.setItem(projectKey(DELAYS_STORAGE_KEY), JSON.stringify(normalizeState(state)));
    notifyStoreChange(DELAYS_STORAGE_KEY);
  } catch {
    // storage full / unavailable — the register stays in memory for this session
  }
};

/**
 * Add or replace an event (immutable — returns a NEW state). A new event
 * is stamped with who recorded it; every save stamps who changed it last.
 */
export const upsertDelay = (state, event, actor = currentActor(), now = new Date().toISOString()) => {
  const events = Array.isArray(state?.events) ? state.events : [];
  const prev = event?.id ? events.find((e) => e.id === event.id) : null;
  const who = { updatedBy: actor?.name || '', updatedById: actor?.id || null, updatedAt: now };
  const next = normalizeDelay(
    prev
      ? { ...event, recordedBy: prev.recordedBy, recordedById: prev.recordedById, createdAt: prev.createdAt, ...who }
      : { ...event, recordedBy: actor?.name || '', recordedById: actor?.id || null, createdAt: now, ...who }
  );
  return { events: prev ? events.map((e) => (e.id === next.id ? next : e)) : [...events, next] };
};

export const removeDelay = (state, id) => ({
  events: (Array.isArray(state?.events) ? state.events : []).filter((e) => e.id !== id),
});
