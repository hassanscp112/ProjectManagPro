// Device settings and the account: server address, session, the project
// list merged with the server's, and who the current actor is.

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installNodeTestEnvironment } from '../../utils/__tests__/helpers.js';

installNodeTestEnvironment();
const { loadServerConfig, normalizeServerUrl, resetServerConfig, saveServerConfig, validateServerConfig, SERVER_STORAGE_KEY } = await import('../serverConfig.js');
const { chooseLocalMode, clearAccount, isSignedIn, loadSession, needsLogin, saveSession, SESSION_STORAGE_KEY } = await import('../session.js');
const { currentActor, hasIdentity, loadIdentity, saveIdentity } = await import('../../utils/Identity.js');
const { createProject, linkProject, loadProjects, mergeServerProjects, PROJECTS_STORAGE_KEY } = await import('../../utils/Projects.js');
const { itemKeysFor } = await import('../history.js');

const SERVER = { url: 'https://pm.example.test', anonKey: 'anon-key' };
const signIn = (extra = {}) =>
  saveSession({ mode: 'account', server: SERVER.url, user: { id: 'u1', email: 'sara@example.test', name: 'Sara' }, org: { id: 'o1', name: 'Co', role: 'site' }, projectRoles: { 'srv-1': 'office' }, ...extra });

beforeEach(() => {
  localStorage.clear();
});

describe('server address', () => {
  it('cleans what a person types', () => {
    assert.equal(normalizeServerUrl(' https://pm.example.test/ '), 'https://pm.example.test');
    assert.equal(normalizeServerUrl('https://pm.example.test/base//'), 'https://pm.example.test/base');
    assert.equal(normalizeServerUrl('ftp://x'), '');
    assert.equal(normalizeServerUrl('not a url'), '');
  });

  it('is a device setting with no default in tests', () => {
    assert.equal(loadServerConfig().source, 'none');
    saveServerConfig({ url: 'https://pm.example.test/', anonKey: ' k ' });
    assert.deepEqual(loadServerConfig(), { url: 'https://pm.example.test', anonKey: 'k', source: 'device' });
    assert.ok(localStorage.getItem(SERVER_STORAGE_KEY));
    resetServerConfig();
    assert.equal(loadServerConfig().source, 'none');
  });

  it('refuses a plain-http server from an https page (phones on GitHub Pages)', () => {
    assert.deepEqual(validateServerConfig({ url: 'http://192.168.1.20:8000', anonKey: 'k' }, { pageProtocol: 'https:' }), { ok: false, code: 'https' });
    assert.deepEqual(validateServerConfig({ url: 'http://localhost:54321', anonKey: 'k' }, { pageProtocol: 'https:' }), { ok: true });
    assert.deepEqual(validateServerConfig({ url: 'http://192.168.1.20:8000', anonKey: 'k' }, { pageProtocol: 'http:' }), { ok: true });
    assert.deepEqual(validateServerConfig({ url: 'https://x.test', anonKey: '' }), { ok: false, code: 'key' });
  });
});

describe('session', () => {
  it('asks for sign-in only when a server is set and local mode was not chosen', () => {
    assert.equal(needsLogin(), false, 'no server: the app works as before');
    saveServerConfig(SERVER);
    assert.equal(needsLogin(), true);
    chooseLocalMode();
    assert.equal(needsLogin(), false);
    signIn();
    assert.equal(isSignedIn(), true);
    assert.equal(needsLogin(), false);
  });

  it('belongs to one server', () => {
    saveServerConfig(SERVER);
    signIn();
    saveServerConfig({ url: 'https://other.example.test', anonKey: 'k' });
    assert.equal(isSignedIn(), false);
    assert.equal(needsLogin(), true);
  });

  it('signing out keeps the device id', () => {
    saveServerConfig(SERVER);
    signIn({ deviceId: 'd-1' });
    clearAccount();
    const session = loadSession();
    assert.equal(session.user, null);
    assert.equal(session.deviceId, 'd-1');
    assert.ok(localStorage.getItem(SESSION_STORAGE_KEY));
  });
});

describe('current actor', () => {
  it('is the one local user with every right when nobody is signed in', () => {
    saveIdentity({ name: 'Local name', role: 'engineer' });
    assert.deepEqual(currentActor(), { id: null, name: 'Local name', role: 'admin' });
  });

  it('is the signed-in account with its role in the open project', () => {
    saveServerConfig(SERVER);
    saveIdentity({ name: 'Local name', role: 'Site engineer' });
    signIn();
    assert.deepEqual(currentActor(), { id: 'u1', name: 'Sara', role: 'site' }, 'no project open: the organization role');
    assert.equal(loadIdentity().name, 'Sara', 'stamps carry the account name');
    assert.equal(loadIdentity().role, 'Site engineer', 'the job title stays');
    assert.ok(hasIdentity());
  });
});

describe('projects and the server', () => {
  it('adds server projects, updates linked ones and marks lost access', () => {
    const local = createProject({ name: 'Mine', startDate: '2026-01-01' });
    linkProject(local.id, 'srv-1');
    const result = mergeServerProjects([
      { id: 'srv-1', name: 'Mine (renamed)', contract: 'C5', location: '', start_date: '2026-01-01' },
      { id: 'srv-2', name: 'Shared with me', contract: '', location: '', start_date: '2026-03-01', created_at: '2026-10-01T00:00:00Z' },
    ]);
    assert.equal(result.added.length, 1);
    assert.equal(result.updated.length, 1);
    const list = loadProjects();
    assert.equal(list.find((p) => p.id === local.id).name, 'Mine (renamed)');
    const pulled = list.find((p) => p.id === 'srv-2');
    assert.equal(pulled.serverId, 'srv-2');
    assert.equal(pulled.startDate, '2026-03-01');

    const second = mergeServerProjects([{ id: 'srv-2', name: 'Shared with me', start_date: '2026-03-01' }]);
    assert.equal(second.revoked.length, 1);
    assert.equal(loadProjects().find((p) => p.id === local.id).revoked, true, 'kept, no longer synced');
    assert.ok(localStorage.getItem(PROJECTS_STORAGE_KEY).includes('serverId'));
  });

  it('does not bring back a project removed from this device', () => {
    mergeServerProjects([{ id: 'srv-9', name: 'Hidden' }], { hidden: ['srv-9'] });
    assert.equal(loadProjects().length, 0);
  });
});

describe('history keys', () => {
  it('finds the item key of a record id', () => {
    assert.deepEqual(itemKeysFor('pm-orders', 'o1'), ['orders/o1']);
    assert.deepEqual(itemKeysFor('project-manager-gantt-tasks', 't1'), ['t1']);
    assert.deepEqual(itemKeysFor('project-manager-finance-data', 'm1'), ['machinery/m1', 'materials/m1', 'pettyCash/m1', 'payroll/m1']);
    assert.deepEqual(itemKeysFor('pm-orders', 'orders/o1'), ['orders/o1']);
    assert.deepEqual(itemKeysFor('pm-plans', 'anything'), ['$doc']);
  });
});
