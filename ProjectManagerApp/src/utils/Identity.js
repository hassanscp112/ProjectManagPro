// ─────────────────────────────────────────────────────────────
// Identity — tiny stub for "who is using the app right now".
//
// Free-text name + role (مثال: مهندس / مدير موقع), persisted in
// localStorage under 'pm-identity' as { name: string, role: string }.
// Used to stamp daily reports, approvals and sign-offs.
// ─────────────────────────────────────────────────────────────

import { DEFAULT_ROLE } from './permissions.js';
import { notifyStoreChange } from './storeEvents.js';

export const IDENTITY_STORAGE_KEY = 'pm-identity';

const EMPTY_IDENTITY = () => ({ name: '', role: '' });

/** Read 'pm-identity'; missing/corrupt data falls back to empty strings. */
export const loadIdentity = () => {
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

/** Trim, persist and return the identity { name, role }. */
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
  return identity;
};

/** True when a non-empty name is stored. */
export const hasIdentity = () => loadIdentity().name.trim() !== '';

/**
 * The person acting right now: { id, name, role }. `role` is a permission
 * role (utils/permissions), not the free-text job title above. Before
 * accounts exist there is one local user with every right and no id; the
 * sign-in session (pm-session) replaces this.
 */
export const currentActor = () => ({ id: null, name: loadIdentity().name, role: DEFAULT_ROLE });
