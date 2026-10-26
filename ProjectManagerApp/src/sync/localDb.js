// ─────────────────────────────────────────────────────────────
// localDb — the sync engine's own storage on this device (IndexedDB
// 'pm-sync'; never part of a backup, which holds the app's data itself):
//   kv      device id, the sign-in token, pull cursors, small flags
//   shadow  the base of each synced store per scope (itemDiff): what the
//           server had when this device last synced, item by item
//   outbox  queued local changes, oldest first (seq), until the server
//           has them
// createMemoryDb() is the same interface in memory (tests, and browsers
// without IndexedDB, where sync then lasts for the page's lifetime).
// ─────────────────────────────────────────────────────────────

const DB_NAME = 'pm-sync';
const DB_VERSION = 1;
// kv entries that outlive a reset of the sync state
const KEEP_KV = /^(device|auth)/;

const request = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const done = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('aborted'));
  });

let opening = null;
const openDb = () => {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        if (!db.objectStoreNames.contains('shadow')) db.createObjectStore('shadow');
        if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        opening = null;
        reject(req.error);
      };
    });
  }
  return opening;
};

/** The IndexedDB-backed store. */
export const createIndexedDb = () => {
  const get = async (store, key) => {
    const db = await openDb();
    return request(db.transaction(store, 'readonly').objectStore(store).get(key));
  };
  const put = async (store, key, value) => {
    const db = await openDb();
    const tx = db.transaction(store, 'readwrite');
    if (key === undefined) tx.objectStore(store).put(value);
    else tx.objectStore(store).put(value, key);
    return done(tx);
  };
  const del = async (store, keys) => {
    const db = await openDb();
    const tx = db.transaction(store, 'readwrite');
    keys.forEach((key) => tx.objectStore(store).delete(key));
    return done(tx);
  };
  return {
    kvGet: (key) => get('kv', key),
    kvSet: (key, value) => put('kv', key, value),
    kvDelete: (key) => del('kv', [key]),
    kvKeys: async () => {
      const db = await openDb();
      return request(db.transaction('kv', 'readonly').objectStore('kv').getAllKeys());
    },
    shadowGet: (id) => get('shadow', id),
    shadowSet: (id, value) => put('shadow', id, value),
    shadowDelete: (ids) => del('shadow', ids),
    shadowKeys: async () => {
      const db = await openDb();
      return request(db.transaction('shadow', 'readonly').objectStore('shadow').getAllKeys());
    },
    outboxAdd: async (entries) => {
      if (entries.length === 0) return;
      const db = await openDb();
      const tx = db.transaction('outbox', 'readwrite');
      entries.forEach((entry) => tx.objectStore('outbox').add(entry));
      return done(tx);
    },
    outboxAll: async () => {
      const db = await openDb();
      return request(db.transaction('outbox', 'readonly').objectStore('outbox').getAll());
    },
    outboxPut: (entries) =>
      openDb().then((db) => {
        const tx = db.transaction('outbox', 'readwrite');
        entries.forEach((entry) => tx.objectStore('outbox').put(entry));
        return done(tx);
      }),
    outboxDelete: (seqs) => (seqs.length ? del('outbox', seqs) : Promise.resolve()),
    // Forget what was synced (bases, queue, cursors); keeps the device id
    // and the sign-in.
    clearSyncState: async () => {
      const db = await openDb();
      const keys = await request(db.transaction('kv', 'readonly').objectStore('kv').getAllKeys());
      const tx = db.transaction(['kv', 'shadow', 'outbox'], 'readwrite');
      tx.objectStore('shadow').clear();
      tx.objectStore('outbox').clear();
      keys.filter((key) => !KEEP_KV.test(key)).forEach((key) => tx.objectStore('kv').delete(key));
      return done(tx);
    },
  };
};

/** The same interface in memory. */
export const createMemoryDb = () => {
  const kv = new Map();
  const shadow = new Map();
  const outbox = new Map();
  let seq = 0;
  const copy = (v) => (v === undefined ? undefined : structuredClone(v));
  return {
    kvGet: async (key) => copy(kv.get(key)),
    kvSet: async (key, value) => void kv.set(key, copy(value)),
    kvDelete: async (key) => void kv.delete(key),
    kvKeys: async () => [...kv.keys()],
    shadowGet: async (id) => copy(shadow.get(id)),
    shadowSet: async (id, value) => void shadow.set(id, copy(value)),
    shadowDelete: async (ids) => ids.forEach((id) => shadow.delete(id)),
    shadowKeys: async () => [...shadow.keys()],
    outboxAdd: async (entries) =>
      entries.forEach((entry) => {
        seq += 1;
        outbox.set(seq, copy({ ...entry, seq }));
      }),
    outboxAll: async () => [...outbox.values()].sort((a, b) => a.seq - b.seq).map(copy),
    outboxPut: async (entries) => entries.forEach((entry) => outbox.set(entry.seq, copy(entry))),
    outboxDelete: async (seqs) => seqs.forEach((s) => outbox.delete(s)),
    clearSyncState: async () => {
      shadow.clear();
      outbox.clear();
      [...kv.keys()].filter((key) => !KEEP_KV.test(key)).forEach((key) => kv.delete(key));
    },
  };
};

/** IndexedDB when the browser has it, else memory. */
export const createLocalDb = () => (typeof indexedDB !== 'undefined' ? createIndexedDb() : createMemoryDb());
