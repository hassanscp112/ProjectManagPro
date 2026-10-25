// ─────────────────────────────────────────────────────────────
// Registries — the shared "Who" roster of the app.
//
// One registry serves work orders, daily planning and payroll:
//   contractors — external companies executing work packages
//   teams       — organised crews assembled from registered workers
//   workers     — individuals with a trade and a daily rate
//
// Persisted in localStorage under 'pm-registries' as:
//   { contractors: [{id,name,phone,notes}],
//     teams: [{id,name,foremanWorkerId,memberWorkerIds:[],defaultSize,notes}],
//     workers: [{id,name,trade,dailyRate,phone,notes}] }
//
// All CRUD helpers are pure: they receive the current registries
// object and return a new one — the caller decides when to persist
// via saveRegistries().
// ─────────────────────────────────────────────────────────────

import { loadLanguage, translate } from '../i18n/index.js';

export const REGISTRIES_STORAGE_KEY = 'pm-registries';

/** crypto.randomUUID with a time-based fallback (house convention). */
export const createRegistryId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;

const asArray = (value) => (Array.isArray(value) ? value : []);

/* ---------- item normalizers (fill missing fields, keep extras) ---------- */

const normalizeContractor = (c = {}) => ({
  id: createRegistryId(),
  name: '',
  phone: '',
  notes: '',
  ...c,
});

const normalizeWorker = (w = {}) => ({
  id: createRegistryId(),
  name: '',
  trade: '',
  dailyRate: 0,
  phone: '',
  notes: '',
  ...w,
});

const normalizeTeam = (t = {}) => {
  // pull the shape-critical keys out so the spread never duplicates them
  const { memberWorkerIds, defaultSize, ...rest } = t;
  return {
    id: createRegistryId(),
    name: '',
    foremanWorkerId: null,
    notes: '',
    ...rest,
    memberWorkerIds: asArray(memberWorkerIds),
    defaultSize: Number.isFinite(Number(defaultSize)) ? Number(defaultSize) : 0,
  };
};

/**
 * Drop dangling worker references (workers that no longer exist) from
 * every team: removed from memberWorkerIds and cleared as foremanWorkerId.
 */
const scrubTeamReferences = (teams, workers) => {
  const workerIds = new Set(workers.map((w) => w.id));
  return teams.map((team) => {
    const memberWorkerIds = team.memberWorkerIds.filter((id) => workerIds.has(id));
    const foremanWorkerId =
      team.foremanWorkerId && workerIds.has(team.foremanWorkerId) ? team.foremanWorkerId : null;
    if (
      memberWorkerIds.length === team.memberWorkerIds.length &&
      foremanWorkerId === team.foremanWorkerId
    ) {
      return team;
    }
    return { ...team, memberWorkerIds, foremanWorkerId };
  });
};

/* ---------- load / save ---------- */

/**
 * Read 'pm-registries' from localStorage. A missing key, corrupt JSON or
 * missing collections all fall back to safe empty defaults. Dangling
 * worker references inside teams are scrubbed on load.
 */
export const loadRegistries = () => {
  try {
    const raw = localStorage.getItem(REGISTRIES_STORAGE_KEY);
    if (!raw) return { contractors: [], teams: [], workers: [] };
    const parsed = JSON.parse(raw) || {};
    const contractors = asArray(parsed.contractors).map(normalizeContractor);
    const workers = asArray(parsed.workers).map(normalizeWorker);
    const teams = scrubTeamReferences(asArray(parsed.teams).map(normalizeTeam), workers);
    return { contractors, teams, workers };
  } catch {
    return { contractors: [], teams: [], workers: [] };
  }
};

/** Persist registries to 'pm-registries' (shape-normalized). Returns the saved object. */
export const saveRegistries = (data) => {
  const safe = {
    contractors: asArray(data?.contractors).map(normalizeContractor),
    teams: asArray(data?.teams).map(normalizeTeam),
    workers: asArray(data?.workers).map(normalizeWorker),
  };
  try {
    localStorage.setItem(REGISTRIES_STORAGE_KEY, JSON.stringify(safe));
  } catch {
    // storage unavailable (quota/private mode) — data still lives in memory
  }
  return safe;
};

/* ---------- contractors ---------- */

/** Append a contractor ({name, phone, notes} + optional id). */
export const addContractor = (registries, contractor = {}) => ({
  ...registries,
  contractors: [...asArray(registries?.contractors), normalizeContractor(contractor)],
});

/** Merge a patch into the contractor with the given id. */
export const updateContractor = (registries, contractorId, patch) => ({
  ...registries,
  contractors: asArray(registries?.contractors).map((c) =>
    c.id === contractorId ? { ...c, ...patch } : c
  ),
});

/** Remove the contractor with the given id. */
export const deleteContractor = (registries, contractorId) => ({
  ...registries,
  contractors: asArray(registries?.contractors).filter((c) => c.id !== contractorId),
});

/* ---------- teams ---------- */

/** Append a team ({name, foremanWorkerId, memberWorkerIds, defaultSize, notes} + optional id). */
export const addTeam = (registries, team = {}) => ({
  ...registries,
  teams: [...asArray(registries?.teams), normalizeTeam(team)],
});

/** Merge a patch into the team with the given id (shape re-normalized). */
export const updateTeam = (registries, teamId, patch) => ({
  ...registries,
  teams: asArray(registries?.teams).map((t) =>
    t.id === teamId ? normalizeTeam({ ...t, ...patch }) : t
  ),
});

/** Remove the team with the given id. */
export const deleteTeam = (registries, teamId) => ({
  ...registries,
  teams: asArray(registries?.teams).filter((t) => t.id !== teamId),
});

/* ---------- workers ---------- */

/** Append a worker ({name, trade, dailyRate, phone, notes} + optional id). */
export const addWorker = (registries, worker = {}) => ({
  ...registries,
  workers: [...asArray(registries?.workers), normalizeWorker(worker)],
});

/** Merge a patch into the worker with the given id. */
export const updateWorker = (registries, workerId, patch) => ({
  ...registries,
  workers: asArray(registries?.workers).map((w) =>
    w.id === workerId ? { ...w, ...patch } : w
  ),
});

/**
 * Remove the worker with the given id and clean up every reference to
 * them: dropped from all teams' memberWorkerIds and cleared wherever
 * they serve as foremanWorkerId.
 */
export const deleteWorker = (registries, workerId) => {
  const workers = asArray(registries?.workers).filter((w) => w.id !== workerId);
  const teams = scrubTeamReferences(asArray(registries?.teams), workers);
  return { ...registries, workers, teams };
};

/* ---------- display resolution ---------- */

/**
 * Human-readable display string for a "who" reference:
 *   { kind: 'contractor', contractorId }        → 'مقاول: اسم' / 'Contractor: name'
 *   { kind: 'team', teamId }                    → 'فريق: اسم' / 'Team: name'
 *   { kind: 'workers', workerIds: [...] }       → 'عمال: أ، ب +2' / 'Workers: a, b +2'
 *   { kind: 'none' } / null / dangling refs     → '—' (universal)
 *
 * Language-aware via an optional third argument; it defaults to the
 * saved app language (Arabic when no localStorage exists, e.g. Node
 * tests — the default output stays byte-identical to the original
 * hardcoded Arabic strings).
 */
export const resolveWho = (registries, who, lang = loadLanguage()) => {
  if (!who || !registries) return '—';

  const unnamed = () => translate(lang, 'registries.unnamed');

  if (who.kind === 'contractor') {
    const contractor = asArray(registries.contractors).find((c) => c.id === who.contractorId);
    return contractor
      ? translate(lang, 'registries.whoContractor', { name: contractor.name || unnamed() })
      : '—';
  }

  if (who.kind === 'team') {
    const team = asArray(registries.teams).find((t) => t.id === who.teamId);
    return team
      ? translate(lang, 'registries.whoTeam', { name: team.name || unnamed() })
      : '—';
  }

  if (who.kind === 'workers') {
    const ids = asArray(who.workerIds);
    const names = asArray(registries.workers)
      .filter((w) => ids.includes(w.id))
      .map((w) => w.name || unnamed());
    if (names.length === 0) return '—';
    const separator = lang === 'en' ? ', ' : '، ';
    const shown = names.slice(0, 2).join(separator);
    const rest = names.length - 2;
    return rest > 0
      ? translate(lang, 'registries.whoWorkersMore', { names: shown, count: rest })
      : translate(lang, 'registries.whoWorkers', { names: shown });
  }

  return '—';
};
