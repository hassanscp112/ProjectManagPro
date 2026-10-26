// Unit tests for the pure parts of src/utils/DataIO.js (node:test).
// exportAppData touches IndexedDB and the DOM at call time and is not covered
// here; restoreAppData is, for a backup without files (localStorage only).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BACKUP_VERSION,
  BackupError,
  base64ToBytes,
  bytesToBase64,
  decodeFileEntries,
  encodeFileRecord,
  LOCAL_ONLY_KEYS,
  restoreAppData,
  validateBackup,
} from '../DataIO.js';

const backup = (extra = {}) => ({
  magic: 'projectmanager-backup',
  version: BACKUP_VERSION,
  storage: { 'pm-orders': '{"orders":[]}', 'unknown-key': 'x' },
  ...extra,
});

describe('base64 helpers', () => {
  it('round-trip every byte value', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    assert.deepEqual(base64ToBytes(bytesToBase64(bytes)), bytes);
  });

  it('handle data larger than one encoding chunk', () => {
    const bytes = Uint8Array.from({ length: 100000 }, (_, i) => (i * 7) % 256);
    assert.deepEqual(base64ToBytes(bytesToBase64(bytes)), bytes);
  });
});

describe('file entries', () => {
  it('encode a FileDB record and decode it back to the same blob', async () => {
    const record = {
      id: 'f1',
      folderId: 'task_1',
      projectId: 'p-2',
      name: 'تقرير.pdf',
      size: 3,
      type: 'application/pdf',
      blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'application/pdf' }),
      createdAt: '2026-10-25T10:00:00.000Z',
    };
    const entry = await encodeFileRecord(record);
    assert.equal(typeof entry.data, 'string');
    assert.equal(entry.blob, undefined);

    const [back] = decodeFileEntries([entry]);
    assert.equal(back.id, 'f1');
    assert.equal(back.folderId, 'task_1');
    assert.equal(back.projectId, 'p-2');
    assert.equal(back.name, 'تقرير.pdf');
    assert.equal(back.type, 'application/pdf');
    assert.equal(back.size, 3);
    assert.deepEqual(new Uint8Array(await back.blob.arrayBuffer()), new Uint8Array([1, 2, 3]));
    assert.equal(back.orderId, undefined);
  });

  it('keep the order a photo belongs to', async () => {
    const record = {
      id: 'f2',
      folderId: 'order_photos',
      projectId: 'p-2',
      orderId: 'ord-9',
      name: 'photo.jpg',
      size: 1,
      type: 'image/jpeg',
      blob: new Blob([new Uint8Array([7])], { type: 'image/jpeg' }),
      createdAt: '2026-10-26T08:00:00.000Z',
    };
    const entry = await encodeFileRecord(record);
    assert.equal(entry.orderId, 'ord-9');
    const [back] = decodeFileEntries([entry]);
    assert.equal(back.orderId, 'ord-9');
  });

  it('reject damaged entries with the badFiles code', () => {
    assert.throws(
      () => decodeFileEntries([{ id: 'f1' }]),
      (err) => err instanceof BackupError && err.code === 'badFiles'
    );
    assert.throws(() => decodeFileEntries([{ id: 'f1', data: '%%%' }]), { code: 'badFiles' });
  });
});

describe('validateBackup', () => {
  it('returns a code for each kind of bad file', () => {
    assert.equal(validateBackup(null).code, 'notObject');
    assert.equal(validateBackup({ magic: 'other' }).code, 'notBackup');
    assert.equal(validateBackup(backup({ version: BACKUP_VERSION + 1 })).code, 'tooNew');
    assert.equal(validateBackup(backup({ storage: null })).code, 'noStorage');
    assert.equal(validateBackup(backup({ storage: { nope: '1' } })).code, 'noKnownKeys');
    assert.equal(validateBackup(backup({ files: {} })).code, 'badFiles');
  });

  it('counts known keys only; files is null for an old backup without files', () => {
    const result = validateBackup(backup({ version: 1 }));
    assert.equal(result.ok, true);
    assert.equal(result.stats.keys, 1);
    assert.equal(result.stats.files, null);
  });

  it("counts other projects' keys as known, but not unknown prefixed keys", () => {
    const result = validateBackup(
      backup({ storage: { 'pm-projects': '{}', 'pm-p:p-2:pm-orders': '{}', 'pm-p:p-2:pm-theme': 'x', other: 'y' } })
    );
    assert.equal(result.stats.keys, 2);
  });

  it('counts files and their decoded size', () => {
    const data = bytesToBase64(new Uint8Array(300));
    const result = validateBackup(backup({ files: [{ id: 'a', data }, { id: 'b', data }] }));
    assert.equal(result.stats.files, 2);
    assert.equal(result.stats.bytes, '{"orders":[]}'.length + 600);
  });
});

describe('restore keeps this device signed in', () => {
  // In-memory localStorage (restoreAppData only touches localStorage when the
  // backup has no files section).
  const installStorage = (data) => {
    const map = new Map(Object.entries(data));
    globalThis.localStorage = {
      get length() {
        return map.size;
      },
      key: (i) => [...map.keys()][i] ?? null,
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
    };
    return map;
  };

  it('never writes the session or server address from a backup', async () => {
    const map = installStorage({ 'pm-session': 'mine', 'pm-server': 'my-server', 'pm-orders': 'old' });
    await restoreAppData(backup({ storage: { 'pm-orders': 'new', 'pm-session': 'theirs', 'pm-server': 'their-server' } }));
    assert.equal(map.get('pm-orders'), 'new');
    assert.equal(map.get('pm-session'), 'mine');
    assert.equal(map.get('pm-server'), 'my-server');
    delete globalThis.localStorage;
  });

  it('lists the keys that stay on the device', () => {
    assert.deepEqual(LOCAL_ONLY_KEYS, ['pm-session', 'pm-server']);
  });
});
