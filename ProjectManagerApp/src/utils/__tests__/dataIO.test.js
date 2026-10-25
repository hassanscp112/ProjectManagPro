// Unit tests for the pure parts of src/utils/DataIO.js (node:test).
// exportAppData / restoreAppData touch localStorage, IndexedDB and the DOM
// at call time and are not covered here.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BACKUP_VERSION,
  BackupError,
  base64ToBytes,
  bytesToBase64,
  decodeFileEntries,
  encodeFileRecord,
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
