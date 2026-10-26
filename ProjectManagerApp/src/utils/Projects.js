// ─────────────────────────────────────────────────────────────
// Projects — the list of projects and which one is open.
//
// Storage key: 'pm-projects' = { projects: [{ id, name, contract, location,
//   startDate, createdAt, legacy?, serverId?, revoked? }] }  (global)
//   serverId  the project's id on the server once it is shared (src/sync);
//             a project pulled from the server uses it as its local id too
//   revoked   this account no longer has access on the server: the local
//             copy stays, it no longer syncs
//
// Every project-scoped store (tasks, meta, orders, finance, plans, …) is
// saved under its own key per project: keyFor(project, base). The first
// project — the one that existed before multi-project support — is marked
// `legacy` and keeps the original unprefixed keys, so its data never had to
// move. Other projects use 'pm-p:<id>:<base>'.
//
// The open project is per browser tab (sessionStorage), so two tabs can
// work on two projects. 'pm-last-project' remembers the last one opened for
// deep links in a new tab. Storage owners call projectKey(base) at access
// time; with no project open it returns the base key (= the legacy project).
// ─────────────────────────────────────────────────────────────

import { PROJECT_STORE_KEYS } from './storeRegistry.js';

export const PROJECTS_STORAGE_KEY = 'pm-projects';
export const LAST_PROJECT_KEY = 'pm-last-project';
const ACTIVE_SESSION_KEY = 'pm-active-project';
export const PROJECT_KEY_PREFIX = 'pm-p:';
export const LEGACY_PROJECT_ID = 'project-1';

// Stores that belong to one project (each gets its own key per project),
// from utils/storeRegistry. Everything else is shared by all projects.
export const PROJECT_SCOPED_KEYS = PROJECT_STORE_KEYS;

// The project that existed before multi-project support (data, not UI text).
const LEGACY_SEED = {
  name: 'استصلاح أراضي واسط',
  contract: 'عقد 5 / 2023 · غرب الغراف · أيسر MC7',
  location: '',
  startDate: '2025-08-02',
};

const local = () => (typeof localStorage === 'undefined' ? null : localStorage);
const session = () => (typeof sessionStorage === 'undefined' ? null : sessionStorage);

const createProjectId = () =>
  `p-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

/* ── keys ─────────────────────────────────────────────────────────────────── */

/** The storage key of `base` for a given project. */
export const keyFor = (project, base) =>
  !project || project.legacy ? base : `${PROJECT_KEY_PREFIX}${project.id}:${base}`;

/** 'pm-p:<id>:<base>' → { projectId, base } (null for any other key). */
export const parseProjectKey = (key) => {
  if (typeof key !== 'string' || !key.startsWith(PROJECT_KEY_PREFIX)) return null;
  const rest = key.slice(PROJECT_KEY_PREFIX.length);
  const cut = rest.indexOf(':');
  if (cut <= 0) return null;
  const base = rest.slice(cut + 1);
  return PROJECT_SCOPED_KEYS.includes(base) ? { projectId: rest.slice(0, cut), base } : null;
};

/* ── the list ─────────────────────────────────────────────────────────────── */

const cleanProject = (p) => ({
  id: String(p.id),
  name: typeof p.name === 'string' ? p.name : '',
  contract: typeof p.contract === 'string' ? p.contract : '',
  location: typeof p.location === 'string' ? p.location : '',
  startDate: typeof p.startDate === 'string' ? p.startDate : '',
  createdAt: typeof p.createdAt === 'string' ? p.createdAt : '',
  ...(p.legacy ? { legacy: true } : {}),
  ...(typeof p.serverId === 'string' && p.serverId ? { serverId: p.serverId } : {}),
  ...(p.revoked ? { revoked: true } : {}),
});

export const loadProjects = (storage = local()) => {
  try {
    const parsed = JSON.parse(storage?.getItem(PROJECTS_STORAGE_KEY) || 'null');
    const list = Array.isArray(parsed?.projects) ? parsed.projects : [];
    return list.filter((p) => p && p.id).map(cleanProject);
  } catch {
    return [];
  }
};

/** Returns true when written, false when storage refused. */
export const saveProjects = (projects, storage = local()) => {
  try {
    storage?.setItem(PROJECTS_STORAGE_KEY, JSON.stringify({ projects }));
    return true;
  } catch {
    return false;
  }
};

export const getProject = (id, storage = local()) => loadProjects(storage).find((p) => p.id === id) || null;

/**
 * Run once at startup: data saved before multi-project support (the plain
 * keys) becomes the first project. Also re-adds it after restoring an older
 * backup into a list that doesn't have it. Returns the list.
 */
export const ensureProjects = (storage = local()) => {
  const projects = loadProjects(storage);
  if (!storage || projects.some((p) => p.legacy)) return projects;
  const hasLegacyData = PROJECT_SCOPED_KEYS.some((key) => storage.getItem(key) !== null);
  if (!hasLegacyData) return projects;
  const legacy = { id: LEGACY_PROJECT_ID, ...LEGACY_SEED, createdAt: new Date().toISOString(), legacy: true };
  const next = [legacy, ...projects.filter((p) => p.id !== LEGACY_PROJECT_ID)];
  saveProjects(next, storage);
  return next;
};

/** Add a project ({ name, contract, location, startDate }). Returns it, or null if not stored. */
export const createProject = (details, storage = local()) => {
  const project = cleanProject({ ...details, id: createProjectId(), createdAt: new Date().toISOString() });
  return saveProjects([...loadProjects(storage), project], storage) ? project : null;
};

/** Change a project's details (not its id). Returns the updated project or null. */
export const updateProject = (id, changes, storage = local()) => {
  let updated = null;
  const next = loadProjects(storage).map((p) => {
    if (p.id !== id) return p;
    updated = cleanProject({ ...p, ...changes, id: p.id, legacy: p.legacy, createdAt: p.createdAt });
    return updated;
  });
  if (!updated || !saveProjects(next, storage)) return null;
  if (current?.id === id) current = updated;
  return updated;
};

/** Remove a project and all of its stored keys (files are FileDB's job). */
export const deleteProject = (id, storage = local()) => {
  const projects = loadProjects(storage);
  const project = projects.find((p) => p.id === id);
  if (!project) return false;
  PROJECT_SCOPED_KEYS.forEach((base) => storage.removeItem(keyFor(project, base)));
  saveProjects(projects.filter((p) => p.id !== id), storage);
  if (storage.getItem(LAST_PROJECT_KEY) === id) storage.removeItem(LAST_PROJECT_KEY);
  if (current?.id === id) closeProject();
  return true;
};

/* ── the open project ─────────────────────────────────────────────────────── */

let current; // undefined = not resolved yet; null = none open

const resolveCurrent = () => {
  const id = session()?.getItem(ACTIVE_SESSION_KEY);
  return (id && getProject(id)) || null;
};

/** The project open in this tab, or null. */
export const currentProject = () => {
  if (current === undefined) current = resolveCurrent();
  return current;
};

/** The storage key of a project-scoped store for the open project. */
export const projectKey = (base) => keyFor(currentProject(), base);

/** Open a project in this tab (and remember it for new tabs). */
export const openProject = (id) => {
  const project = getProject(id);
  if (!project) return null;
  try {
    session()?.setItem(ACTIVE_SESSION_KEY, id);
    local()?.setItem(LAST_PROJECT_KEY, id);
  } catch {
    // storage unavailable — still open for this page's lifetime
  }
  current = project;
  return project;
};

/** Leave the open project (back to the projects list). */
export const closeProject = () => {
  try {
    session()?.removeItem(ACTIVE_SESSION_KEY);
  } catch {
    // ignore
  }
  current = null;
};

/** The last project opened on this device (for deep links in a new tab). */
export const lastProjectId = () => {
  try {
    return local()?.getItem(LAST_PROJECT_KEY) || null;
  } catch {
    return null;
  }
};

/* ── the server's projects (src/sync) ─────────────────────────────────────── */

/** The local project shared as `serverId`, or null. */
export const projectByServerId = (serverId, storage = local()) =>
  (serverId && loadProjects(storage).find((p) => p.serverId === serverId)) || null;

/** Remember that a local project is shared on the server as `serverId`. */
export const linkProject = (id, serverId, storage = local()) => {
  const project = getProject(id, storage);
  if (!project) return null;
  return updateProject(id, { serverId, revoked: false }, storage);
};

const SERVER_FIELDS = ['name', 'contract', 'location', 'startDate'];

/** A server project ({ id, name, contract, location, start_date }) as local fields. */
export const fromServerProject = (sp) => ({
  name: sp.name || '',
  contract: sp.contract || '',
  location: sp.location || '',
  startDate: typeof sp.start_date === 'string' ? sp.start_date.slice(0, 10) : '',
});

/**
 * Bring the list in line with the projects this account may open on the
 * server: add the missing ones (local id = server id), update the details
 * of linked ones that changed on the server (`changedOnServer(serverId)`
 * decides), and mark linked projects that are gone as revoked. Projects in
 * `hidden` (removed from this device on purpose) are not added back.
 * Returns { added, updated, revoked } (lists of local projects).
 */
export const mergeServerProjects = (serverProjects, { hidden = [], changedOnServer = () => true } = {}, storage = local()) => {
  const list = loadProjects(storage);
  const result = { added: [], updated: [], revoked: [] };
  const seen = new Set();
  const next = list.map((p) => {
    if (!p.serverId) return p;
    const sp = serverProjects.find((s) => s.id === p.serverId);
    if (!sp) {
      if (p.revoked) return p;
      const revoked = { ...p, revoked: true };
      result.revoked.push(revoked);
      return revoked;
    }
    seen.add(sp.id);
    const fields = fromServerProject(sp);
    const differs = SERVER_FIELDS.some((f) => p[f] !== fields[f]);
    if (!differs && !p.revoked) return p;
    const updated = cleanProject({ ...p, ...(differs && changedOnServer(sp.id) ? fields : {}), revoked: false });
    result.updated.push(updated);
    return updated;
  });
  serverProjects.forEach((sp) => {
    if (seen.has(sp.id) || hidden.includes(sp.id) || next.some((p) => p.id === sp.id)) return;
    const added = cleanProject({ id: sp.id, serverId: sp.id, ...fromServerProject(sp), createdAt: sp.created_at || new Date().toISOString() });
    result.added.push(added);
    next.push(added);
  });
  if (result.added.length || result.updated.length || result.revoked.length) {
    saveProjects(next, storage);
    if (current) current = next.find((p) => p.id === current.id) || current;
  }
  return result;
};

/** Project start date (YYYY-MM-DD) for the engine; the legacy seed if unset. */
export const projectStartDate = (project = currentProject()) => project?.startDate || LEGACY_SEED.startDate;
