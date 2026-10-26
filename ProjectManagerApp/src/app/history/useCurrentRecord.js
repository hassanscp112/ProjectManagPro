import { useEffect, useMemo, useState } from 'react';
import { splitItemId } from '../../state/historyModel.js';
import { useProject } from '../../state/projectContext.js';
import { itemKeysFor } from '../../sync/history.js';
import { CERTIFICATES_STORAGE_KEY, loadCertificates } from '../../utils/Certificates.js';
import { DELAYS_STORAGE_KEY, loadDelays } from '../../utils/Delays.js';
import { loadSiteDiary, SITE_DIARY_STORAGE_KEY } from '../../utils/SiteDiary.js';
import { onStoreChange } from '../../utils/storeEvents.js';

const OWN_STORES = [CERTIFICATES_STORAGE_KEY, DELAYS_STORAGE_KEY, SITE_DIARY_STORAGE_KEY];
const findIn = (list, id) => (Array.isArray(list) ? list.find((x) => x && x.id === id) : undefined) || null;

/**
 * The record a history page is about, as it is on this device now:
 * { known, record, itemKey }. known = this collection can be looked up
 * here (record null = not on this device: deleted or not synced yet);
 * itemKey = the item id the record was found under (else the first).
 * Re-read when its store changes (a restore writes it).
 */
export function useCurrentRecord(collection, id) {
  const { tasks, orders, projectMeta, registries, appEvents } = useProject();
  const [epoch, setEpoch] = useState(0);
  useEffect(() => onStoreChange((key) => OWN_STORES.includes(key) && setEpoch((n) => n + 1)), []);

  return useMemo(() => {
    const keys = itemKeysFor(collection, id);
    const parts = keys.map((key) => ({ key, ...splitItemId(key) }));
    const look = (fn) => {
      for (const p of parts) {
        const record = fn(p);
        if (record) return { known: true, record, itemKey: p.key };
      }
      return { known: true, record: null, itemKey: keys[0] };
    };
    switch (collection) {
      case 'pm-orders':
        return look((p) => findIn(orders, p.key));
      case 'project-manager-gantt-tasks':
        return look((p) => findIn(tasks, p.key));
      case 'project-manager-project-meta':
        return parts.some((p) => p.list === 'variations') ? look((p) => (p.list === 'variations' ? findIn(projectMeta.variations, p.key) : null)) : { known: false, record: null, itemKey: keys[0] };
      case 'pm-registries':
        return look((p) => findIn(registries[p.list], p.key));
      case 'pm-activity':
        return look((p) => findIn(appEvents, p.key));
      case CERTIFICATES_STORAGE_KEY:
        return look((p) => findIn(loadCertificates().certificates, p.key));
      case DELAYS_STORAGE_KEY:
        return look((p) => findIn(loadDelays().events, p.key));
      case SITE_DIARY_STORAGE_KEY:
        return look((p) => loadSiteDiary().days?.[p.key] || null);
      default:
        return { known: false, record: null, itemKey: keys[0] };
    }
    // epoch: certificates / delays / diary are read from their owners
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection, id, tasks, orders, projectMeta.variations, registries, appEvents, epoch]);
}
