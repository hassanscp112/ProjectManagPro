// ─────────────────────────────────────────────────────────────
// account — signing in and out, the organization, and members.
//
// Every function returns { ok: true, … } or { ok: false, code } where code
// is a key under account.err.* in the dictionaries (never a raw server
// message). Passwords go straight to the server (supabase-js); nothing here
// keeps them.
// ─────────────────────────────────────────────────────────────

import { loadServerConfig } from './serverConfig.js';
import { clearAccount, loadSession, saveSession } from './session.js';
import { applyAccess, connect, getDeviceId, refreshAccess, requestSync } from './runtime.js';
import { toSyncError } from './transport.js';

const AUTH_CODES = {
  invalid_credentials: 'badLogin',
  email_not_confirmed: 'unconfirmed',
  user_already_exists: 'exists',
  email_exists: 'exists',
  weak_password: 'weakPassword',
  signup_disabled: 'signupDisabled',
  over_request_rate_limit: 'tooMany',
  over_email_send_rate_limit: 'tooMany',
};

const SERVER_CODES = {
  pm_not_allowed: 'notAllowed',
  pm_bad_role: 'badRole',
  pm_bad_email: 'badEmail',
  pm_last_admin: 'lastAdmin',
  pm_org_exists: 'orgExists',
  pm_not_member: 'notMember',
  pm_cannot_create_project: 'notAllowed',
};

const authCode = (error) => {
  if (!error) return 'unknown';
  if (AUTH_CODES[error.code]) return AUTH_CODES[error.code];
  const message = String(error.message || '');
  if (/invalid login credentials/i.test(message)) return 'badLogin';
  if (/not confirmed/i.test(message)) return 'unconfirmed';
  if (/already registered|already exists/i.test(message)) return 'exists';
  if (/password/i.test(message) && /least|weak|short/i.test(message)) return 'weakPassword';
  if (/signups? not allowed|disabled/i.test(message)) return 'signupDisabled';
  return toSyncError(error).offline ? 'unreachable' : 'unknown';
};

const fail = (error) => {
  const e = toSyncError(error);
  if (e.offline) return { ok: false, code: 'unreachable' };
  if (e.auth) return { ok: false, code: 'signedOut' };
  return { ok: false, code: SERVER_CODES[e.code] || 'unknown' };
};

const serverConnection = async () => {
  const connection = await connect();
  if (!connection) throw Object.assign(new Error('no server'), { code: 'noServer' });
  return connection;
};

const afterSignIn = async (connection, user) => {
  await getDeviceId();
  try {
    await connection.transport.claimInvites();
  } catch {
    // nothing to claim, or offline for a moment: the next sync retries access
  }
  saveSession({
    mode: 'account',
    server: loadServerConfig().url,
    user: { id: user.id, email: user.email || '', name: user.user_metadata?.name || '' },
    signedInAt: new Date().toISOString(),
    needsSignIn: false,
  });
  try {
    await applyAccess(await connection.transport.myAccess(), { push: false });
  } catch {
    // roles arrive with the first sync
  }
  requestSync({ full: true, delay: 0 });
  return { ok: true, session: loadSession() };
};

/** Sign in with e-mail and password. */
export const signIn = async ({ email, password }) => {
  try {
    const connection = await serverConnection();
    const { data, error } = await connection.client.auth.signInWithPassword({ email: String(email || '').trim(), password: String(password || '') });
    if (error) return { ok: false, code: authCode(error) };
    return afterSignIn(connection, data.user);
  } catch (error) {
    return { ok: false, code: error.code === 'noServer' ? 'noServer' : authCode(error) };
  }
};

/**
 * Create an account. When the server asks for e-mail confirmation the
 * result is { ok: true, confirm: true } and the person signs in afterwards.
 */
export const signUp = async ({ name, email, password }) => {
  try {
    const connection = await serverConnection();
    const { data, error } = await connection.client.auth.signUp({
      email: String(email || '').trim(),
      password: String(password || ''),
      options: { data: { name: String(name || '').trim() } },
    });
    if (error) return { ok: false, code: authCode(error) };
    if (!data.session) return { ok: true, confirm: true };
    return afterSignIn(connection, data.user);
  } catch (error) {
    return { ok: false, code: error.code === 'noServer' ? 'noServer' : authCode(error) };
  }
};

/**
 * Sign out on this device. Local data stays; changes not sent yet wait in
 * the queue and go out when this person signs in again.
 */
export const signOut = async () => {
  try {
    const connection = await connect();
    if (connection) await connection.client.auth.signOut({ scope: 'local' });
  } catch {
    // offline: the token is dropped locally anyway
  }
  clearAccount();
  return { ok: true };
};

/** The first account on a new server creates the organization (and becomes its admin). */
export const createOrganization = async (name) => {
  try {
    const connection = await serverConnection();
    await connection.transport.bootstrapOrg(name);
    await refreshAccess();
    requestSync({ full: true, delay: 0 });
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
};

/** Re-read account, organization and roles. */
export const refreshAccount = async () => {
  try {
    await refreshAccess();
    return { ok: true, session: loadSession() };
  } catch (error) {
    return fail(error);
  }
};

/** Change the signed-in person's display name. */
export const renameMe = async (name) => {
  const clean = String(name || '').trim();
  const session = loadSession();
  if (!clean || !session.user) return { ok: false, code: 'badName' };
  try {
    const connection = await serverConnection();
    await connection.transport.renameMe(session.user.id, clean);
    saveSession({ user: { ...session.user, name: clean } });
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
};

/* ── members ──────────────────────────────────────────────────────────────── */

const memberRow = (row) => ({
  userId: row.user_id,
  role: row.role,
  addedAt: row.added_at,
  name: row.profile?.name || '',
  email: row.profile?.email || '',
});

/** Members of a project (server id): [{ userId, name, email, role, addedAt }]. */
export const listMembers = async (serverId) => {
  try {
    const connection = await serverConnection();
    const rows = await connection.transport.listMembers(serverId);
    return { ok: true, members: (rows || []).map(memberRow) };
  } catch (error) {
    return fail(error);
  }
};

/** Members of the organization with their organization role. */
export const listOrgMembers = async (orgId) => {
  try {
    const connection = await serverConnection();
    const rows = await connection.transport.listOrgMembers(orgId);
    return { ok: true, members: (rows || []).map(memberRow) };
  } catch (error) {
    return fail(error);
  }
};

/** Open invitations of the organization (admins only). */
export const listInvites = async (orgId) => {
  try {
    const connection = await serverConnection();
    const rows = await connection.transport.listInvites(orgId);
    return { ok: true, invites: (rows || []).map((r) => ({ id: r.id, projectId: r.project_id, email: r.email, role: r.role, createdAt: r.created_at })) };
  } catch (error) {
    return fail(error);
  }
};

/**
 * Add someone by e-mail to a project (serverId) or, without one, to the
 * organization. Returns { ok, status: 'added' | 'invited' }.
 */
export const inviteMember = async ({ orgId, serverId, email, role }) => {
  try {
    const connection = await serverConnection();
    const result = await connection.transport.inviteMember({ orgId, serverId, email, role });
    return { ok: true, status: result?.status || 'added' };
  } catch (error) {
    return fail(error);
  }
};

const call = async (fn) => {
  try {
    const connection = await serverConnection();
    await fn(connection.transport);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
};

export const setMemberRole = (serverId, userId, role) => call((t) => t.setMemberRole(serverId, userId, role));
export const removeMember = (serverId, userId) => call((t) => t.removeMember(serverId, userId));
export const setOrgRole = (orgId, userId, role) => call((t) => t.setOrgRole(orgId, userId, role));
export const removeOrgMember = (orgId, userId) => call((t) => t.removeOrgMember(orgId, userId));
export const cancelInvite = (id) => call((t) => t.cancelInvite(id));
