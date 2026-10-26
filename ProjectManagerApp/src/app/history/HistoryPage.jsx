import { ArrowLeft, ArrowRight, CloudOff, History, RotateCcw, ServerOff } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { COLLECTION_KEYS, lastChange, recordStamps, restoreGate, splitItemId } from '../../state/historyModel.js';
import { useProject } from '../../state/projectContext.js';
import { getHistory, restoreVersion } from '../../sync/history.js';
import { isServerConfigured } from '../../sync/serverConfig.js';
import { isSignedIn } from '../../sync/session.js';
import { Button, Card, ConfirmDialog, EmptyState, StatusBadge, cx, useToast } from '../../ui/index.js';
import { collectionName, whenText } from '../../ui/HistoryFormat.js';
import { HistoryList } from '../../ui/HistoryList.jsx';
import { HistoryStamps } from '../../ui/HistoryStamps.jsx';
import { useServerConfig, useSession, useSyncStatus } from '../account/useAccount.js';
import { Page } from '../Page.jsx';
import { useActor } from '../useCan.js';
import { displayName, valueResolver } from './historyValues.js';
import { useCurrentRecord } from './useCurrentRecord.js';
import s from './History.module.css';

// The nav area a record belongs to (lights the right sidebar entry).
const AREA = {
  'pm-orders': 'record',
  'project-manager-gantt-tasks': 'schedule',
  'project-manager-project-meta': 'schedule',
  'pm-plans': 'schedule',
  'pm-registries': 'people',
  'pm-certificates': 'finance',
  'project-manager-finance-data': 'finance',
  'project-manager-finance-config': 'finance',
  files: 'library',
};

/**
 * What else this device knows without a server (the stamps are in the
 * header): that the record is gone or names nobody, and the events logged
 * about it.
 */
function LocalInfo({ current, events }) {
  const { t } = useI18n();
  const gone = current.known && !current.record;
  const unnamed = Boolean(current.record) && recordStamps(current.record).length === 0;
  if (!gone && !unnamed && events.length === 0) return null;
  return (
    <Card title={t('history.localTitle')} titleAs="h2" padding="md">
      <div className={s.local}>
        {gone && <p className={s.muted}>{t('history.itemGone')}</p>}
        {unnamed && <p className={s.muted}>{t('history.localNone')}</p>}
        {events.length > 0 && (
          <ul className={s.events}>
            {events.map((e) => (
              <li key={e.id}>
                <span>{e.summary}</span>
                <span className={s.muted}>{[e.actor, whenText(e.at)].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

/**
 * /history/:collection/:id — one record's whole story from the server's
 * change log (src/sync/history getHistory): who, when, which device, kept
 * or not, and each version's fields before → after. "Restore this version"
 * asks first, follows the same role rules as any edit and is recorded as a
 * new change (restoreVersion). Offline, the changes waiting on this device
 * show; with no server or an unshared project, what the record itself says.
 */
export default function HistoryPage() {
  const { collection, id } = useParams();
  const { t, dir } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const actor = useActor();
  const session = useSession();
  const config = useServerConfig();
  const status = useSyncStatus();
  const { project, tasks, registries, appEvents } = useProject();
  const current = useCurrentRecord(collection, id);
  const serverSet = isServerConfigured(config);
  const signedIn = isSignedIn(session, config);
  const shared = signedIn && Boolean(project?.serverId);

  const [toRestore, setToRestore] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  // The answer for this item (+ retry count); loading until it arrives.
  const requestKey = `${collection}\n${id}\n${reload}`;
  const [result, setResult] = useState({ key: '', ok: true, rows: [] });
  const loading = shared && result.key !== requestKey;

  // Re-read after each sync too (a waiting change becomes a saved one).
  useEffect(() => {
    if (!shared) return undefined;
    let alive = true;
    getHistory(collection, id).then((res) => alive && setResult({ key: requestKey, ...res }));
    return () => {
      alive = false;
    };
  }, [collection, id, shared, requestKey, status.pending, status.lastSyncAt]);

  const rows = useMemo(() => (result.key.startsWith(`${collection}\n${id}\n`) ? result.rows || [] : []), [result, collection, id]);
  const resolveValue = useMemo(() => valueResolver({ collection, t, tasks, registries }), [collection, t, tasks, registries]);
  const latest = rows.find((r) => r.after || r.before);
  const version = current.record || latest?.after || latest?.before;
  const name = displayName(collection, version, current.itemKey || id);
  const kind = collectionName(COLLECTION_KEYS, collection, t);
  const recordKey = splitItemId(current.itemKey || id).key;
  const events = useMemo(() => appEvents.filter((e) => e && e.refId === recordKey).slice(-20).reverse(), [appEvents, recordKey]);
  const newestSaved = rows.find((r) => !r.pending && r.outcome === 'applied');

  const restore = async () => {
    const row = toRestore;
    setBusy(true);
    const res = await restoreVersion(row.id);
    setBusy(false);
    if (res.ok) {
      toast({ title: t('history.restored'), tone: 'success' });
      setReload((n) => n + 1);
    } else {
      const key = `history.err.${res.code}`;
      toast({ title: t(key) !== key ? t(key) : t('history.err.unknown'), tone: 'danger' });
    }
  };

  const renderAction = useCallback(
    (row) => {
      const gate = restoreGate({ row, rows, current: current.known ? current.record : undefined, actor });
      if (!gate.show) return null;
      const reason = !gate.ok ? t(`history.err.${gate.code}`) : !status.online ? t('history.err.unreachable') : '';
      return (
        <Button
          size="sm"
          variant="outline"
          icon={RotateCcw}
          disabled={Boolean(reason) || busy}
          title={reason || undefined}
          aria-label={reason ? `${t('history.restore')} — ${reason}` : undefined}
          onClick={() => setToRestore(row)}
        >
          {t('history.restore')}
        </Button>
      );
    },
    [rows, current.known, current.record, actor, status.online, busy, t]
  );

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/'));

  let body;
  if (!serverSet || !signedIn || !project?.serverId) {
    const message = !serverSet ? t('history.noServer') : !signedIn ? t('history.signInNeeded') : t('history.notShared');
    body = (
      <>
        <Card padding="md">
          <EmptyState icon={ServerOff} title={t('history.title')} body={message} />
        </Card>
        <LocalInfo current={current} events={events} />
      </>
    );
  } else {
    const notice = loading ? null : !result.ok ? t('history.loadFail') : result.offline ? t('history.offline') : result.notShared ? t('history.notShared') : null;
    body = (
      <>
        {notice && (
          <div className={s.notice} role="status">
            <CloudOff size={18} aria-hidden="true" />
            <p>{notice}</p>
            {!result.ok && (
              <Button size="sm" onClick={() => setReload((n) => n + 1)}>
                {t('history.retry')}
              </Button>
            )}
          </div>
        )}
        <Card
          title={t('history.title')}
          titleAs="h2"
          subtitle={rows.length ? t('history.count', { n: formatNumber(rows.length) }) : undefined}
          padding="sm"
        >
          {loading && rows.length === 0 ? (
            <p className={cx(s.muted, s.pad)}>{t('history.loading')}</p>
          ) : rows.length === 0 ? (
            <EmptyState icon={History} title={t('history.empty')} />
          ) : (
            <HistoryList rows={rows} renderAction={renderAction} resolveValue={resolveValue} thisDevice={session.deviceId} currentId={newestSaved?.op === 'delete' ? null : newestSaved?.id} />
          )}
        </Card>
      </>
    );
  }

  return (
    <Page area={AREA[collection] || 'reports'}>
      <div className={s.head}>
        <Button variant="ghost" icon={dir === 'rtl' ? ArrowRight : ArrowLeft} onClick={back}>
          {t('history.back')}
        </Button>
        <div className={s.titles}>
          <h1 className={s.title}>
            <StatusBadge tone="accent" icon={false}>
              {kind}
            </StatusBadge>
            <bdi>{name || '—'}</bdi>
          </h1>
          {(current.record || shared) && <HistoryStamps record={current.record} last={shared ? lastChange(rows) : null} />}
        </div>
      </div>
      {body}
      <ConfirmDialog
        open={toRestore !== null}
        onOpenChange={(open) => !open && setToRestore(null)}
        title={t('history.restoreTitle')}
        message={toRestore ? `${t('history.restoreBody')} (${whenText(toRestore.serverAt || toRestore.clientAt)} · ${toRestore.actor?.name || t('history.unknownPerson')})` : ''}
        confirmLabel={t('history.restore')}
        onConfirm={restore}
      />
    </Page>
  );
}
