// ─────────────────────────────────────────────────────────────
// storeEvents — "this localStorage key just changed" notifications.
//
// The persistence owners in src/utils call notifyStoreChange(key) after
// writing, and the ProjectProvider re-reads that store, so every screen
// sees new orders / registries / events immediately instead of only on
// the next navigation. Safe outside the browser (node tests): no-op.
// ─────────────────────────────────────────────────────────────

export const STORE_CHANGE_EVENT = 'pm-store-change';

export const notifyStoreChange = (key) => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent(STORE_CHANGE_EVENT, { detail: { key } }));
};

/** Subscribe to changes; returns the unsubscribe function. */
export const onStoreChange = (handler) => {
  if (typeof window === 'undefined') return () => {};
  const listener = (e) => handler(e.detail?.key);
  window.addEventListener(STORE_CHANGE_EVENT, listener);
  return () => window.removeEventListener(STORE_CHANGE_EVENT, listener);
};
