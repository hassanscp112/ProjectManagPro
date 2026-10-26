import { useEffect, useState } from 'react';
import { PLAN_STORES } from '../../sync/engine.js';
import { getSyncStatus, onSyncEvent, onSyncStatus } from '../../sync/runtime.js';
import { loadServerConfig, SERVER_STORAGE_KEY } from '../../sync/serverConfig.js';
import { loadSession, SESSION_STORAGE_KEY } from '../../sync/session.js';
import { onStoreChange } from '../../utils/storeEvents.js';

const ACCOUNT_KEYS = [SESSION_STORAGE_KEY, SERVER_STORAGE_KEY];

/** Re-read `load` whenever the session or the server address changes (this tab or another). */
function useAccountValue(load) {
  const [value, setValue] = useState(load);
  useEffect(() => {
    const reload = () => setValue(load());
    const offStore = onStoreChange((key) => ACCOUNT_KEYS.includes(key) && reload());
    const onStorage = (e) => (e.key === null || ACCOUNT_KEYS.includes(e.key)) && reload();
    window.addEventListener('storage', onStorage);
    return () => {
      offStore();
      window.removeEventListener('storage', onStorage);
    };
  }, [load]);
  return value;
}

/** The sign-in session (sync/session), kept current. */
export const useSession = () => useAccountValue(loadSession);

/** The server this device talks to (sync/serverConfig), kept current. */
export const useServerConfig = () => useAccountValue(loadServerConfig);

/** Sync status: { state, online, pending, failed, lastSyncAt, error }. */
export function useSyncStatus() {
  const [status, setStatus] = useState(getSyncStatus);
  useEffect(() => onSyncStatus(setStatus), []);
  return status;
}

/**
 * A number that grows when the sync engine rewrote this project's plan
 * (tasks / meta) in storage — ProjectGate remounts the project store with
 * it, because that store keeps the plan in memory.
 */
export function usePlanEpoch(localProjectId) {
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    let timer = null;
    const off = onSyncEvent((event) => {
      if (event.type !== 'applied' || !PLAN_STORES.has(event.collection) || event.localProjectId !== localProjectId) return;
      clearTimeout(timer);
      timer = setTimeout(() => setEpoch((n) => n + 1), 200);
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, [localProjectId]);
  return epoch;
}
