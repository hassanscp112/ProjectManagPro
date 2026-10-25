// ─────────────────────────────────────────────────────────────────────────────
// Snapshots — whole-project-state checkpoints ("what everything looked like").
//
// Two kinds live under the single 'pm-snapshots' localStorage key:
//   • auto  — one per day, taken on the FIRST change of that day
//             (first-change-of-day semantics), newest 14 kept, older pruned.
//   • named — user-managed restore points with an Arabic name
//             ("تقرير أيلول", "قبل التسليم") — never pruned.
//
// Snapshots capture tasks + projectMeta (status / baseline / variations).
// They are the "state at time T" record; the activity log ('pm-activity')
// remains the "what happened" ledger, and the Gantt toolbar's JSON export
// remains the full-file backup.
// ─────────────────────────────────────────────────────────────────────────────

export const SNAPSHOTS_STORAGE_KEY = 'pm-snapshots';

// Keep the newest MAX_AUTO_SNAPSHOTS daily checkpoints; older ones are pruned.
export const MAX_AUTO_SNAPSHOTS = 14;

// IMPORTANT: these literals must stay in sync with STORAGE_KEY / META_KEY in
// src/App.jsx (not imported from there on purpose — this util must stay a
// standalone module with no React/App coupling).
const TASKS_RESTORE_KEY = 'project-manager-gantt-tasks';
const META_RESTORE_KEY = 'project-manager-project-meta';

const createId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const pad2 = (n) => String(n).padStart(2, '0');

// Local calendar date as 'YYYY-MM-DD' (NOT UTC — the app day is the user's day).
export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

// Detached deep copy so later in-app mutations never leak into a stored snapshot.
const deepClone = (value) => {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
};

const emptySnapshots = () => ({ auto: {}, named: [] });

/* ── persistence ─────────────────────────────────────────────────────────── */

// Parse 'pm-snapshots' defensively — corrupt JSON, wrong shapes or storage
// being unavailable all collapse into the empty structure instead of crashing.
export const loadSnapshots = () => {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_STORAGE_KEY);
    if (!raw) return emptySnapshots();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return emptySnapshots();
    }
    return {
      auto: parsed.auto && typeof parsed.auto === 'object' && !Array.isArray(parsed.auto)
        ? parsed.auto
        : {},
      named: Array.isArray(parsed.named) ? parsed.named : [],
    };
  } catch {
    return emptySnapshots();
  }
};

// Returns true when written, false when storage refused (quota / private mode).
export const saveSnapshots = (data) => {
  try {
    const safe = data && typeof data === 'object' ? data : emptySnapshots();
    localStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(safe));
    return true;
  } catch {
    return false;
  }
};

// UTF-8 byte size of the stored payload (Arabic labels are multi-byte, so
// string .length would under-report; falls back to char count if no encoder).
const byteSize = (str) => {
  try {
    return new TextEncoder().encode(str).length;
  } catch {
    return str.length;
  }
};

/* ── auto (daily) snapshots ───────────────────────────────────────────────── */

export const hasAutoForDate = (dateStr) => {
  if (!dateStr) return false;
  return Boolean(loadSnapshots().auto[dateStr]);
};

// Drop the oldest auto entries so only the newest `keep` dates remain.
const pruneAuto = (auto, keep = MAX_AUTO_SNAPSHOTS) => {
  const dates = Object.keys(auto).sort(); // 'YYYY-MM-DD' sorts chronologically
  if (dates.length <= keep) return auto;
  const doomed = new Set(dates.slice(0, dates.length - keep));
  const next = {};
  Object.keys(auto).forEach((d) => {
    if (!doomed.has(d)) next[d] = auto[d];
  });
  return next;
};

// First-change-of-day writer: creates the day's auto snapshot only if that
// date doesn't exist yet, then enforces the 14-day prune. Returns the updated
// data object (whether or not anything was written).
export const writeAutoSnapshot = (tasks, projectMeta, actor, dateStr) => {
  const data = loadSnapshots();
  const day = dateStr || todayStr();
  if (!data.auto[day]) {
    data.auto[day] = {
      tasks: deepClone(Array.isArray(tasks) ? tasks : []),
      projectMeta: deepClone(projectMeta && typeof projectMeta === 'object' ? projectMeta : {}),
      createdAt: new Date().toISOString(),
      actor: typeof actor === 'string' ? actor : '',
    };
    data.auto = pruneAuto(data.auto);
    saveSnapshots(data);
  }
  return data;
};

/* ── named snapshots ──────────────────────────────────────────────────────── */

export const createNamedSnapshot = (name, tasks, projectMeta, actor) => {
  const data = loadSnapshots();
  const snapshot = {
    id: createId(),
    name: (typeof name === 'string' ? name.trim() : '') || 'نسخة بدون اسم',
    tasks: deepClone(Array.isArray(tasks) ? tasks : []),
    projectMeta: deepClone(projectMeta && typeof projectMeta === 'object' ? projectMeta : {}),
    createdAt: new Date().toISOString(),
    actor: typeof actor === 'string' ? actor : '',
  };
  data.named = [...data.named, snapshot];
  // null = not stored (storage full), so callers relying on it can stop.
  return saveSnapshots(data) ? snapshot : null;
};

export const deleteNamedSnapshot = (id) => {
  const data = loadSnapshots();
  data.named = data.named.filter((s) => s && s.id !== id);
  saveSnapshots(data);
  return data;
};

export const renameNamedSnapshot = (id, newName) => {
  const data = loadSnapshots();
  const next = typeof newName === 'string' ? newName.trim() : '';
  if (!next) return data; // an empty name is rejected, not silently applied
  data.named = data.named.map((s) => (s && s.id === id ? { ...s, name: next } : s));
  saveSnapshots(data);
  return data;
};

/* ── restore & stats ──────────────────────────────────────────────────────── */

// Write a snapshot's payload straight into the App's two storage keys. The
// caller is responsible for reloading state afterwards (window reload or an
// onRestored callback) — the live React tree keeps its in-memory copy.
// Throws if storage refuses a write; the tasks key is then put back so the
// two keys never come from different points in time.
export const restoreSnapshot = ({ tasks, projectMeta } = {}) => {
  const previousTasks = localStorage.getItem(TASKS_RESTORE_KEY);
  localStorage.setItem(TASKS_RESTORE_KEY, JSON.stringify(Array.isArray(tasks) ? tasks : []));
  try {
    localStorage.setItem(
      META_RESTORE_KEY,
      JSON.stringify(projectMeta && typeof projectMeta === 'object' ? projectMeta : {})
    );
  } catch (err) {
    if (previousTasks === null) localStorage.removeItem(TASKS_RESTORE_KEY);
    else localStorage.setItem(TASKS_RESTORE_KEY, previousTasks);
    throw err;
  }
};

// Summary strip figures, computed from what is actually stored.
export const snapshotsStats = () => {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_STORAGE_KEY);
    const data = loadSnapshots();
    return {
      autoCount: Object.keys(data.auto).length,
      namedCount: data.named.length,
      totalBytes: raw ? byteSize(raw) : 0,
    };
  } catch {
    return { autoCount: 0, namedCount: 0, totalBytes: 0 };
  }
};
