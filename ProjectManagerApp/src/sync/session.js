// ─────────────────────────────────────────────────────────────
// session — who is signed in on this device, readable synchronously.
//
// localStorage 'pm-session' (scope 'device'):
//   { mode: 'account' | 'local' | null,   local = "use without an account"
//     server,                             the server url the account is on
//     user: { id, email, name } | null,
//     needsSignIn,                        the sign-in expired (works offline,
//                                         syncs again after signing in)
//     signedInAt, hasOrg,
//     org: { id, name, role } | null,     the organization and the org role
//     projectRoles: { [server project id]: role },
//     deviceId }
// It holds no secret: the sign-in token itself lives in IndexedDB (pm-sync)
// and never in a backup. Every write announces 'pm-session' (storeEvents),
// so useActor / useCan re-read the role.
// ─────────────────────────────────────────────────────────────

import { notifyStoreChange } from '../utils/storeEvents.js';
import { isServerConfigured, loadServerConfig } from './serverConfig.js';

export const SESSION_STORAGE_KEY = 'pm-session';

const local = () => (typeof localStorage === 'undefined' ? null : localStorage);

const EMPTY = () => ({
  mode: null,
  server: '',
  user: null,
  needsSignIn: false,
  signedInAt: '',
  hasOrg: null,
  org: null,
  projectRoles: {},
  deviceId: '',
});

const cleanUser = (user) =>
  user && typeof user === 'object' && user.id
    ? { id: String(user.id), email: String(user.email || ''), name: String(user.name || '') }
    : null;

export const loadSession = (storage = local()) => {
  try {
    const parsed = JSON.parse(storage?.getItem(SESSION_STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return EMPTY();
    return {
      ...EMPTY(),
      mode: parsed.mode === 'account' || parsed.mode === 'local' ? parsed.mode : null,
      server: typeof parsed.server === 'string' ? parsed.server : '',
      user: cleanUser(parsed.user),
      needsSignIn: Boolean(parsed.needsSignIn),
      signedInAt: typeof parsed.signedInAt === 'string' ? parsed.signedInAt : '',
      hasOrg: typeof parsed.hasOrg === 'boolean' ? parsed.hasOrg : null,
      org: parsed.org && parsed.org.id ? { id: String(parsed.org.id), name: String(parsed.org.name || ''), role: String(parsed.org.role || '') } : null,
      projectRoles: parsed.projectRoles && typeof parsed.projectRoles === 'object' ? { ...parsed.projectRoles } : {},
      deviceId: typeof parsed.deviceId === 'string' ? parsed.deviceId : '',
    };
  } catch {
    return EMPTY();
  }
};

/** Merge `patch` into the session, persist and announce. Returns the session. */
export const saveSession = (patch, storage = local()) => {
  const next = { ...loadSession(storage), ...patch };
  try {
    storage?.setItem(SESSION_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable — nothing to remember the session in
    return next;
  }
  notifyStoreChange(SESSION_STORAGE_KEY);
  return loadSession(storage);
};

/** Signed out: the account details go, the device id and local mode choice stay. */
export const clearAccount = (storage = local()) =>
  saveSession({ mode: null, server: '', user: null, needsSignIn: false, signedInAt: '', hasOrg: null, org: null, projectRoles: {} }, storage);

/** "Use without an account" on this device. */
export const chooseLocalMode = (storage = local()) => saveSession({ mode: 'local' }, storage);

/** Signed in to the server this device is set to (even while offline). */
export const isSignedIn = (session = loadSession(), config = loadServerConfig()) =>
  session.mode === 'account' && Boolean(session.user?.id) && session.server === config.url && isServerConfigured(config);

/** A server is set, nobody is signed in and the person did not choose local mode. */
export const needsLogin = (session = loadSession(), config = loadServerConfig()) =>
  isServerConfigured(config) && session.mode !== 'local' && !isSignedIn(session, config);

/** The role in a project on the server (by its server id), or null. */
export const projectRole = (serverId, session = loadSession()) => (serverId && session.projectRoles[serverId]) || null;
