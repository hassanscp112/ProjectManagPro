import { FilePen, History, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { compactCurrency, formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { useProject } from '../../state/projectContext.js';
import { dayStats, filterFeed, gapRadar, heatBucket, heatCalendar, taskStoryTotals } from '../../state/reportsModel.js';
import { buildUnifiedFeed, formatDiff } from '../../utils/ActivityLog.js';
import { resolveWhoLabel, todayStr } from '../../utils/OrderEngine.js';
import {
  Button,
  Card,
  ChipGroup,
  EmptyState,
  Field,
  IconButton,
  Input,
  ListRow,
  Segmented,
  Select,
  StatCard,
  StatusBadge,
  TaskPicker,
  cx,
} from '../../ui/index.js';
import { ltr } from '../bidi.js';
import { shortMonthLabel } from '../dates.js';
import { Page } from '../Page.jsx';
import { TYPE_ICONS, formatDay, formatTime, orderFigure, orderSubject } from '../record/orderMeta.js';
import s from './Activity.module.css';

const PAGE = 100;
const CATEGORY_KEYS = {
  materials: 'reports.catMaterials',
  payroll: 'reports.catPayroll',
  machinery: 'reports.catMachinery',
  fuel: 'reports.catFuel',
};
const CHIPS = [
  ['all', 'activity.chipAll'],
  ['value', 'activity.chipValue'],
  ['expense', 'activity.chipExpense'],
  ['variation', 'activity.chipVariation'],
  ['event', 'activity.chipEvent'],
];
// Week rows run Saturday → Friday (the site week); every other row is labelled.
const WEEKDAY_KEYS = ['activity.weekdaySat', null, 'activity.weekdayMon', null, 'activity.weekdayWed', null, 'activity.weekdayFri'];

/** One feed entry (order, variation order or app event) as a list row. */
function FeedRow({ entry }) {
  const { t, lang } = useI18n();
  const { registries } = useProject();
  const o = entry.kind === 'order' ? entry.payload.order : null;
  const v = entry.kind === 'variation' ? entry.payload.variation : null;
  const Icon = o ? TYPE_ICONS[o.type] : v ? FilePen : History;
  const subject = o ? orderSubject(o) : v ? `${v.taskWbs || ''} ${v.taskName || ''}`.trim() : '';
  const who = o ? resolveWhoLabel(o.who, registries) : '';
  // Orders: their note, else the expense category in words (not its code).
  const note = o ? o.details?.note || (o.category ? (CATEGORY_KEYS[o.category] ? t(CATEGORY_KEYS[o.category]) : o.category) : '') : entry.subtitle;
  const when = `${formatDay(entry.date)}${entry.at && entry.at.length > 10 ? ` · ${formatTime(entry.at)}` : ''}`;
  return (
    <ListRow
      flush
      leading={
        <span className={cx(s.icon, s[`tone_${entry.tone}`])}>
          <Icon size={18} aria-hidden="true" />
        </span>
      }
      title={subject ? `${entry.title} · ${subject}` : entry.title}
      subtitle={[note, who && who !== '—' ? who : null, entry.actor || null, when].filter(Boolean).join(' · ')}
      trailing={
        o ? (
          <>
            <span className={s.figure}>{orderFigure(o, lang)}</span>
            <StatusBadge tone={o.status === 'approved' ? 'success' : 'warning'}>
              {o.status === 'approved' ? t('common.approved') : t('common.recorded')}
            </StatusBadge>
          </>
        ) : v ? (
          <span className={s.figure}>{ltr(formatDiff(v.oldValue, v.newValue))}</span>
        ) : null
      }
    />
  );
}

function FeedList({ entries, empty }) {
  return entries.length === 0 ? (
    <EmptyState title={empty} />
  ) : (
    <Card padding="sm">
      <ul className={s.list}>
        {entries.map((e) => (
          <li key={`${e.kind}-${e.id}`}>
            <FeedRow entry={e} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Everything recorded, newest first, with filters. */
function FeedView({ feed }) {
  const { t } = useI18n();
  const [chip, setChip] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [actor, setActor] = useState('');
  const [shown, setShown] = useState(PAGE);
  const filtered = useMemo(() => filterFeed(feed, { chip, from, to, actor }), [feed, chip, from, to, actor]);
  const reset = (fn) => (value) => {
    fn(value);
    setShown(PAGE);
  };
  return (
    <>
      <div className={s.filters}>
        <ChipGroup label={t('activity.tabFeed')} value={chip} onChange={reset(setChip)} options={CHIPS.map(([value, key]) => ({ value, label: t(key) }))} />
        <div className={s.filterRow}>
          <Field label={t('activity.fromDate')}>
            <Input type="date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} />
          </Field>
          <Field label={t('activity.toDate')}>
            <Input type="date" value={to} onChange={(e) => reset(setTo)(e.target.value)} />
          </Field>
          <Field label={t('activity.actorLabel')} className={s.grow}>
            <Input type="search" value={actor} placeholder={t('activity.actorPlaceholder')} onChange={(e) => reset(setActor)(e.target.value)} />
          </Field>
          <span className={s.count}>{t('activity.entryCount', { n: formatNumber(filtered.length) })}</span>
        </div>
      </div>
      <FeedList entries={filtered.slice(0, shown)} empty={t('activity.feedEmpty')} />
      {filtered.length > shown && (
        <div className={s.more}>
          <Button onClick={() => setShown((n) => n + PAGE)}>{t('activity.loadMore', { n: formatNumber(filtered.length - shown) })}</Button>
        </div>
      )}
    </>
  );
}

/** One item's whole story, oldest first, with its totals. */
function TaskView() {
  const { t, lang } = useI18n();
  const { tasks, orders, projectMeta, appEvents } = useProject();
  const [taskId, setTaskId] = useState('');
  const task = tasks.find((x) => x.id === taskId) || null;
  const story = useMemo(() => {
    if (!task) return null;
    const sources = {
      orders: orders.filter((o) => o.taskId === task.id),
      variations: (projectMeta.variations || []).filter((v) => v.taskId === task.id),
      appEvents: appEvents.filter((e) => e.refId === task.id),
    };
    return {
      totals: taskStoryTotals(task, { orders, variations: projectMeta.variations, events: appEvents, tasks }),
      entries: buildUnifiedFeed(sources).reverse(),
    };
    // lang: feed titles are translated when built
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, orders, projectMeta.variations, appEvents, tasks, lang]);

  return (
    <>
      <Field label={t('activity.tabTask')} className={s.picker}>
        <TaskPicker tasks={tasks} orders={orders} value={taskId} onChange={setTaskId} optional placeholder={t('activity.taskSearchPlaceholder')} />
      </Field>
      {!story ? (
        <EmptyState icon={History} title={t('activity.pickTask')} />
      ) : (
        <>
          <div className={s.stats}>
            <StatCard compact label={t('common.contractQty')} value={formatNumber(story.totals.contractQty)} unit={story.totals.unit} />
            <StatCard compact label={t('activity.executedFromLog')} value={formatNumber(story.totals.executedQty)} unit={story.totals.unit} />
            <StatCard
              compact
              label={t('common.variance')}
              value={story.totals.variance === 0 ? '—' : ltr(`${story.totals.variance > 0 ? '+' : ''}${formatNumber(story.totals.variance)}`)}
              tone={story.totals.variance > 0 ? 'warning' : undefined}
            />
            <StatCard compact label={t('activity.executedValue')} value={compactCurrency(story.totals.executedValue, lang)} />
            <StatCard compact label={t('activity.contractValue')} value={compactCurrency(story.totals.contractValue, lang)} />
            <StatCard
              compact
              label={t('activity.recordings')}
              value={formatNumber(story.totals.orderCount)}
              footer={story.totals.approvedCount > 0 ? t('activity.ofWhichApproved', { n: formatNumber(story.totals.approvedCount) }) : undefined}
            />
          </div>
          <FeedList entries={story.entries} empty={t('activity.taskEmptyStory')} />
        </>
      )}
    </>
  );
}

/** Approved work value per day over the last 12 months, and empty days. */
function HeatmapView() {
  const { t, lang } = useI18n();
  const { tasks, orders, projectMeta, registries } = useProject();
  const [scope, setScope] = useState('');
  const [selected, setSelected] = useState('');
  const scrollerRef = useRef(null);
  const today = todayStr();
  const scoped = useMemo(() => (scope ? orders.filter((o) => o.who?.contractorId === scope) : orders), [orders, scope]);
  const stats = useMemo(() => dayStats(scoped, tasks), [scoped, tasks]);
  const max = useMemo(() => Math.max(0, ...[...stats.values()].map((x) => x.value)), [stats]);
  const weeks = useMemo(() => heatCalendar(today), [today]);
  const radar = useMemo(() => gapRadar(stats, today), [stats, today]);
  const detail = useMemo(() => {
    if (!selected) return null;
    const dayOrders = scoped.filter((o) => String(o.date || '').slice(0, 10) === selected);
    // Variation orders carry no contractor — they show for the whole project only.
    const dayVariations = scope ? [] : (projectMeta.variations || []).filter((v) => String(v.date || '').slice(0, 10) === selected);
    return buildUnifiedFeed({ orders: dayOrders, variations: dayVariations }).reverse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, scoped, scope, projectMeta.variations, lang]);

  // Start at the latest weeks (the far end in either direction).
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollLeft = getComputedStyle(el).direction === 'rtl' ? -el.scrollWidth : el.scrollWidth;
  }, []);

  const dayLabel = (date, st) =>
    t('activity.dayAriaLabel', { date: formatDay(date), value: compactCurrency(st.value, lang), count: formatNumber(st.count) });

  return (
    <>
      <div className={s.filterRow}>
        <Field label={t('activity.scope')}>
          <Select
            value={scope}
            onChange={(e) => {
              setScope(e.target.value);
              setSelected('');
            }}
          >
            <option value="">{t('activity.scopeWholeProject')}</option>
            {(registries.contractors || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className={s.stats2}>
          <StatCard compact label={t('activity.recordedDays')} value={formatNumber(radar.recorded)} />
          <StatCard compact label={t('activity.emptyDays')} value={formatNumber(radar.empty)} tone={radar.empty > 0 ? 'warning' : undefined} footer={radar.empty > 0 ? t('activity.emptyDayNote') : undefined} />
        </div>
      </div>

      <Card padding="md">
        <div className={s.heatScroll} ref={scrollerRef}>
          <div className={s.heat} style={{ '--weeks': weeks.length }}>
            <div className={s.corner} />
            {weeks.map((w, i) => (
              <div key={`m${i}`} className={s.monthLabel} style={{ gridColumn: i + 2 }}>
                {w.month ? shortMonthLabel(w.month, lang) : ''}
              </div>
            ))}
            {WEEKDAY_KEYS.map((key, r) => (
              <div key={`d${r}`} className={s.weekday} style={{ gridRow: r + 2 }}>
                {key ? t(key) : ''}
              </div>
            ))}
            {weeks.map((w, c) =>
              w.days.map((d, r) => {
                if (!d) return null;
                const st = stats.get(d.date) || { count: 0, value: 0 };
                const label = dayLabel(d.date, st);
                return (
                  <button
                    key={d.date}
                    type="button"
                    className={cx(s.cell, s[`b${heatBucket(st.value, max)}`], st.count > 0 && st.value === 0 && s.recordedOnly, selected === d.date && s.selected)}
                    style={{ gridColumn: c + 2, gridRow: r + 2 }}
                    title={label}
                    aria-label={label}
                    aria-pressed={selected === d.date}
                    onClick={() => setSelected(selected === d.date ? '' : d.date)}
                  />
                );
              })
            )}
          </div>
        </div>
        <div className={s.legend} aria-hidden="true">
          <span>{t('activity.legendLess')}</span>
          {[0, 1, 2, 3, 4].map((b) => (
            <span key={b} className={cx(s.cell, s[`b${b}`])} />
          ))}
          <span>{t('activity.legendMore')}</span>
        </div>
      </Card>

      {detail && (
        <Card
          title={`${t('activity.dayDetailsTitle')} — ${formatDay(selected)}`}
          titleAs="h2"
          subtitle={`${t('activity.approvedValue')}: ${compactCurrency(stats.get(selected)?.value || 0, lang)} · ${formatNumber(stats.get(selected)?.count || 0)} ${t('activity.orderCountUnit')}`}
          actions={<IconButton icon={X} label={t('common.close')} variant="ghost" onClick={() => setSelected('')} />}
          padding="sm"
        >
          {detail.length === 0 ? (
            <p className={s.warn}>{t('activity.emptyDayWarning')}</p>
          ) : (
            <ul className={s.list}>
              {detail.map((e) => (
                <li key={`${e.kind}-${e.id}`}>
                  <FeedRow entry={e} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}

const VIEWS = ['feed', 'task', 'heatmap'];

/**
 * /reports/activity — the audit trail: every order, variation order and app
 * event (filterable), one item's whole story, and the activity heatmap.
 * The view is kept in the URL (?view=heatmap).
 */
export default function ActivityPage() {
  const { t, lang } = useI18n();
  const { orders, projectMeta, appEvents } = useProject();
  const [params, setParams] = useSearchParams();
  const view = VIEWS.includes(params.get('view')) ? params.get('view') : 'feed';
  const feed = useMemo(
    () => buildUnifiedFeed({ orders, variations: projectMeta.variations || [], appEvents }),
    // lang: feed titles are translated when built
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, projectMeta.variations, appEvents, lang]
  );

  return (
    <Page area="reports">
      <p className={s.intro}>{t('activity.subtitle')}</p>
      <Segmented
        label={t('activity.title')}
        value={view}
        onChange={(v) => setParams(v === 'feed' ? {} : { view: v }, { replace: true })}
        options={[
          { value: 'feed', label: t('activity.tabFeed') },
          { value: 'task', label: t('activity.tabTask') },
          { value: 'heatmap', label: t('activity.tabHeatmap') },
        ]}
      />
      {view === 'feed' && <FeedView feed={feed} />}
      {view === 'task' && <TaskView />}
      {view === 'heatmap' && <HeatmapView />}
    </Page>
  );
}
