// ─────────────────────────────────────────────────────────────
// Identity — who is using the app right now.
//
// Signed in (src/sync, 'pm-session'): the account — its name stamps
// orders, reports and sign-offs, and its role in the open project decides
// what it may do. Without an account (no server, or "use without an
// account"): one local person, a free-text name + job title in
// localStorage 'pm-identity' as { name, role }, with every right.
// ─────────────────────────────────────────────────────────────

import { currentProject } from './Projects.js';
import { DEFAULT_ROLE } from './permissions.js';
import { notifyStoreChange } from './storeEvents.js';
import { isSignedIn, loadSession, projectRole } from '../sync/session.js';

export const IDENTITY_STORAGE_KEY = 'pm-identity';

const EMPTY_IDENTITY = () => ({ name: '', role: '' });

/** The local name + job title ('pm-identity'), ignoring any account. */
export const loadLocalIdentity = () => {
  try {
    const raw = localStorage.getItem(IDENTITY_STORAGE_KEY);
    if (!raw) return EMPTY_IDENTITY();
    const parsed = JSON.parse(raw) || {};
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      role: typeof parsed.role === 'string' ? parsed.role : '',
    };
  } catch {
    return EMPTY_IDENTITY();
  }
};

/**
 * The name and job title to show and stamp: the account's name when signed
 * in (the job title stays the local one), else the local identity.
 */
export const loadIdentity = () => {
  const local = loadLocalIdentity();
  const session = loadSession();
  if (!isSignedIn(session)) return local;
  return { name: session.user.name || session.user.email, role: local.role };
};

/** Trim, persist and return the local identity { name, role }. */
export const saveIdentity = ({ name, role }) => {
  const identity = {
    name: String(name ?? '').trim(),
    role: String(role ?? '').trim(),
  };
  try {
    localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identity));
    notifyStoreChange(IDENTITY_STORAGE_KEY);
  } catch {
    // storage unavailable — identity lives in memory only
  }
  return loadIdentity();
};

/** True when someone is known: signed in, or a local name is stored. */
export const hasIdentity = () => isSignedIn() || loadLocalIdentity().name.trim() !== '';

/**
 * The person acting right now: { id, name, role }. `role` is a permission
 * role (utils/permissions), not the job title above.
 *   - not signed in: one local user with every right and no id;
 *   - signed in, inside a shared project: the role in that project
 *     (viewer when access was withdrawn);
 *   - signed in, inside a project that exists only on this device: every
 *     right (it is this device's own data);
 *   - signed in, at the projects level: the organization role.
 * useActor() re-reads it when 'pm-session' or 'pm-identity' changes.
 */
export const currentActor = () => {
  const session = loadSession();
  if (!isSignedIn(session)) return { id: null, name: loadLocalIdentity().name, role: DEFAULT_ROLE };
  const project = currentProject();
  let role;
  if (project?.serverId) role = project.revoked ? 'viewer' : projectRole(project.serverId, session) || 'viewer';
  else if (project) role = DEFAULT_ROLE;
  else role = session.org?.role || 'viewer';
  return { id: session.user.id, name: session.user.name || session.user.email, role };
};
