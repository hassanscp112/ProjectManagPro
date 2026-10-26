// storeRegistry: the key lists DataIO and Projects derive from it.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_STORE_KEYS, DEVICE_STORE_KEYS, PROJECT_STORE_KEYS, STORES, SYNCED_STORES, storeFor } from '../storeRegistry.js';
import { APP_STORAGE_KEYS } from '../DataIO.js';
import { PROJECT_SCOPED_KEYS } from '../Projects.js';

// The 18 keys the app had before the registry, in their two groups.
const LEGACY_KEYS = [
  'pm-projects',
  'pm-last-project',
  'project-manager-gantt-tasks',
  'project-manager-project-meta',
  'project-manager-finance-data',
  'project-manager-finance-config',
  'pm-calculator-templates',
  'project-manager-daily-reports',
  'pm-orders',
  'pm-registries',
  'pm-identity',
  'pm-plans',
  'pm-rate-library',
  'pm-templates',
  'pm-activity',
  'pm-snapshots',
  'pm-language',
  'pm-theme',
];
const LEGACY_PROJECT_KEYS = [
  'project-manager-gantt-tasks',
  'project-manager-project-meta',
  'project-manager-finance-data',
  'project-manager-finance-config',
  'pm-calculator-templates',
  'project-manager-daily-reports',
  'pm-orders',
  'pm-plans',
  'pm-activity',
  'pm-snapshots',
];

describe('storeRegistry', () => {
  it('lists each key once', () => {
    assert.equal(new Set(ALL_STORE_KEYS).size, ALL_STORE_KEYS.length);
  });

  it('keeps every key the app had, plus the roadmap stores', () => {
    LEGACY_KEYS.forEach((key) => assert.ok(ALL_STORE_KEYS.includes(key), key));
    ['pm-certificates', 'pm-site-diary', 'pm-delays', 'pm-server', 'pm-session'].forEach((key) =>
      assert.ok(ALL_STORE_KEYS.includes(key), key)
    );
  });

  it('feeds the backup and project key lists', () => {
    assert.deepEqual(APP_STORAGE_KEYS, ALL_STORE_KEYS);
    assert.deepEqual(PROJECT_SCOPED_KEYS, PROJECT_STORE_KEYS);
    LEGACY_PROJECT_KEYS.forEach((key) => assert.ok(PROJECT_SCOPED_KEYS.includes(key), key));
    ['pm-certificates', 'pm-site-diary', 'pm-delays'].forEach((key) => assert.ok(PROJECT_SCOPED_KEYS.includes(key), key));
  });

  it('keeps device preferences and the session out of restores and sync', () => {
    ['pm-language', 'pm-theme', 'pm-last-project', 'pm-server', 'pm-session'].forEach((key) =>
      assert.ok(DEVICE_STORE_KEYS.includes(key), key)
    );
    SYNCED_STORES.forEach((s) => assert.notEqual(s.scope, 'device', s.key));
  });

  it('describes every store completely', () => {
    STORES.forEach((s) => {
      assert.ok(['project', 'global', 'device'].includes(s.scope), s.key);
      assert.equal(typeof s.owner, 'string', s.key);
      assert.equal(typeof s.sync, 'boolean', s.key);
      (s.lists || []).forEach((l) => {
        assert.equal(typeof l.path, 'string', s.key);
        assert.ok(l.idField, s.key);
      });
    });
    assert.equal(storeFor('pm-orders').lists[0].path, 'orders');
    assert.equal(storeFor('nope'), null);
  });
});
