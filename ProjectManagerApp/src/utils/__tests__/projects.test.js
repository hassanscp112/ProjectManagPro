// Unit tests for src/utils/Projects.js (node:test) with an in-memory storage.
// The open project (sessionStorage) is not available in node, so
// projectKey() falls back to the base key here — the legacy behavior.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEGACY_PROJECT_ID,
  PROJECT_SCOPED_KEYS,
  createProject,
  deleteProject,
  ensureProjects,
  keyFor,
  loadProjects,
  parseProjectKey,
  projectKey,
  updateProject,
} from '../Projects.js';
import { APP_STORAGE_KEYS } from '../DataIO.js';

const memoryStorage = (data = {}) => ({
  data,
  getItem: (k) => (k in data ? data[k] : null),
  setItem: (k, v) => {
    data[k] = String(v);
  },
  removeItem: (k) => {
    delete data[k];
  },
});

describe('keys', () => {
  it('the legacy project keeps the plain keys; others are prefixed', () => {
    assert.equal(keyFor({ id: LEGACY_PROJECT_ID, legacy: true }, 'pm-orders'), 'pm-orders');
    assert.equal(keyFor({ id: 'p-1' }, 'pm-orders'), 'pm-p:p-1:pm-orders');
    assert.equal(projectKey('pm-orders'), 'pm-orders');
  });

  it('parseProjectKey recognizes only project-scoped stores', () => {
    assert.deepEqual(parseProjectKey('pm-p:p-1:pm-orders'), { projectId: 'p-1', base: 'pm-orders' });
    assert.equal(parseProjectKey('pm-p:p-1:pm-theme'), null);
    assert.equal(parseProjectKey('pm-orders'), null);
  });

  it('every project-scoped store is registered for backups', () => {
    PROJECT_SCOPED_KEYS.forEach((key) => assert.ok(APP_STORAGE_KEYS.includes(key), key));
  });
});

describe('the project list', () => {
  it('existing data becomes the first project, once', () => {
    const storage = memoryStorage({ 'project-manager-gantt-tasks': '[]' });
    const first = ensureProjects(storage);
    assert.equal(first.length, 1);
    assert.equal(first[0].id, LEGACY_PROJECT_ID);
    assert.equal(first[0].legacy, true);
    assert.equal(first[0].startDate, '2025-08-02');
    assert.equal(ensureProjects(storage).length, 1);
  });

  it('a fresh browser has no projects', () => {
    assert.deepEqual(ensureProjects(memoryStorage()), []);
  });

  it('create, update and delete (with its stored data)', () => {
    const storage = memoryStorage({ 'pm-registries': '{}' });
    const p = createProject({ name: ' Site B ', startDate: '2026-01-01' }, storage);
    assert.ok(p.id.startsWith('p-'));
    storage.setItem(keyFor(p, 'pm-orders'), '{"orders":[]}');
    assert.equal(updateProject(p.id, { name: 'Site B2', id: 'hijack' }, storage).name, 'Site B2');
    assert.equal(loadProjects(storage)[0].id, p.id);

    assert.equal(deleteProject(p.id, storage), true);
    assert.deepEqual(loadProjects(storage), []);
    assert.equal(storage.getItem(keyFor(p, 'pm-orders')), null);
    assert.equal(storage.getItem('pm-registries'), '{}'); // shared data stays
  });
});
