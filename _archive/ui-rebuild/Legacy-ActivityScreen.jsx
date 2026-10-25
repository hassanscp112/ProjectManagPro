import { useMemo, useRef, useState } from 'react';
import './ActivityScreen.css';
import { buildUnifiedFeed, formatDiff, orderValueInIQD } from '../../utils/ActivityLog';
import { useI18n } from '../../i18n/useI18n.js';
import { compactCurrency } from '../../i18n/index.js';

// ── static maps ─────────────────────────────────────────────────────────────

const ORDER_TYPE_ICONS = {
  quick_work: '🏗️',
  completion: '✅',
  concrete_test: '🧪',
  soil_test: '⛏️',
  material: '🧱',
  payroll: '👷',
  machinery: '🚜',
  fuel: '⛽',
  other_expense: '💸',
};

const FEED_CHIPS = [
  { value: 'all', key: 'activity.chipAll' },
  { value: 'value', key: 'activity.chipValue' },
  { value: 'expense', key: 'activity.chipExpense' },
  { value: 'variation', key: 'activity.chipVariation' },
  { value: 'event', key: 'activity.chipEvent' },
];

const TABS = [
  { value: 'feed', key: 'activity.tabFeed' },
  { value: 'task', key: 'activity.tabTask' },
  { value: 'heatmap', key: 'activity.tabHeatmap' },
];

// ── small local helpers ─────────────────────────────────────────────────────

const fmtNum = (n) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(n) || 0);

const timeOf = (at) => (at && at.length >= 16 ? at.slice(11, 16) : '');

const pad2 = (n) => String(n).padStart(2, '0');
const toDateStr = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Resolve an order's `who` into a readable label (i18n-aware) via the registries.
const whoLabel = (who, registries, t) => {
  if (!who || !who.kind || who.kind === 'none') return '';
  if (who.kind === 'contractor') {
    const c = (registries?.contractors || []).find((x) => x.id === who.contractorId);
    return c?.name ? t('activity.whoContractor', { name: c.name }) : t('activity.whoContractorOnly');
  }
  if (who.kind === 'team') {
    const tm = (registries?.teams || []).find((x) => x.id === who.teamId);
    return tm?.name ? t('activity.whoTeam', { name: tm.name }) : t('activity.whoTeamOnly');
  }
  if (who.kind === 'workers') {
    const names = (who.workerIds || [])
      .map((id) => (registries?.workers || []).find((w) => w.id === id)?.name)
      .filter(Boolean);
    if (names.length === 0) return t('activity.whoWorkersOnly');
    const sep = t('activity.listSeparator');
    if (names.length <= 2) return t('activity.whoWorkers', { names: names.join(sep) });
    return t('activity.whoWorkersMore', {
      names: names.slice(0, 2).join(sep),
      extra: String(names.length - 2),
    });
  }
  return '';
};

const entryIcon = (entry) => {
  if (entry.kind === 'variation') return '📝';
  if (entry.kind === 'event') return '⚡';
  return ORDER_TYPE_ICONS[entry.payload?.order?.type] || '🧾';
};

// ── component ───────────────────────────────────────────────────────────────

const ActivityScreen = ({ orders, variations, appEvents, tasks, registries }) => {
  const { t, lang, dir } = useI18n();
  const [tab, setTab] = useState('feed');

  // feed filters
  const [chip, setChip] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [actorQuery, setActorQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(100);

  // per-task history
  const [taskQuery, setTaskQuery] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');

  // heatmap
  const [contractorFilter, setContractorFilter] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [tip, setTip] = useState(null);
  const gridRef = useRef(null);

  const safeOrders = useMemo(() => (Array.isArray(orders) ? orders : []), [orders]);
  const safeVariations = useMemo(() => (Array.isArray(variations) ? variations : []), [variations]);
  const safeEvents = useMemo(() => (Array.isArray(appEvents) ? appEvents : []), [appEvents]);
  const safeTasks = useMemo(() => (Array.isArray(tasks) ? tasks : []), [tasks]);

  const taskById = useMemo(() => new Map(safeTasks.map((task) => [task.id, task])), [safeTasks]);

  // Heatmap week rows run Saturday → Friday; index = (getDay() + 1) % 7.
  // Sparse labels keep the gutter readable (GitHub-style).
  const weekdayLabels = [
    t('activity.weekdaySat'),
    '',
    t('activity.weekdayMon'),
    '',
    t('activity.weekdayWed'),
    '',
    t('activity.weekdayFri'),
  ];

  /* ── tab 1: unified feed ── */

  // `lang` is a dep because buildUnifiedFeed resolves labels via loadLanguage().
  const feed = useMemo(
    () => buildUnifiedFeed({ orders: safeOrders, variations: safeVariations, appEvents: safeEvents }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- labels come from localStorage, not props
    [safeOrders, safeVariations, safeEvents, lang]
  );

  const filteredFeed = useMemo(() => {
    const q = actorQuery.trim().toLowerCase();
    return feed.filter((e) => {
      if (chip === 'variation' || chip === 'event') {
        if (e.kind !== chip) return false;
      } else if (chip !== 'all' && !(e.kind === 'order' && e.family === chip)) {
        return false;
      }
      if (fromDate && (e.date || '') < fromDate) return false;
      if (toDate && (e.date || '') > toDate) return false;
      if (q && !(e.actor || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [feed, chip, fromDate, toDate, actorQuery]);

  // Any filter change collapses the feed back to the first page.
  const resetPagination = () => setVisibleCount(100);
  const onChipChange = (value) => {
    setChip(value);
    resetPagination();
  };
  const onFromDateChange = (value) => {
    setFromDate(value);
    resetPagination();
  };
  const onToDateChange = (value) => {
    setToDate(value);
    resetPagination();
  };
  const onActorQueryChange = (value) => {
    setActorQuery(value);
    resetPagination();
  };

  /* ── tab 2: per-task story ── */

  const leafTasks = useMemo(() => safeTasks.filter((task) => !task.isGroup), [safeTasks]);

  const taskMatches = useMemo(() => {
    const q = taskQuery.trim();
    if (!q) return leafTasks.slice(0, 50);
    return leafTasks
      .filter((task) => (task.wbs || '').includes(q) || (task.name || '').includes(q))
      .slice(0, 50);
  }, [leafTasks, taskQuery]);

  const selectedTask = useMemo(
    () => safeTasks.find((task) => task.id === selectedTaskId) || null,
    [safeTasks, selectedTaskId]
  );

  const taskStory = useMemo(() => {
    if (!selectedTask) return null;
    const ownOrders = safeOrders.filter((o) => o.taskId === selectedTask.id);
    const ownVariations = safeVariations.filter((v) => v.taskId === selectedTask.id);
    const ownEvents = safeEvents.filter((e) => e.refId === selectedTask.id);

    const entries = buildUnifiedFeed({
      orders: ownOrders,
      variations: ownVariations,
      appEvents: ownEvents,
    });
    entries.reverse(); // chronological ASC — the task's full story

    const valueOrders = ownOrders.filter((o) => o.family === 'value');
    const executedQty = valueOrders.reduce((acc, o) => acc + (Number(o.quantity) || 0), 0);
    const executedValue = valueOrders.reduce((acc, o) => acc + orderValueInIQD(o, safeTasks), 0);
    const contractQty = Number(selectedTask.quantity) || 0;
    const contractValue = contractQty * (Number(selectedTask.unitPrice) || 0);

    return {
      entries,
      totals: {
        unit: selectedTask.unit || '',
        contractQty,
        executedQty,
        variance: executedQty - contractQty,
        contractValue,
        executedValue,
        orderCount: ownOrders.length,
        approvedCount: ownOrders.filter((o) => o.status === 'approved').length,
        variationCount: ownVariations.length,
        eventCount: ownEvents.length,
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- entries localize via loadLanguage(), not props
  }, [selectedTask, safeOrders, safeVariations, safeEvents, safeTasks, lang]);

  /* ── tab 3: heatmap ── */

  // Contractor scope: '' = whole project.
  const heatOrders = useMemo(
    () =>
      contractorFilter
        ? safeOrders.filter((o) => o.who?.contractorId === contractorFilter)
        : safeOrders,
    [safeOrders, contractorFilter]
  );

  // Per-day aggregates: count = ALL orders that day (work recorded?),
  // value = total IQD of APPROVED value-orders that day (heatmap intensity).
  const dayStats = useMemo(() => {
    const map = new Map();
    heatOrders.forEach((o) => {
      const d = String(o.date || '').slice(0, 10);
      if (!d) return;
      const cur = map.get(d) || { count: 0, value: 0 };
      cur.count += 1;
      if (o.family === 'value' && o.status === 'approved') {
        cur.value += orderValueInIQD(o, safeTasks);
      }
      map.set(d, cur);
    });
    return map;
  }, [heatOrders, safeTasks]);

  const maxValue = useMemo(() => {
    let m = 0;
    dayStats.forEach((s) => {
      if (s.value > m) m = s.value;
    });
    return m;
  }, [dayStats]);

  const bucketOf = (value) => {
    if (!(value > 0) || !(maxValue > 0)) return 0;
    const ratio = value / maxValue;
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.75) return 3;
    return 4;
  };

  // Last 12 months as week columns (Sat→Fri rows), oldest week first.
  // Column flow follows the container dir: RTL → oldest on the right,
  // LTR → oldest on the left (normal reading order).
  const calendar = useMemo(() => {
    const today = startOfDay(new Date());
    const start = new Date(today.getFullYear(), today.getMonth() - 11, 1);
    start.setDate(start.getDate() - ((start.getDay() + 1) % 7)); // back to Saturday
    const weeks = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    let labeledMonth = -1;
    while (cursor <= today) {
      const days = [];
      let label = '';
      for (let i = 0; i < 7; i++) {
        const d = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + i);
        if (d > today) {
          days.push(null); // future padding inside the last week
          continue;
        }
        if (d.getDate() === 1 && d.getMonth() !== labeledMonth) {
          labeledMonth = d.getMonth();
          label = String(d.getMonth() + 1);
        }
        const ds = toDateStr(d);
        days.push({ date: ds, stats: dayStats.get(ds) || { count: 0, value: 0 } });
      }
      weeks.push({ label, days });
      cursor.setDate(cursor.getDate() + 7);
    }
    return weeks;
  }, [dayStats]);

  // Data-gap radar: the site works 7 days/week — an empty day is unrecorded work.
  const last90 = useMemo(() => {
    const counts = { recorded: 0, empty: 0 };
    const today = startOfDay(new Date());
    for (let i = 0; i < 90; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const s = dayStats.get(toDateStr(d));
      if (s && s.count > 0) counts.recorded += 1;
      else counts.empty += 1;
    }
    return counts;
  }, [dayStats]);

  const dayDetail = useMemo(() => {
    if (!selectedDay) return null;
    const dayOrders = heatOrders.filter((o) => String(o.date || '').slice(0, 10) === selectedDay);
    // Variations carry no contractor attribution — show them in whole-project mode only.
    const dayVariations = contractorFilter
      ? []
      : safeVariations.filter((v) => String(v.date || '').slice(0, 10) === selectedDay);
    const entries = buildUnifiedFeed({ orders: dayOrders, variations: dayVariations, appEvents: [] });
    entries.reverse(); // ASC within the day
    return { entries, stats: dayStats.get(selectedDay) || { count: 0, value: 0 } };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- entries localize via loadLanguage(), not props
  }, [selectedDay, heatOrders, safeVariations, contractorFilter, dayStats, lang]);

  const showTip = (e, day) => {
    const grid = gridRef.current;
    if (!grid || !day) return;
    const cr = e.currentTarget.getBoundingClientRect();
    const gr = grid.getBoundingClientRect();
    const x = Math.min(Math.max(cr.left - gr.left + cr.width / 2, 90), Math.max(gr.width - 90, 90));
    setTip({ ...day.stats, date: day.date, x, y: cr.top - gr.top });
  };

  /* ── shared entry renderer (feed, day detail, task story) ── */

  const renderEntry = (entry) => {
    const o = entry.kind === 'order' ? entry.payload?.order : null;
    const v = entry.kind === 'variation' ? entry.payload?.variation : null;

    let wbs = o?.taskWbs || v?.taskWbs || '';
    let taskName = o?.taskName || v?.taskName || '';
    if (!wbs && entry.refTaskId) {
      const task = taskById.get(entry.refTaskId);
      wbs = task?.wbs || '';
      taskName = task?.name || '';
    }

    const qty = Number(o?.quantity) || 0;
    const amount = Number(o?.amount) || 0;
    const value = o ? orderValueInIQD(o, safeTasks) : 0;
    const who = o ? whoLabel(o.who, registries, t) : '';
    const time = timeOf(entry.at);

    return (
      <li key={entry.id} className={`feed-item tone-${entry.tone}`}>
        <div className="feed-icon">{entryIcon(entry)}</div>
        <div className="feed-main">
          <div className="feed-head">
            <span className="feed-title">{entry.title}</span>
            <span className="feed-date mono">
              {entry.date || '—'}
              {time ? ` · ${time}` : ''}
            </span>
          </div>
          {entry.subtitle && <div className="feed-subtitle">{entry.subtitle}</div>}
          {wbs && (
            <span className="feed-task-chip mono" title={taskName}>
              {wbs} {taskName ? `— ${taskName}` : ''}
            </span>
          )}
          {o && (
            <div className="feed-figures mono">
              {qty > 0 && (
                <span>
                  {t('common.quantity')}: {fmtNum(qty)} {o.unit || ''}
                </span>
              )}
              {amount > 0 && (
                <span>
                  {t('activity.amount')}: {compactCurrency(amount, lang)}
                </span>
              )}
              {value > 0 && (
                <span className="fig-value">
                  {t('activity.value')}: {compactCurrency(value, lang)}
                </span>
              )}
              <span className={`fig-status ${o.status === 'approved' ? 'ok' : 'rec'}`}>
                {o.status === 'approved' ? t('common.approved') : t('common.recorded')}
              </span>
            </div>
          )}
          {v && (
            <div className="feed-figures mono">
              <span className="fig-diff">{formatDiff(v.oldValue, v.newValue)}</span>
            </div>
          )}
          {who && <div className="feed-who">{who}</div>}
        </div>
        <div className="feed-actor" title={t('activity.actorLabel')}>
          {entry.actor || '—'}
        </div>
      </li>
    );
  };

  /* ── render ── */

  const shownFeed = filteredFeed.slice(0, visibleCount);

  return (
    <div className="activity-screen" dir={dir}>
      <header className="act-header">
        <h2>{t('activity.title')}</h2>
        <p>{t('activity.subtitle')}</p>
      </header>

      <div className="act-tabs" role="tablist">
        {TABS.map((tabDef) => (
          <button
            key={tabDef.value}
            type="button"
            role="tab"
            aria-selected={tab === tabDef.value}
            className={`act-tab ${tab === tabDef.value ? 'active' : ''}`}
            onClick={() => {
              setTab(tabDef.value);
              setTip(null);
            }}
          >
            {t(tabDef.key)}
          </button>
        ))}
      </div>

      {/* ── tab 1: timeline feed ── */}
      {tab === 'feed' && (
        <section className="act-panel" role="tabpanel">
          <div className="act-controls">
            <div className="act-chips">
              {FEED_CHIPS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`act-chip ${chip === c.value ? 'active' : ''}`}
                  onClick={() => onChipChange(c.value)}
                >
                  {t(c.key)}
                </button>
              ))}
            </div>
            <div className="act-controls-row">
              <label className="act-field">
                <span>{t('activity.fromDate')}</span>
                <input
                  type="date"
                  className="act-input mono"
                  value={fromDate}
                  onChange={(e) => onFromDateChange(e.target.value)}
                />
              </label>
              <label className="act-field">
                <span>{t('activity.toDate')}</span>
                <input
                  type="date"
                  className="act-input mono"
                  value={toDate}
                  onChange={(e) => onToDateChange(e.target.value)}
                />
              </label>
              <label className="act-field grow">
                <span>{t('activity.actorLabel')}</span>
                <input
                  type="text"
                  className="act-input"
                  placeholder={t('activity.actorPlaceholder')}
                  value={actorQuery}
                  onChange={(e) => onActorQueryChange(e.target.value)}
                />
              </label>
              <span className="act-count mono">
                {t('activity.entryCount', { n: fmtNum(filteredFeed.length) })}
              </span>
            </div>
          </div>

          <div className="feed-card">
            {shownFeed.length === 0 ? (
              <div className="act-empty">{t('activity.feedEmpty')}</div>
            ) : (
              <ul className="feed-list">{shownFeed.map(renderEntry)}</ul>
            )}
          </div>

          {filteredFeed.length > visibleCount && (
            <div className="act-more">
              <button
                type="button"
                className="act-more-btn"
                onClick={() => setVisibleCount((n) => n + 100)}
              >
                {t('activity.loadMore', { n: fmtNum(filteredFeed.length - visibleCount) })}
              </button>
            </div>
          )}
        </section>
      )}

      {/* ── tab 2: per-task history ── */}
      {tab === 'task' && (
        <section className="act-panel" role="tabpanel">
          <div className="tp-picker">
            <input
              type="text"
              className="act-input tp-search"
              placeholder={t('activity.taskSearchPlaceholder')}
              value={taskQuery}
              onChange={(e) => setTaskQuery(e.target.value)}
            />
            {selectedTask && (
              <span className="tp-selected mono">
                {selectedTask.wbs} — {selectedTask.name}
                <button
                  type="button"
                  className="tp-clear"
                  onClick={() => setSelectedTaskId('')}
                  title={t('activity.taskClearSelection')}
                >
                  ✕
                </button>
              </span>
            )}
          </div>

          <div className="tp-list">
            {taskMatches.length === 0 ? (
              <div className="act-empty">{t('activity.taskNoMatch')}</div>
            ) : (
              taskMatches.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className={`tp-row ${selectedTaskId === task.id ? 'active' : ''}`}
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  <span className="tp-row-wbs mono">{task.wbs}</span>
                  <span className="tp-row-name">{task.name}</span>
                </button>
              ))
            )}
          </div>

          {taskStory && selectedTask && (
            <div className="tp-story">
              <div className="tp-totals">
                <div className="act-stat-card">
                  <span className="act-stat-label">{t('common.contractQty')}</span>
                  <span className="act-stat-value mono">
                    {fmtNum(taskStory.totals.contractQty)} {taskStory.totals.unit}
                  </span>
                </div>
                <div className="act-stat-card">
                  <span className="act-stat-label">{t('activity.executedFromLog')}</span>
                  <span className="act-stat-value mono">
                    {fmtNum(taskStory.totals.executedQty)} {taskStory.totals.unit}
                  </span>
                </div>
                <div className="act-stat-card">
                  <span className="act-stat-label">{t('common.variance')}</span>
                  <span
                    className={`act-stat-value mono ${
                      taskStory.totals.variance > 0
                        ? 'pos'
                        : taskStory.totals.variance < 0
                          ? 'neg'
                          : ''
                    }`}
                  >
                    {taskStory.totals.variance === 0
                      ? '—'
                      : `${taskStory.totals.variance > 0 ? '+' : ''}${fmtNum(taskStory.totals.variance)}`}
                  </span>
                </div>
                <div className="act-stat-card">
                  <span className="act-stat-label">{t('activity.executedValue')}</span>
                  <span className="act-stat-value mono">
                    {compactCurrency(taskStory.totals.executedValue, lang)}
                  </span>
                </div>
                <div className="act-stat-card">
                  <span className="act-stat-label">{t('activity.contractValue')}</span>
                  <span className="act-stat-value mono">
                    {compactCurrency(taskStory.totals.contractValue, lang)}
                  </span>
                </div>
                <div className="act-stat-card">
                  <span className="act-stat-label">{t('activity.recordings')}</span>
                  <span className="act-stat-value mono">
                    {fmtNum(taskStory.totals.orderCount)}
                    {taskStory.totals.approvedCount > 0 && (
                      <span className="act-stat-note">
                        {t('activity.ofWhichApproved', {
                          n: fmtNum(taskStory.totals.approvedCount),
                        })}
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <div className="feed-card">
                {taskStory.entries.length === 0 ? (
                  <div className="act-empty">{t('activity.taskEmptyStory')}</div>
                ) : (
                  <ul className="feed-list">{taskStory.entries.map(renderEntry)}</ul>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── tab 3: activity heatmap ── */}
      {tab === 'heatmap' && (
        <section className="act-panel" role="tabpanel">
          <div className="hm-controls">
            <label className="act-field">
              <span>{t('activity.scope')}</span>
              <select
                className="act-select"
                value={contractorFilter}
                onChange={(e) => {
                  setContractorFilter(e.target.value);
                  setSelectedDay('');
                }}
              >
                <option value="">{t('activity.scopeWholeProject')}</option>
                {(registries?.contractors || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="hm-legend">
              <span>{t('activity.legendLess')}</span>
              <span className="hm-cell hm-b0" />
              <span className="hm-cell hm-b1" />
              <span className="hm-cell hm-b2" />
              <span className="hm-cell hm-b3" />
              <span className="hm-cell hm-b4" />
              <span>{t('activity.legendMore')}</span>
            </div>
            <div className="hm-stats">
              <div className="act-stat-card">
                <span className="act-stat-label">{t('activity.recordedDays')}</span>
                <span className="act-stat-value mono">{fmtNum(last90.recorded)}</span>
              </div>
              <div className={`act-stat-card ${last90.empty > 0 ? 'warn' : ''}`}>
                <span className="act-stat-label">{t('activity.emptyDays')}</span>
                <span className="act-stat-value mono">{fmtNum(last90.empty)}</span>
                {last90.empty > 0 && (
                  <span className="act-stat-note">{t('activity.emptyDayNote')}</span>
                )}
              </div>
            </div>
          </div>

          <div className="hm-scroll" ref={gridRef} onMouseLeave={() => setTip(null)}>
            <div className="hm-calendar">
              <div className="hm-months-row">
                <div className="hm-months-spacer" />
                <div className="hm-months">
                  {calendar.map((w, i) => (
                    <div key={i} className="hm-month-slot">
                      {w.label}
                    </div>
                  ))}
                </div>
              </div>
              <div className="hm-main">
                <div className="hm-weekdays">
                  {weekdayLabels.map((l, i) => (
                    <div key={i} className="hm-wd">
                      {l}
                    </div>
                  ))}
                </div>
                <div className="hm-weeks">
                  {calendar.map((week, wi) => (
                    <div key={wi} className="hm-week">
                      {week.days.map((day, di) =>
                        day ? (
                          <button
                            key={di}
                            type="button"
                            className={`hm-cell hm-b${bucketOf(day.stats.value)} ${
                              selectedDay === day.date ? 'selected' : ''
                            }`}
                            aria-label={t('activity.dayAriaLabel', {
                              date: day.date,
                              value: compactCurrency(day.stats.value, lang),
                              count: fmtNum(day.stats.count),
                            })}
                            onMouseEnter={(e) => showTip(e, day)}
                            onFocus={(e) => showTip(e, day)}
                            onClick={() => setSelectedDay(day.date === selectedDay ? '' : day.date)}
                          />
                        ) : (
                          <div key={di} className="hm-cell pad" />
                        )
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {tip && (
              <div className="hm-tip mono" style={{ left: tip.x, top: tip.y }}>
                <strong>{tip.date}</strong>
                <span>
                  {t('activity.approvedValue')}: {compactCurrency(tip.value, lang)}
                </span>
                <span>
                  {t('activity.ordersRecorded')}: {fmtNum(tip.count)}
                </span>
              </div>
            )}
          </div>

          {dayDetail && (
            <div className="hm-day-panel">
              <div className="hm-day-head">
                <h4>
                  {t('activity.dayDetailsTitle')} <span className="mono">{selectedDay}</span>
                </h4>
                <span className="hm-day-total mono">
                  {t('activity.approvedValue')}: {compactCurrency(dayDetail.stats.value, lang)} ·{' '}
                  {fmtNum(dayDetail.stats.count)} {t('activity.orderCountUnit')}
                </span>
                <button type="button" className="hm-day-close" onClick={() => setSelectedDay('')}>
                  ✕ {t('common.close')}
                </button>
              </div>
              {dayDetail.entries.length === 0 ? (
                <div className="hm-empty-warn">{t('activity.emptyDayWarning')}</div>
              ) : (
                <div className="feed-card">
                  <ul className="feed-list">{dayDetail.entries.map(renderEntry)}</ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default ActivityScreen;
