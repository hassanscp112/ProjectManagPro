// ─────────────────────────────────────────────────────────────
// StoragePersistence — ask the browser not to clear this app's storage.
//
// Without it, localStorage and IndexedDB are "best effort": the browser may
// delete them when the disk runs low. persist() makes them survive until the
// user clears site data themselves. Chrome decides silently (site engagement),
// Firefox may ask the user once.
// ─────────────────────────────────────────────────────────────

import { getAllFiles } from './FileDB.js';

/**
 * Current state: 'persisted' | 'best-effort' | 'unsupported'.
 */
export const getPersistenceState = async () => {
  try {
    if (!navigator.storage?.persisted) return 'unsupported';
    return (await navigator.storage.persisted()) ? 'persisted' : 'best-effort';
  } catch {
    return 'unsupported';
  }
};

/**
 * Request persistent storage (no-op when already granted). Returns the
 * resulting state, same values as getPersistenceState().
 */
export const requestPersistentStorage = async () => {
  try {
    const state = await getPersistenceState();
    if (state !== 'best-effort' || !navigator.storage.persist) return state;
    return (await navigator.storage.persist()) ? 'persisted' : 'best-effort';
  } catch {
    return 'unsupported';
  }
};

// ─────────────────────────────────────────────────────────────
// Storage use — the meter in Settings → Backup.
//
// Two limits matter: the browser's quota for the whole origin (IndexedDB
// files such as order photos, the offline cache) and the much smaller
// localStorage limit that holds the project data itself. Either one at
// STORAGE_WARN_RATIO shows a warning.
// ─────────────────────────────────────────────────────────────

/** Folder the order photos are saved under in FileDB (see useOrderPhotos). */
export const ORDER_PHOTOS_FOLDER = 'order_photos';

/** Browsers cap localStorage at about 5 M characters per origin. */
export const LOCAL_STORAGE_LIMIT = 5 * 1024 * 1024;

export const STORAGE_WARN_RATIO = 0.8;

/**
 * The origin's usage and quota in bytes ({ usage, quota }), or null when the
 * browser cannot tell.
 */
export const getStorageEstimate = async () => {
  try {
    if (!navigator.storage?.estimate) return null;
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return quota > 0 ? { usage, quota } : null;
  } catch {
    return null;
  }
};

/**
 * Size of everything in localStorage (all projects), counted in characters
 * of keys and values — the unit the browsers' limit uses.
 */
export const localStorageSize = (storage = globalThis.localStorage) => {
  try {
    let size = 0;
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      size += key.length + (storage.getItem(key) || '').length;
    }
    return size;
  } catch {
    return 0;
  }
};

/** Count and total bytes of the order photos among FileDB records. */
export const photoStats = (records = []) => {
  const photos = records.filter((r) => r?.folderId === ORDER_PHOTOS_FOLDER);
  return { count: photos.length, bytes: photos.reduce((sum, r) => sum + (Number(r.size) || 0), 0) };
};

const meter = (used, total) => ({ used, total, ratio: total > 0 ? Math.min(1, used / total) : 0 });

/**
 * What the meter shows: `device` (origin usage of quota; null when unknown),
 * `data` (localStorage of its limit), `photos`, and `warn` when either meter
 * reaches STORAGE_WARN_RATIO.
 */
export const summarizeStorage = ({ estimate = null, localSize = 0, photos = { count: 0, bytes: 0 } } = {}) => {
  const device = estimate ? meter(estimate.usage, estimate.quota) : null;
  const data = meter(localSize, LOCAL_STORAGE_LIMIT);
  return { device, data, photos, warn: [device, data].some((m) => m && m.ratio >= STORAGE_WARN_RATIO) };
};

/** Read everything the meter needs (FileDB failures count as no photos). */
export const getStorageUsage = async () => {
  const [estimate, files] = await Promise.all([getStorageEstimate(), getAllFiles().catch(() => [])]);
  return summarizeStorage({ estimate, localSize: localStorageSize(), photos: photoStats(files) });
};
