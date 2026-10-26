// ─────────────────────────────────────────────────────────────
// runtime — runs the sync engine in the browser.
//
// A sync cycle (one at a time, across tabs too — Web Locks):
//   1. access   who I am, my organization and projects with my role in
//               each (my_access); new server projects appear in the list,
//               details edited here go up, projects I lost access to stop
//               syncing; projects created here after signing in are shared
//   2. diff     the shared stores and the open project (every linked
//               project on a full cycle) → outbox
//   3. files    new local files go up to Storage, their records are queued
//   4. push     the outbox
//   5. pull     what changed on the server → local stores (+ files down)
// Cycles run after a store announces a change, every 20 s, when the page
// becomes visible or the device comes back online, and when Realtime says
// something changed on the server. Offline, steps 1 and 3–5 wait; changes
// keep queueing.
// ─────────────────────────────────────────────────────────────

import { can } from '../utils/permissions.js';
import { currentProject, linkProject, loadProjects, fromServerProject, mergeServerProjects } from '../utils/Projects.js';
import { deleteFile, getAllFiles, initDB } from '../utils/FileDB.js';
import { SYNCED_STORES } from '../utils/storeRegistry.js';
import { notifyStoreChange, onStoreChange } from '../utils/storeEvents.js';
import { getConnection } from './client.js';
import { createEngine, orgScopeKey, projectScopeKey } from './engine.js';
import { pullFiles, pushFiles } from './files.js';
import { createLocalDb } from './localDb.js';
import { isServerConfigured, loadServerConfig, SERVER_STORAGE_KEY } from './serverConfig.js';
import { isSignedIn, loadSession, saveSession, SESSION_STORAGE_KEY } from './session.js';
import { toSyncError } from './transport.js';

const TICK_MS = 20_000;
const FULL_MS = 5 * 60_000;
const ACCESS_MS = 2 * 60_000;
const SYNCED_KEYS = new Set(SYNCED_STORES.map((s) => s.key));

/* ── shared state ─────────────────────────────────────────────────────────── */

let db = null;
let engine = null;
let transport = null;
let deviceIdValue = '';
let lastAccessAt = 0;

const statusListeners = new Set();
const eventListeners = new Set();
let status = { state: 'off', online: true, pending: 0, failed: 0, lastSyncAt: '', error: '' };

export const getSyncDb = () => {
  if (!db) db = createLocalDb();
  return db;
};

const emit = (event) => eventListeners.forEach((fn) => fn(event));

/** Sync events: { type: 'denied' | 'overruled' | 'ignored' | 'applied' | 'signedOut', … }. Returns unsubscribe. */
export const onSyncEvent = (fn) => {
  eventListeners.add(fn);
  return () => eventListeners.delete(fn);
};

export const getSyncStatus = () => status;

/** { state: off | idle | syncing | offline | signedOut | error, online, pending, failed, lastSyncAt, error } */
export const onSyncStatus = (fn) => {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
};

const setStatus = (patch) => {
  status = { ...status, ...patch };
  statusListeners.forEach((fn) => fn(status));
};

export const getEngine = () => {
  if (!engine) {
    engine = createEngine({
      db: getSyncDb(),
      transport: {
        push: (payloads) => transport.push(payloads),
        pull: (scope, cursor, limit) => transport.pull(scope, cursor, limit),
      },
      storage: localStorage,
      notify: notifyStoreChange,
      emit,
      deviceId: () => deviceIdValue,
    });
  }
  return engine;
};

/** This device's id (made once, kept in the sync database). */
export const getDeviceId = async () => {
  if (deviceIdValue) return deviceIdValue;
  const store = getSyncDb();
  let id = await store.kvGet('device');
  if (!id) {
    id = `d-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    await store.kvSet('device', id);
  }
  deviceIdValue = id;
  if (loadSession().deviceId !== id) saveSession({ deviceId: id });
  return id;
};

/** The connection (client + transport) for the configured server, or null. */
export const connect = async () => {
  const connection = await getConnection(getSyncDb());
  if (connection && !connection.watched) {
    connection.watched = true;
    connection.client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && loadSession().mode === 'account' && loadSession().user) {
        saveSession({ needsSignIn: true });
        emit({ type: 'signedOut' });
      }
    });
  }
  transport = connection?.transport || null;
  return connection;
};

/* ── locks ────────────────────────────────────────────────────────────────── */

let localChain = Promise.resolve();
/** Run `fn` while no other sync work runs (in any tab of this browser). */
export const withSyncLock = (fn) => {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) return navigator.locks.request('pm-sync', () => fn());
  const run = localChain.then(fn, fn);
  localChain = run.catch(() => {});
  return run;
};

/* ── scopes ───────────────────────────────────────────────────────────────── */

/** Every scope this account syncs on this device: Map scopeKey → scope. */
export const buildScopes = async (session = loadSession()) => {
  const scopes = new Map();
  const userId = session.user?.id;
  const org = session.org;
  if (!userId || !org?.id) return scopes;
  const store = getSyncDb();
  if (org.role) {
    const key = orgScopeKey(org.id);
    scopes.set(key, { key, kind: 'org', orgId: org.id, projectId: null, local: null, actor: { id: userId, role: org.role }, importing: Boolean(await store.kvGet(`import:${key}`)) });
  }
  for (const project of loadProjects()) {
    const role = project.serverId && !project.revoked ? session.projectRoles[project.serverId] : null;
    if (!role) continue;
    const key = projectScopeKey(project.serverId);
    scopes.set(key, { key, kind: 'project', orgId: org.id, projectId: project.serverId, local: project, actor: { id: userId, role }, importing: Boolean(await store.kvGet(`import:${key}`)) });
  }
  return scopes;
};

/** The scope a store of a project belongs to (global stores: the organization). */
export const scopeFor = async (collection, project = currentProject()) => {
  const scopes = await buildScopes();
  const entry = SYNCED_STORES.find((s) => s.key === collection);
  const session = loadSession();
  if (entry?.scope === 'global') return session.org ? scopes.get(orgScopeKey(session.org.id)) || null : null;
  return project?.serverId ? scopes.get(projectScopeKey(project.serverId)) || null : null;
};

/* ── access ───────────────────────────────────────────────────────────────── */

const DETAIL_FIELDS = ['name', 'contract', 'location', 'startDate'];
const sameDetails = (a, b) => DETAIL_FIELDS.every((f) => (a?.[f] || '') === (b?.[f] || ''));

/**
 * Store what my_access returned: account, organization, roles, and the
 * project list (details edited on this device go up first when allowed).
 */
export const applyAccess = async (access, { push = true } = {}) => {
  const store = getSyncDb();
  const org = Array.isArray(access?.orgs) && access.orgs.length > 0 ? access.orgs[0] : null;
  const serverProjects = (Array.isArray(access?.projects) ? access.projects : []).filter((p) => !org || p.org_id === org.id);
  const known = (await store.kvGet('projects:known')) || {};
  const hidden = (await store.kvGet('projects:hidden')) || [];

  if (push && transport) {
    for (const local of loadProjects()) {
      const sp = local.serverId && !local.revoked ? serverProjects.find((s) => s.id === local.serverId) : null;
      if (!sp || !known[sp.id]) continue;
      const editedHere = !sameDetails(local, known[sp.id]);
      const editedThere = !sameDetails(fromServerProject(sp), known[sp.id]);
      if (editedHere && !editedThere && can(sp.role, 'plan.signOff')) {
        await transport.updateProject(sp.id, local);
        Object.assign(sp, { name: local.name, contract: local.contract, location: local.location, start_date: local.startDate || null });
      }
    }
  }

  // Linked projects that disappeared from this device were removed on
  // purpose: do not bring them back, stop syncing them.
  const linkedBefore = (await store.kvGet('projects:linked')) || [];
  const localServerIds = new Set(loadProjects().map((p) => p.serverId).filter(Boolean));
  const removedHere = linkedBefore.filter((id) => !localServerIds.has(id));
  const nextHidden = [...new Set([...hidden, ...removedHere])];
  for (const id of removedHere) await getEngine().dropScope(projectScopeKey(id));

  const merged = mergeServerProjects(serverProjects, { hidden: nextHidden });
  for (const p of merged.revoked) await getEngine().dropScope(projectScopeKey(p.serverId));

  const nextKnown = {};
  serverProjects.forEach((sp) => {
    nextKnown[sp.id] = fromServerProject(sp);
  });
  await store.kvSet('projects:known', nextKnown);
  await store.kvSet('projects:hidden', nextHidden.filter((id) => serverProjects.some((sp) => sp.id === id)));
  await store.kvSet('projects:linked', loadProjects().filter((p) => p.serverId && !p.revoked).map((p) => p.serverId));

  const user = access?.user || loadSession().user;
  return saveSession({
    user: user ? { id: user.id, email: user.email || '', name: user.name || '' } : null,
    hasOrg: Boolean(access?.has_org),
    org: org ? { id: org.id, name: org.name || '', role: org.role } : null,
    projectRoles: Object.fromEntries(serverProjects.map((sp) => [sp.id, sp.role])),
    needsSignIn: false,
  });
};

/** Re-read my access from the server now. Returns the session. */
export const refreshAccess = async () => {
  const connection = await connect();
  if (!connection) return loadSession();
  const access = await transport.myAccess();
  lastAccessAt = Date.now();
  return applyAccess(access);
};

/** Share projects created on this device after signing in (when allowed). */
const shareNewProjects = async (session) => {
  if (!session.org?.id || !can(session.org.role, 'plan.signOff') || !session.signedInAt) return 0;
  const fresh = loadProjects().filter((p) => !p.serverId && !p.revoked && p.createdAt && p.createdAt >= session.signedInAt);
  for (const project of fresh) {
    const sp = await transport.createProject({ orgId: session.org.id, ...project, localId: project.id });
    linkProject(project.id, sp.id);
  }
  return fresh.length;
};

/* ── the cycle ────────────────────────────────────────────────────────────── */

const countPending = async () => {
  const userId = loadSession().user?.id;
  const all = await getSyncDb().outboxAll();
  const mine = all.filter((e) => e.actorId === userId);
  return { pending: mine.filter((e) => !e.failed).length, failed: mine.filter((e) => e.failed).length };
};

const putFileRecord = async (record) => {
  const fileDb = await initDB();
  await new Promise((resolve, reject) => {
    const tx = fileDb.transaction(['files'], 'readwrite');
    tx.objectStore('files').put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const cycle = async ({ full = false, scopeKeys = [] } = {}) => {
  let session = loadSession();
  const config = loadServerConfig();
  if (!isSignedIn(session, config)) {
    setStatus({ state: 'off', ...(await countPending()) });
    return;
  }
  const online = typeof navigator === 'undefined' || navigator.onLine !== false;
  setStatus({ state: online ? 'syncing' : 'offline', online });
  await getDeviceId();
  const eng = getEngine();
  const activeOf = (scopes) => {
    const open = currentProject();
    return [...scopes.values()].filter((s) => full || s.kind === 'org' || s.local?.id === open?.id || scopeKeys.includes(s.key));
  };
  try {
    // Queue local changes first: needs no network.
    for (const scope of activeOf(await buildScopes(session))) await eng.diffScope(scope);
    if (!online) {
      setStatus({ state: 'offline', ...(await countPending()) });
      return;
    }

    const connection = await connect();
    if (!connection) return;
    const { data } = await connection.client.auth.getSession();
    if (!data?.session) {
      if (!session.needsSignIn) saveSession({ needsSignIn: true });
      setStatus({ state: 'signedOut', ...(await countPending()) });
      return;
    }
    if (full || Date.now() - lastAccessAt > ACCESS_MS) {
      session = await applyAccess(await transport.myAccess());
      lastAccessAt = Date.now();
      if ((await shareNewProjects(session)) > 0) session = await applyAccess(await transport.myAccess());
    }
    const scopes = await buildScopes(session);
    const active = activeOf(scopes);
    for (const scope of active) await eng.diffScope(scope); // scopes that just appeared

    let files = [];
    try {
      files = await getAllFiles();
    } catch {
      files = null; // IndexedDB unavailable: files wait
    }
    const projectScopes = active.filter((s) => s.kind === 'project');
    if (files) for (const scope of projectScopes) await pushFiles({ engine: eng, transport, db: getSyncDb(), scope, files });

    await eng.push(session.user.id, scopes);
    for (const scope of active) await eng.pullScope(scope);

    if (files) {
      for (const scope of projectScopes) {
        await pullFiles({ engine: eng, transport, db: getSyncDb(), scope, files, putFile: putFileRecord, removeFile: deleteFile });
      }
    }

    const left = await getSyncDb().outboxAll();
    for (const scope of scopes.values()) {
      if (scope.importing && !left.some((e) => e.scopeKey === scope.key)) await getSyncDb().kvDelete(`import:${scope.key}`);
    }
    setStatus({ state: 'idle', lastSyncAt: new Date().toISOString(), error: '', ...(await countPending()) });
  } catch (error) {
    const e = toSyncError(error);
    if (e.auth) {
      saveSession({ needsSignIn: true });
      emit({ type: 'signedOut' });
      setStatus({ state: 'signedOut', ...(await countPending()) });
    } else if (e.offline) {
      setStatus({ state: 'offline', ...(await countPending()) });
    } else {
      setStatus({ state: 'error', error: e.message, ...(await countPending()) });
    }
  }
};

/* ── scheduling ───────────────────────────────────────────────────────────── */

let timer = null;
let running = null;
let again = false;
let wantFull = false;
const wantScopes = new Set();
const waiters = [];

const run = async () => {
  timer = null;
  if (running) {
    again = true;
    return;
  }
  const full = wantFull;
  const scopeKeys = [...wantScopes];
  wantFull = false;
  wantScopes.clear();
  const settled = waiters.splice(0);
  running = withSyncLock(() => cycle({ full, scopeKeys }));
  try {
    await running;
  } finally {
    running = null;
    settled.forEach((resolve) => resolve(status));
    if (again) {
      again = false;
      requestSync({ delay: 300 });
    }
  }
};

/** Ask for a sync cycle soon (changes close together share one cycle). */
export const requestSync = ({ full = false, delay = 1500, scopeKey } = {}) => {
  wantFull = wantFull || full;
  if (scopeKey) wantScopes.add(scopeKey);
  if (timer) clearTimeout(timer);
  timer = setTimeout(run, delay);
};

/** Run a full cycle now; resolves with the status when it is done. */
export const syncNow = () =>
  new Promise((resolve) => {
    waiters.push(resolve);
    requestSync({ full: true, delay: 0 });
  });

/* ── realtime ─────────────────────────────────────────────────────────────── */

let unsubscribe = null;
let subscribedTo = '';

const updateRealtime = async () => {
  const session = loadSession();
  const want = isSignedIn(session) && session.org?.id ? `${loadServerConfig().url}|${session.user.id}|${session.org.id}` : '';
  if (want === subscribedTo) return;
  if (unsubscribe) unsubscribe();
  unsubscribe = null;
  subscribedTo = want;
  if (!want) return;
  try {
    const connection = await connect();
    if (!connection) return;
    const orgId = session.org.id;
    unsubscribe = transport.subscribe(orgId, (projectId) =>
      requestSync({ delay: 400, scopeKey: projectId ? projectScopeKey(projectId) : orgScopeKey(orgId) })
    );
  } catch {
    subscribedTo = ''; // try again on the next account change / start
  }
};

/* ── start / stop ─────────────────────────────────────────────────────────── */

let started = false;
let cleanups = [];

/** Start syncing in this tab (idempotent). Returns stopSync. */
export const startSync = () => {
  if (started || typeof window === 'undefined') return stopSync;
  started = true;
  let account = '';
  const onAccount = () => {
    const session = loadSession();
    const next = `${loadServerConfig().url}|${session.mode}|${session.user?.id || ''}|${session.org?.id || ''}`;
    if (next === account) return;
    account = next;
    updateRealtime();
    requestSync({ full: true, delay: 300 });
  };
  const offStore = onStoreChange((key) => {
    if (key === SESSION_STORAGE_KEY || key === SERVER_STORAGE_KEY) onAccount();
    else if (SYNCED_KEYS.has(key)) requestSync({ delay: 1500 });
  });
  const onVisible = () => document.visibilityState === 'visible' && requestSync({ full: true, delay: 200 });
  const onOnline = () => {
    setStatus({ online: true });
    requestSync({ full: true, delay: 200 });
  };
  const onOffline = () => setStatus({ online: false, state: isSignedIn() ? 'offline' : status.state });
  const onNavigate = () => withSyncLock(() => getEngine().clearStaleMarks()).catch(() => {});
  const onStorage = (e) => {
    if (e.key === SESSION_STORAGE_KEY || e.key === SERVER_STORAGE_KEY) onAccount();
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  window.addEventListener('hashchange', onNavigate);
  window.addEventListener('storage', onStorage);
  const tick = setInterval(() => requestSync({ delay: 0 }), TICK_MS);
  const fullTick = setInterval(() => requestSync({ full: true, delay: 0 }), FULL_MS);
  cleanups = [
    offStore,
    () => document.removeEventListener('visibilitychange', onVisible),
    () => window.removeEventListener('online', onOnline),
    () => window.removeEventListener('offline', onOffline),
    () => window.removeEventListener('hashchange', onNavigate),
    () => window.removeEventListener('storage', onStorage),
    () => clearInterval(tick),
    () => clearInterval(fullTick),
  ];
  onAccount();
  return stopSync;
};

export const stopSync = () => {
  if (!started) return;
  started = false;
  cleanups.forEach((fn) => fn());
  cleanups = [];
  if (unsubscribe) unsubscribe();
  unsubscribe = null;
  subscribedTo = '';
  if (timer) clearTimeout(timer);
  timer = null;
};

/* ── the outbox, for screens ──────────────────────────────────────────────── */

/** Queued changes of the signed-in person (oldest first). */
export const pendingChanges = async () => {
  const userId = loadSession().user?.id;
  return (await getSyncDb().outboxAll()).filter((e) => e.actorId === userId);
};

/** Try failed changes again. */
export const retryFailed = async () => {
  const failed = (await pendingChanges()).filter((e) => e.failed);
  await getSyncDb().outboxPut(failed.map((e) => ({ ...e, failed: false, attempts: 0 })));
  requestSync({ full: true, delay: 0 });
  return failed.length;
};

/**
 * Give up on changes the server keeps failing: they leave the queue (they
 * stay in the local data) and the server's versions are fetched again.
 */
export const discardFailed = () =>
  withSyncLock(async () => {
    const store = getSyncDb();
    const failed = (await pendingChanges()).filter((e) => e.failed);
    const scopesTouched = new Set(failed.map((e) => e.scopeKey));
    await store.outboxDelete(failed.map((e) => e.seq));
    for (const e of failed) {
      const id = `${e.scopeKey}|${e.collection}`;
      const shadow = await store.shadowGet(id);
      if (shadow?.items?.[e.key]) {
        shadow.items[e.key] = { ...shadow.items[e.key], pending: false, rev: -1 };
        await store.shadowSet(id, shadow);
      }
    }
    for (const key of scopesTouched) await store.kvDelete(`cursor:${key}`);
    requestSync({ full: true, delay: 0 });
    return failed.length;
  });

/** True when a server is set up for this device. */
export const serverReady = () => isServerConfigured();
