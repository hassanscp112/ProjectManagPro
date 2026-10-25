// ─────────────────────────────────────────────────────────────
// StoragePersistence — ask the browser not to clear this app's storage.
//
// Without it, localStorage and IndexedDB are "best effort": the browser may
// delete them when the disk runs low. persist() makes them survive until the
// user clears site data themselves. Chrome decides silently (site engagement),
// Firefox may ask the user once.
// ─────────────────────────────────────────────────────────────

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
