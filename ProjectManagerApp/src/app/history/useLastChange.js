import { useEffect, useMemo, useState } from 'react';
import { lastChange } from '../../state/historyModel.js';
import { getHistory } from '../../sync/history.js';
import { useSyncStatus } from '../account/useAccount.js';
import { useServerHistory } from './timelineHooks.jsx';

/**
 * The newest change of one record from the server's history (this
 * device's waiting change first) — the "last edited by" of HistoryStamps.
 * Asked again when `record` (the version on screen) or this device's
 * queue changes. null with no server, in an unshared project, or until known.
 */
export function useLastChange(collection, itemId, record) {
  const server = useServerHistory();
  const status = useSyncStatus();
  const version = useMemo(() => JSON.stringify(record ?? null), [record]);
  const [found, setFound] = useState({ key: '', row: null });
  const key = `${collection}\n${itemId}`;
  useEffect(() => {
    if (!server || !itemId) return undefined;
    let alive = true;
    getHistory(collection, itemId, { limit: 5 }).then((res) => alive && setFound({ key, row: lastChange(res.rows) }));
    return () => {
      alive = false;
    };
  }, [server, collection, itemId, key, version, status.pending]);
  return server && found.key === key ? found.row : null;
}
