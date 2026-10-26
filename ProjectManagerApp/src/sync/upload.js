// ─────────────────────────────────────────────────────────────
// upload — "Upload this device's data": the first move to the server.
//
//   1. download a safety backup of everything on this device (stops here
//      if that fails);
//   2. create a server project for every project that exists only here,
//      and link it (the local project keeps its id and data);
//   3. mark those projects — and the shared lists — as an import, so the
//      first push carries the device's history as it is (approved orders
//      stay approved, their recorder is "unknown" on the server);
//   4. run a full sync: every store and every file goes up.
// Needs the right to create projects in the organization (admin or
// project manager). Safe to run again: linked projects are skipped.
// ─────────────────────────────────────────────────────────────

import { exportAppData } from '../utils/DataIO.js';
import { can } from '../utils/permissions.js';
import { linkProject, loadProjects } from '../utils/Projects.js';
import { orgScopeKey, projectScopeKey } from './engine.js';
import { isSignedIn, loadSession } from './session.js';
import { connect, getSyncDb, pendingChanges, refreshAccess, syncNow, withSyncLock } from './runtime.js';
import { toSyncError } from './transport.js';

/** Projects that exist only on this device (what an upload would share). */
export const localOnlyProjects = () => loadProjects().filter((p) => !p.serverId && !p.revoked);

/** Can the signed-in person upload? Returns { ok } or { ok: false, code }. */
export const canUpload = (session = loadSession()) => {
  if (!isSignedIn(session)) return { ok: false, code: 'signedOut' };
  if (!session.org?.id) return { ok: false, code: 'noOrg' };
  if (!can(session.org.role, 'plan.signOff')) return { ok: false, code: 'notAllowed' };
  return { ok: true };
};

/**
 * Upload this device's data. onStep(step) is called with 'backup',
 * 'projects', 'sync', 'done'. Returns { ok, projects, pending, backup } or
 * { ok: false, code } (code under account.err.*).
 */
export const uploadDeviceData = async ({ onStep = () => {} } = {}) => {
  const allowed = canUpload();
  if (!allowed.ok) return allowed;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, code: 'unreachable' };

  onStep('backup');
  let backup;
  try {
    backup = await exportAppData({ label: 'before-upload' });
  } catch {
    return { ok: false, code: 'backupFailed' };
  }

  onStep('projects');
  const session = loadSession();
  const shared = [];
  try {
    const connection = await connect();
    if (!connection) return { ok: false, code: 'noServer' };
    await withSyncLock(async () => {
      const store = getSyncDb();
      for (const project of localOnlyProjects()) {
        const sp = await connection.transport.createProject({ orgId: session.org.id, ...project, localId: project.id });
        linkProject(project.id, sp.id);
        await store.kvSet(`import:${projectScopeKey(sp.id)}`, true);
        shared.push(project.id);
      }
      // The shared lists: records kept back at sign-in (no right then) go up now.
      const orgKey = orgScopeKey(session.org.id);
      await store.kvSet(`import:${orgKey}`, true);
      const ids = (await store.shadowKeys()).filter((id) => id.startsWith(`${orgKey}|`));
      for (const id of ids) {
        const shadow = await store.shadowGet(id);
        const items = Object.fromEntries(Object.entries(shadow?.items || {}).filter(([, b]) => !b.lo));
        await store.shadowSet(id, { ...shadow, items });
      }
    });
    await refreshAccess();
  } catch (error) {
    const e = toSyncError(error);
    return { ok: false, code: e.offline ? 'unreachable' : e.auth ? 'signedOut' : 'uploadFailed', projects: shared.length };
  }

  onStep('sync');
  const status = await syncNow();
  onStep('done');
  const pending = (await pendingChanges()).filter((e) => !e.failed).length;
  return { ok: status.state !== 'error', code: status.state === 'error' ? 'uploadFailed' : undefined, projects: shared.length, pending, backup: backup.filename };
};
