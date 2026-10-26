import { CalendarRange, CloudOff, FilePen, Hourglass, Image, NotebookPen, Settings2, Stamp, Users, History } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import {
  COLLECTION_KEYS,
  filterTimeline,
  personSummary,
  splitItemId,
  timelineActors,
  timelineQuery,
  TIMELINE_TYPES,
} from '../../state/historyModel.js';
import { useProject } from '../../state/projectContext.js';
import { eventKindKey } from '../../state/reportsModel.js';
import { getProjectTimeline } from '../../sync/history.js';
import { Button, Card, EmptyState, Field, Input, ListRow, Select, StatCard, StatusBadge, cx } from '../../ui/index.js';
import { HistoryButton } from '../../ui/HistoryButton.jsx';
import { collectionName, whenText } from '../../ui/HistoryFormat.js';
import { TYPE_ICONS, orderFigure, orderSubject, typeLabel } from '../record/orderMeta.js';
import { useActor } from '../useCan.js';
import { displayName } from './historyValues.js';
import { useMembers, usePeriod, useTimeline } from './timelineHooks.jsx';
import s from './Timeline.module.css';

const PAGE = 100;
const PERSON_LIMIT = 500;
const ICONS = {
  'project-manager-gantt-tasks': CalendarRange,
  'project-manager-project-meta': Settings2,
  'pm-plans': CalendarRange,
  'pm-registries': Users,
  'pm-certificates': Stamp,
  'pm-site-diary': NotebookPen,
  'pm-delays': Hourglass,
  files: Image,
  'pm-activity': History,
};
const OUTCOME_TONE = { rejected: 'warning', failed: 'danger', pending: 'accent' };

/** One change of the timeline: what, which record, who, when, kept or waiting, and its History link. */
function TimelineRow({ row }) {
  const { t, lang } = useI18n();
  const v = row.after ?? row.before ?? {};
  const list = splitItemId(row.itemId).list;
  let Icon = ICONS[row.collection] || History;
  let kind = collectionName(COLLECTION_KEYS, row.collection, t);
  let subject = displayName(row.collection, v, row.itemId);
  let figure = null;
  if (row.collection === 'pm-orders' && v.type) {
    Icon = TYPE_ICONS[v.type] || History;
    kind = typeLabel(v.type);
    subject = orderSubject(v);
    figure = orderFigure(v, lang);
  } else if (row.collection === 'pm-activity') {
    kind = v.kind ? t(eventKindKey(v.kind)) : kind;
    subject = v.summary || subject;
  } else if (list === 'variations') {
    Icon = FilePen;
    kind = t('activity.chipVariation');
  }
  const outcome = row.pending ? (row.outcome === 'failed' ? 'failed' : 'pending') : row.outcome;
  return (
    <ListRow
      flush
      leading={
        <span className={cx(s.icon, row.op === 'delete' && s.iconDelete, row.pending && s.iconPending)}>
          <Icon size={18} aria-hidden="true" />
        </span>
      }
      title={subject ? `${kind} · ${subject}` : kind}
      subtitle={[t(`history.op.${row.op}`), row.actor?.name || t('history.unknownPerson'), whenText(row.serverAt || row.clientAt)].filter(Boolean).join(' · ')}
      trailing={
        <>
          {figure && <span className={s.figure}>{figure}</span>}
          {OUTCOME_TONE[outcome] && (
            <StatusBadge tone={OUTCOME_TONE[outcome]} icon={outcome === 'pending' ? 'dot' : true}>
              {t(`history.outcome.${outcome}`)}
            </StatusBadge>
          )}
          {row.collection !== 'files' && <HistoryButton collection={row.collection} itemId={row.itemId} name={subject || kind} />}
        </>
      }
    />
  );
}

export function TimelineList({ rows }) {
  return (
    <Card padding="sm">
      <ul className={s.list}>
        {rows.map((row) => (
          <li key={row.id}>
            <TimelineRow row={row} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** "Offline / server unreadable" + this device's waiting changes, then the local view. */
function Fallback({ result, fallback }) {
  const { t } = useI18n();
  const waiting = (result.rows || []).filter((r) => r.pending);
  return (
    <>
      <div className={s.notice} role="status">
        <CloudOff size={18} aria-hidden="true" />
        <p>{result.offline ? t('activity.sourceOffline') : t('activity.sourceFail')}</p>
      </div>
      {waiting.length > 0 && (
        <section className={s.waiting} aria-label={t('activity.waitingTitle', { n: formatNumber(waiting.length) })}>
          <h2 className={s.waitingTitle}>{t('activity.waitingTitle', { n: formatNumber(waiting.length) })}</h2>
          <TimelineList rows={waiting} />
        </section>
      )}
      {fallback}
    </>
  );
}

/**
 * The project timeline from the server's history (everyone's changes),
 * filtered by type, person and dates, newest first, with older pages on
 * demand. Offline or unreadable: `fallback` (this device's feed).
 */
export function ServerFeed({ fallback }) {
  const { t } = useI18n();
  const { project } = useProject();
  const members = useMembers(project?.serverId);
  const [type, setType] = useState('all');
  const [actor, setActor] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [more, setMore] = useState(false);
  const filters = { type, actor, from, to };
  const key = JSON.stringify(filters);
  const { result, setResult, loading } = useTimeline(key, () => getProjectTimeline(timelineQuery({ ...filters, limit: PAGE })));
  const rows = useMemo(() => filterTimeline(result.rows, filters), [result.rows, type, actor, from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  const actors = useMemo(() => timelineActors(result.rows, members), [result.rows, members]);

  if (!loading && (!result.ok || result.offline)) return <Fallback result={result} fallback={fallback} />;

  const loadOlder = async () => {
    setMore(true);
    const res = await getProjectTimeline(timelineQuery({ ...filters, beforeId: result.next, limit: PAGE }));
    setMore(false);
    if (res.ok) setResult((r) => (r.key === key ? { ...r, rows: [...r.rows, ...res.rows.filter((x) => !x.pending)], next: res.next } : r));
  };

  return (
    <>
      <p className={s.source}>{t('activity.sourceServer')}</p>
      <div className={s.filterRow}>
        <Field label={t('activity.typeLabel')}>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            {Object.keys(TIMELINE_TYPES).map((k) => (
              <option key={k} value={k}>
                {t(`activity.type.${k}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('activity.personLabel')}>
          <Select value={actor} onChange={(e) => setActor(e.target.value)}>
            <option value="">{t('activity.everyone')}</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name || t('history.unknownPerson')}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('activity.fromDate')}>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label={t('activity.toDate')}>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <span className={s.count}>{loading ? t('activity.loading') : t('activity.entryCount', { n: formatNumber(rows.length) })}</span>
      </div>
      {rows.length > 0 ? <TimelineList rows={rows} /> : !loading && <EmptyState title={t('activity.feedEmpty')} />}
      {!loading && result.next !== null && result.next !== undefined && (
        <div className={s.more}>
          <Button onClick={loadOlder} disabled={more}>
            {more ? t('activity.loading') : t('activity.loadOlder')}
          </Button>
        </div>
      )}
    </>
  );
}

/**
 * "What did X do": one member's changes in a period from the server — the
 * project's and the organization's shared lists (people, templates,
 * rates) — with totals per type. Starts on the person signed in.
 */
export function ServerPerson({ fallback }) {
  const { t } = useI18n();
  const me = useActor();
  const { project } = useProject();
  const members = useMembers(project?.serverId);
  const [person, setPerson] = useState(me.id || '');
  const { range, picker } = usePeriod();
  const key = JSON.stringify({ person, ...range });
  const load = async () => {
    if (!person) return { ok: true, rows: [], next: null };
    const query = timelineQuery({ actor: person, from: range.from, to: range.to, limit: PERSON_LIMIT });
    const [own, shared] = await Promise.all([getProjectTimeline(query), getProjectTimeline({ ...query, shared: true })]);
    if (!own.ok || own.offline) return own;
    const seen = new Set(own.rows.map((r) => r.id));
    const extra = shared.ok ? shared.rows.filter((r) => !r.pending && !seen.has(r.id)) : [];
    const time = (r) => r.serverAt || r.clientAt || '';
    const rows = [...own.rows.filter((r) => r.pending), ...[...own.rows.filter((r) => !r.pending), ...extra].sort((a, b) => time(b).localeCompare(time(a)))];
    return { ok: true, rows, next: null };
  };
  const { result, loading } = useTimeline(key, load);
  const rows = useMemo(() => filterTimeline(result.rows, { actor: person, from: range.from, to: range.to }), [result.rows, person, range.from, range.to]);
  const summary = useMemo(() => personSummary(rows), [rows]);
  const people = useMemo(() => {
    const list = timelineActors(result.rows, members);
    return me.id && !list.some((p) => p.id === me.id) ? [{ id: me.id, name: me.name }, ...list] : list;
  }, [result.rows, members, me.id, me.name]);

  if (!loading && (!result.ok || result.offline)) return <Fallback result={result} fallback={fallback} />;
  const name = people.find((p) => p.id === person)?.name || t('history.unknownPerson');

  return (
    <>
      <div className={s.filterRow}>
        <Field label={t('activity.personLabel')}>
          <Select value={person} onChange={(e) => setPerson(e.target.value)}>
            <option value="">—</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || t('history.unknownPerson')}
              </option>
            ))}
          </Select>
        </Field>
        {picker}
      </div>
      {!person ? (
        <EmptyState icon={Users} title={t('activity.pickPerson')} />
      ) : loading ? (
        <p className={s.source}>{t('activity.loading')}</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title={t('activity.personEmpty', { name })} />
      ) : (
        <>
          <div className={s.stats}>
            <StatCard compact label={t('activity.statChanges')} value={formatNumber(summary.total)} />
            <StatCard compact label={t('activity.statDays')} value={formatNumber(summary.days)} />
            <StatCard compact label={t('activity.statWaiting')} value={formatNumber(summary.waiting)} tone={summary.waiting > 0 ? 'warning' : undefined} />
            <StatCard compact label={t('activity.statRefused')} value={formatNumber(summary.refused)} tone={summary.refused > 0 ? 'warning' : undefined} />
          </div>
          <ul className={s.types} aria-label={t('activity.byType')}>
            {Object.entries(summary.byCollection)
              .sort((a, b) => b[1] - a[1])
              .map(([collection, n]) => (
                <li key={collection}>
                  <StatusBadge tone="neutral" icon={false}>
                    {`${collectionName(COLLECTION_KEYS, collection, t)}: ${formatNumber(n)}`}
                  </StatusBadge>
                </li>
              ))}
          </ul>
          <TimelineList rows={rows} />
        </>
      )}
    </>
  );
}
