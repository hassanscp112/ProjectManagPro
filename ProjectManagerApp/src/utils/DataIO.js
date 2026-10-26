// ─────────────────────────────────────────────────────────────
// DataIO — full backup / restore of all app data.
//
// The app persists everything in the browser: localStorage (tasks,
// baseline/variations, finance ledgers, orders, …) and IndexedDB (uploaded
// files, utils/FileDB). A single browser cache clear would wipe it all. These
// helpers bundle both into one downloadable JSON file and restore it on demand.
//
// Errors are thrown / returned as codes (BackupError.code); the UI turns them
// into text with t(`app.backup.err.${code}`).
// ─────────────────────────────────────────────────────────────

import { getAllFiles, replaceAllFiles } from './FileDB.js';
import { parseProjectKey } from './Projects.js';
import { ALL_STORE_KEYS, DEVICE_STORE_KEYS } from './storeRegistry.js';

// Every localStorage key the application writes to (utils/storeRegistry).
// The project-scoped ones (utils/Projects.PROJECT_SCOPED_KEYS) also exist
// once per extra project as 'pm-p:<projectId>:<key>'; backups include those too.
export const APP_STORAGE_KEYS = ALL_STORE_KEYS;

const BACKUP_MAGIC = 'projectmanager-backup';
// 1 = localStorage only. 2 adds `files` (IndexedDB uploads, base64).
// 3 = all projects (pm-projects + 'pm-p:<id>:…' keys, files carry projectId);
//     restoring it replaces ALL app data, older versions only the keys they hold.
export const BACKUP_VERSION = 3;

// Device preferences and session a full restore leaves as they are.
const DEVICE_KEYS = DEVICE_STORE_KEYS;

/** True for any key this app owns (plain, or a project's prefixed copy). */
export const isAppStorageKey = (key) => APP_STORAGE_KEYS.includes(key) || parseProjectKey(key) !== null;

/** Every app key currently in localStorage. */
const storedAppKeys = () => {
  const keys = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (isAppStorageKey(key)) keys.push(key);
  }
  return keys;
};

/** An error the UI can translate: `code` is a key under app.backup.err.* */
export class BackupError extends Error {
  constructor(code) {
    super(code);
    this.name = 'BackupError';
    this.code = code;
  }
}

/* ── file encoding (IndexedDB Blob ⇄ base64 in JSON) ──────────────────────── */

export const bytesToBase64 = (bytes) => {
  let binary = '';
  const CHUNK = 0x8000; // String.fromCharCode spreads arguments — keep it small
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
};

export const base64ToBytes = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

/** One FileDB record → a JSON-safe entry (the blob becomes `data`, base64). */
export const encodeFileRecord = async (record) => ({
  id: record.id,
  folderId: record.folderId,
  name: record.name,
  size: record.size,
  type: record.type || '',
  createdAt: record.createdAt,
  ...(record.projectId ? { projectId: record.projectId } : {}),
  ...(record.orderId ? { orderId: record.orderId } : {}),
  data: bytesToBase64(new Uint8Array(await record.blob.arrayBuffer())),
});

/** Backup entries → FileDB records. Throws BackupError('badFiles') on bad data. */
export const decodeFileEntries = (entries) => {
  try {
    return entries.map((entry) => {
      if (!entry || typeof entry.id !== 'string' || typeof entry.data !== 'string') {
        throw new Error('bad entry');
      }
      const blob = new Blob([base64ToBytes(entry.data)], { type: entry.type || '' });
      return {
        id: entry.id,
        folderId: entry.folderId,
        name: entry.name,
        size: blob.size,
        type: entry.type || '',
        blob,
        createdAt: entry.createdAt,
        ...(entry.projectId ? { projectId: entry.projectId } : {}),
        ...(entry.orderId ? { orderId: entry.orderId } : {}),
      };
    });
  } catch {
    throw new BackupError('badFiles');
  }
};

/* ── export ───────────────────────────────────────────────────────────────── */

/**
 * Gather every app key currently in localStorage (all projects) into a plain
 * object. Missing keys are skipped (not stored).
 */
const snapshotStorage = () => {
  const data = {};
  storedAppKeys().forEach((key) => {
    data[key] = localStorage.getItem(key); // keep raw string — preserve exact JSON
  });
  return data;
};

/**
 * The backup object: localStorage keys + uploaded files. If IndexedDB can't
 * be read, `files` is left out (a restore then keeps the files it finds) and
 * `filesSkipped` is true so the caller can warn.
 */
export const buildBackupPayload = async () => {
  const payload = {
    magic: BACKUP_MAGIC,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'ProjectManagerApp',
    storage: snapshotStorage(),
  };
  let filesSkipped = false;
  try {
    const records = await getAllFiles();
    payload.files = await Promise.all(records.filter((r) => r && r.blob).map(encodeFileRecord));
  } catch {
    filesSkipped = true;
  }
  return { payload, filesSkipped };
};

/**
 * Build a backup and trigger a browser download of the JSON file.
 * `label` goes into the filename (e.g. 'before-restore').
 * Returns { filename, fileCount, filesSkipped }.
 */
export const exportAppData = async ({ label = '' } = {}) => {
  const { payload, filesSkipped } = await buildBackupPayload();

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);

  // Compact, filesystem-safe timestamp: 2026-08-01_14-30
  const stamp = `${payload.exportedAt.slice(0, 10)}_${payload.exportedAt.slice(11, 16).replace(':', '-')}`;
  const filename = `project-backup-${label ? `${label}-` : ''}${stamp}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke later: a restore reloads the page right after the safety download.
  setTimeout(() => URL.revokeObjectURL(url), 10000);

  return { filename, fileCount: payload.files ? payload.files.length : 0, filesSkipped };
};

/* ── validate / read ──────────────────────────────────────────────────────── */

/**
 * Validate a parsed backup object. Returns an object describing the result:
 *   { ok: boolean, code?: string, stats?: { keys, bytes, files } }
 * stats.files is null for a backup without a files section (version 1).
 */
export const validateBackup = (parsed) => {
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, code: 'notObject' };
  }
  if (parsed.magic !== BACKUP_MAGIC) {
    return { ok: false, code: 'notBackup' };
  }
  if (Number(parsed.version) > BACKUP_VERSION) {
    return { ok: false, code: 'tooNew' };
  }
  if (!parsed.storage || typeof parsed.storage !== 'object') {
    return { ok: false, code: 'noStorage' };
  }

  const keys = Object.keys(parsed.storage).filter(isAppStorageKey);
  if (keys.length === 0) {
    return { ok: false, code: 'noKnownKeys' };
  }
  if (parsed.files !== undefined && !Array.isArray(parsed.files)) {
    return { ok: false, code: 'badFiles' };
  }

  let bytes = 0;
  keys.forEach((k) => {
    bytes += (parsed.storage[k] || '').length;
  });
  const files = Array.isArray(parsed.files) ? parsed.files : null;
  if (files) {
    // base64 is 4 chars per 3 bytes
    files.forEach((f) => {
      bytes += Math.floor(((f && typeof f.data === 'string' ? f.data.length : 0) * 3) / 4);
    });
  }

  return { ok: true, stats: { keys: keys.length, bytes, files: files ? files.length : null } };
};

/**
 * Read a File object (from <input type=file>) as JSON.
 * Returns a promise resolving to the parsed object; rejects with BackupError.
 */
export const readBackupFile = (file) =>
  new Promise((resolve, reject) => {
    if (!file) {
      reject(new BackupError('noFile'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new BackupError('readFail'));
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)));
      } catch {
        reject(new BackupError('badJson'));
      }
    };
    reader.readAsText(file);
  });

/* ── restore ──────────────────────────────────────────────────────────────── */

/**
 * Restore a previously-validated backup payload.
 * - localStorage: writes back the app keys present in the backup. A version-3
 *   backup (all projects) also removes app keys it doesn't hold, so the
 *   result is exactly the backup (device preferences stay); older backups
 *   leave other keys intact. If a write fails (quota), every key is put back
 *   as it was and BackupError('writeFail') is thrown.
 * - files: a backup with a files section replaces ALL stored files; an old
 *   backup without one leaves the stored files untouched. If that fails the
 *   localStorage writes are rolled back too (BackupError('filesWriteFail')).
 * Returns the list of localStorage keys that were written.
 *
 * NOTE: callers should reload the app (window.location.reload()) afterwards so
 * every component re-initializes its state from the freshly-written storage.
 */
export const restoreAppData = async (parsed) => {
  const result = validateBackup(parsed);
  if (!result.ok) {
    throw new BackupError(result.code);
  }
  const files = Array.isArray(parsed.files) ? decodeFileEntries(parsed.files) : null;

  const previous = {};
  const rollback = () => {
    Object.entries(previous).forEach(([key, raw]) => {
      try {
        if (raw === null) localStorage.removeItem(key);
        else localStorage.setItem(key, raw);
      } catch {
        // best effort — the safety backup taken before restoring covers the rest
      }
    });
  };

  const written = [];
  try {
    if (Number(parsed.version) >= 3) {
      storedAppKeys()
        .filter((key) => !(key in parsed.storage) && !DEVICE_KEYS.includes(key))
        .forEach((key) => {
          previous[key] = localStorage.getItem(key);
          localStorage.removeItem(key);
        });
    }
    Object.entries(parsed.storage).forEach(([key, rawValue]) => {
      if (isAppStorageKey(key) && typeof rawValue === 'string') {
        if (!(key in previous)) previous[key] = localStorage.getItem(key);
        localStorage.setItem(key, rawValue);
        written.push(key);
      }
    });
  } catch {
    rollback();
    throw new BackupError('writeFail');
  }

  if (files) {
    try {
      await replaceAllFiles(files);
    } catch {
      rollback();
      throw new BackupError('filesWriteFail');
    }
  }
  return written;
};
