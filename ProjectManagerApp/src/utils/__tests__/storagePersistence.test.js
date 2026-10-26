// Unit tests for the storage meter in src/utils/StoragePersistence.js
// (node:test). The browser calls (estimate, persist, FileDB) are not covered.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LOCAL_STORAGE_LIMIT,
  ORDER_PHOTOS_FOLDER,
  localStorageSize,
  photoStats,
  summarizeStorage,
} from '../StoragePersistence.js';

const fakeStorage = (entries) => {
  const keys = Object.keys(entries);
  return { length: keys.length, key: (i) => keys[i], getItem: (k) => entries[k] ?? null };
};

describe('localStorageSize', () => {
  it('counts the characters of every key and value', () => {
    assert.equal(localStorageSize(fakeStorage({ ab: 'xyz', 'pm-orders': '[]' })), 2 + 3 + 9 + 2);
  });

  it('counts Arabic text per character', () => {
    assert.equal(localStorageSize(fakeStorage({ k: 'مدير' })), 1 + 4);
  });

  it('is 0 when storage is empty or unreadable', () => {
    assert.equal(localStorageSize(fakeStorage({})), 0);
    assert.equal(localStorageSize(undefined), 0);
  });
});

describe('photoStats', () => {
  it('counts only order photos and sums their sizes', () => {
    const records = [
      { folderId: ORDER_PHOTOS_FOLDER, size: 1000 },
      { folderId: ORDER_PHOTOS_FOLDER, size: 2500 },
      { folderId: 'task-1', size: 99999 },
      { folderId: ORDER_PHOTOS_FOLDER },
      null,
    ];
    assert.deepEqual(photoStats(records), { count: 3, bytes: 3500 });
  });

  it('is empty without records', () => {
    assert.deepEqual(photoStats(), { count: 0, bytes: 0 });
  });
});

describe('summarizeStorage', () => {
  it('gives each meter its ratio', () => {
    const sum = summarizeStorage({ estimate: { usage: 25, quota: 100 }, localSize: LOCAL_STORAGE_LIMIT / 2 });
    assert.deepEqual(sum.device, { used: 25, total: 100, ratio: 0.25 });
    assert.equal(sum.data.ratio, 0.5);
    assert.equal(sum.warn, false);
  });

  it('warns at 80 % of the device quota', () => {
    assert.equal(summarizeStorage({ estimate: { usage: 79, quota: 100 } }).warn, false);
    assert.equal(summarizeStorage({ estimate: { usage: 80, quota: 100 } }).warn, true);
  });

  it('warns at 80 % of the localStorage limit even when the quota is unknown', () => {
    const sum = summarizeStorage({ estimate: null, localSize: LOCAL_STORAGE_LIMIT * 0.8 });
    assert.equal(sum.device, null);
    assert.equal(sum.warn, true);
  });

  it('caps a ratio at 1', () => {
    assert.equal(summarizeStorage({ estimate: { usage: 300, quota: 100 } }).device.ratio, 1);
  });

  it('passes the photo figures through', () => {
    assert.deepEqual(summarizeStorage({ photos: { count: 2, bytes: 10 } }).photos, { count: 2, bytes: 10 });
  });
});
