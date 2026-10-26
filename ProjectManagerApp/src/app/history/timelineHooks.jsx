import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/useI18n.js';
import { periodDays } from '../../state/historyModel.js';
import { useProject } from '../../state/projectContext.js';
import { listMembers } from '../../sync/account.js';
import { isSignedIn } from '../../sync/session.js';
import { todayStr } from '../../utils/OrderEngine.js';
import { Field, Input, Select } from '../../ui/index.js';
import { useServerConfig, useSession, useSyncStatus } from '../account/useAccount.js';

const PERIODS = ['today', 'week', 'month', 'custom'];

/** Signed in and the open project is shared: the activity screens read the server's history. */
export function useServerHistory() {
  const session = useSession();
  const config = useServerConfig();
  const { project } = useProject();
  return isSignedIn(session, config) && Boolean(project?.serverId);
}

/** The project's members (names for the person filters); [] offline. */
export function useMembers(serverId) {
  const [members, setMembers] = useState([]);
  useEffect(() => {
    if (!serverId) return undefined;
    let alive = true;
    listMembers(serverId).then((res) => alive && res.ok && setMembers(res.members));
    return () => {
      alive = false;
    };
  }, [serverId]);
  return members;
}

/**
 * Ask the server once per `key` (and again when this device's queue
 * changes). `load()` → getProjectTimeline's answer. Returns
 * { result, setResult, loading } — loading until `key` is answered.
 */
export function useTimeline(key, load) {
  const status = useSyncStatus();
  const [result, setResult] = useState({ key: '', ok: true, rows: [], next: null });
  useEffect(() => {
    let alive = true;
    load().then((res) => alive && setResult({ key, ...res }));
    return () => {
      alive = false;
    };
    // load is rebuilt each render; `key` names what it asks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, status.pending]);
  return { result, setResult, loading: result.key !== key };
}

/** Today / 7 days / 30 days / dates — shared by both "by person" views. Returns { range: { from, to }, picker }. */
export function usePeriod() {
  const { t } = useI18n();
  const today = todayStr();
  const [period, setPeriod] = useState('week');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const range = period === 'custom' ? custom : periodDays(period, today);
  const picker = (
    <>
      <Field label={t('activity.periodLabel')}>
        <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
          {PERIODS.map((p) => (
            <option key={p} value={p}>
              {t(`activity.period.${p}`)}
            </option>
          ))}
        </Select>
      </Field>
      {period === 'custom' && (
        <>
          <Field label={t('activity.fromDate')}>
            <Input type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
          </Field>
          <Field label={t('activity.toDate')}>
            <Input type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
          </Field>
        </>
      )}
    </>
  );
  return { range, picker };
}
