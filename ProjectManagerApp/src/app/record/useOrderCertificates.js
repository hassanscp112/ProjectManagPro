import { useSyncExternalStore } from 'react';
import { CERTIFICATES_STORAGE_KEY, certificatesByOrder, loadCertificates } from '../../utils/Certificates.js';
import { projectKey } from '../../utils/Projects.js';
import { onStoreChange } from '../../utils/storeEvents.js';

// One map for every order row on screen: built once per change of
// 'pm-certificates' (this tab, another tab or sync) or of the open project,
// not once per row.
let version = 0;
let memo = { version: -1, scope: '', map: new Map() };
const listeners = new Set();
let detach = null;

const isCertificates = (key) => key === null || key === CERTIFICATES_STORAGE_KEY || key === projectKey(CERTIFICATES_STORAGE_KEY);

const changed = (key) => {
  if (!isCertificates(key)) return;
  version += 1;
  listeners.forEach((listener) => listener());
};

function subscribe(listener) {
  listeners.add(listener);
  if (!detach) {
    version += 1; // changes made while nobody listened are not missed
    const offStore = onStoreChange(changed);
    const onStorage = (e) => changed(e.key);
    window.addEventListener('storage', onStorage);
    detach = () => {
      offStore();
      window.removeEventListener('storage', onStorage);
    };
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && detach) {
      detach();
      detach = null;
    }
  };
}

function getSnapshot() {
  const scope = projectKey(CERTIFICATES_STORAGE_KEY);
  if (memo.version !== version || memo.scope !== scope) memo = { version, scope, map: certificatesByOrder(loadCertificates()) };
  return memo.map;
}

/**
 * orderId → the issued payment certificates holding it
 * ([{ id, number, kind, contractorId }], Certificates.certificatesByOrder).
 * Those orders are locked (state/orderForm.orderLock).
 */
export function useOrderCertificates() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
