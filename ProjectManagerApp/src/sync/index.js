// ─────────────────────────────────────────────────────────────
// src/sync — accounts, offline-first sync with the server, history.
// Import from here: import { signIn, getHistory } from '../sync/index.js';
// How it works: docs/02-architecture.md §7 and docs/04-utils-reference.md
// (src/sync); the server: docs/08-server-setup.md.
// ─────────────────────────────────────────────────────────────

export { loadServerConfig, saveServerConfig, resetServerConfig, validateServerConfig, isServerConfigured, envServerDefaults, SERVER_STORAGE_KEY } from './serverConfig.js';
export { loadSession, isSignedIn, needsLogin, chooseLocalMode, projectRole, SESSION_STORAGE_KEY } from './session.js';
export { probeServer } from './client.js';
export {
  startSync,
  stopSync,
  requestSync,
  syncNow,
  onSyncStatus,
  getSyncStatus,
  onSyncEvent,
  pendingChanges,
  retryFailed,
  discardFailed,
} from './runtime.js';
export {
  signIn,
  signUp,
  signOut,
  createOrganization,
  refreshAccount,
  renameMe,
  listMembers,
  listOrgMembers,
  listInvites,
  inviteMember,
  setMemberRole,
  removeMember,
  setOrgRole,
  removeOrgMember,
  cancelInvite,
} from './account.js';
export { uploadDeviceData, canUpload, localOnlyProjects } from './upload.js';
export { getHistory, getProjectTimeline, restoreVersion, itemKeysFor } from './history.js';
export { PLAN_STORES } from './engine.js';
