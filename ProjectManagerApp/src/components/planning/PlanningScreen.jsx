import { useEffect, useMemo, useState } from 'react';
import './PlanningScreen.css';
import { useI18n } from '../../i18n/useI18n.js';
import {
  loadPlans,
  savePlans,
  getMonthPlans,
  getWeekPlans,
  getDayPlans,
  upsertTarget,
  deleteTarget,
  upsertAssignment,
  deleteAssignment,
  cloneDayPlan,
  cloneWeekPlan,
  whoLabel,
  monthKey,
  isoWeekKey,
  isoWeekRange,
  todayStr,
  addDaysDate,
  addMonthsKey,
  addWeeksKey,
  createPlanId,
} from '../../utils/PlanningStore';

// Levantine month names (matching the project's Iraqi context: "أيلول 2026").
// English month names come from Intl ('en-GB') — see monthLabel() below.
const MONTHS_AR = [
  'كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
  'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول',
];
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const fmtNum = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v === 0) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(v);
};

const toQty = (v) => (v === '' || v === null || v === undefined ? '' : Number(v));

// 'YYYY-MM' → 'أيلول 2026' (Levantine) | 'September 2026' (en-GB, via Intl).
// UTC throughout so the label never slips a month in western timezones.
const monthLabel = (mKey, lang) => {
  const [y, m] = String(mKey || '').split('-').map(Number);
  if (!y || !m) return '';
  if (lang === 'en') {
    return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(y, m - 1, 1)));
  }
  return `${MONTHS_AR[(m || 1) - 1] || ''} ${y}`;
};

// 'YYYY-MM-DD' → 'الأحد' (Levantine) | 'Sunday' (en-GB, via Intl).
const weekdayLabel = (dateStr, lang) => {
  const parts = String(dateStr || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some((p) => !Number.isFinite(p))) return '';
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  if (lang === 'en') {
    return new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' }).format(date);
  }
  return DAYS_AR[date.getUTCDay()] || '';
};

/* ═══════════════════════════════════════════════════════════
   WhoPicker — fluid crew picker shared by weekly & daily views.
   Three modes: عدد (count) / فريق (team) / عمال (workers chips).
   Switching modes carries over what makes sense, never blocks.
   ═══════════════════════════════════════════════════════════ */

const teamSizeOf = (team) => {
  if (!team) return 0;
  const size = Number(team.defaultSize);
  if (Number.isFinite(size) && size > 0) return size;
  return Array.isArray(team.memberWorkerIds) ? team.memberWorkerIds.length : 0;
};

function WhoPicker({ value, onChange, registries }) {
  const { t, lang } = useI18n();
  const who = value && typeof value === 'object' ? value : { kind: 'count', count: 0 };
  const whoModes = useMemo(
    () => [
      { value: 'count', label: t('planning.whoModeCount') },
      { value: 'team', label: t('planning.whoModeTeam') },
      { value: 'workers', label: t('planning.whoModeWorkers') },
    ],
    [t]
  );
  const kind = whoModes.some((m) => m.value === who.kind) ? who.kind : 'count';
  const regs = registries && typeof registries === 'object' ? registries : {};
  const teams = Array.isArray(regs.teams) ? regs.teams : [];
  const workers = Array.isArray(regs.workers) ? regs.workers : [];

  // loose → tight: derive the tightest representation available, never block.
  const switchMode = (nextKind) => {
    if (nextKind === kind) return;
    const next = { kind: nextKind };
    if (nextKind === 'count') {
      let derived = Number(who.count);
      if (kind === 'workers') derived = (who.workerIds || []).length;
      else if (kind === 'team') derived = teamSizeOf(teams.find((tm) => tm.id === who.teamId));
      next.count = Number.isFinite(derived) && derived > 0 ? derived : 0;
    } else if (nextKind === 'team') {
      // if the picked workers are exactly one team's roster, preselect it
      if (kind === 'workers') {
        const ids = who.workerIds || [];
        const match = teams.find(
          (tm) =>
            Array.isArray(tm.memberWorkerIds) &&
            tm.memberWorkerIds.length === ids.length &&
            ids.every((id) => tm.memberWorkerIds.includes(id))
        );
        if (match) next.teamId = match.id;
      }
    } else if (nextKind === 'workers') {
      // from team → prefill its roster
      if (kind === 'team') {
        const team = teams.find((tm) => tm.id === who.teamId);
        if (team && Array.isArray(team.memberWorkerIds) && team.memberWorkerIds.length) {
          next.workerIds = [...team.memberWorkerIds];
        }
      }
    }
    onChange(next);
  };

  const toggleWorker = (workerId) => {
    const ids = kind === 'workers' ? [...(who.workerIds || [])] : [];
    const idx = ids.indexOf(workerId);
    if (idx === -1) ids.push(workerId);
    else ids.splice(idx, 1);
    onChange({ kind: 'workers', workerIds: ids });
  };

  return (
    <div className="pl-who">
      <div className="pl-who-row">
        <div className="pl-who-modes">
          {whoModes.map((m) => (
            <button
              key={m.value}
              type="button"
              className={`pl-who-mode ${kind === m.value ? 'on' : ''}`}
              onClick={() => switchMode(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <span className="pl-who-summary">{whoLabel(who, regs, lang)}</span>
      </div>

      {kind === 'count' && (
        <input
          className="pl-input pl-who-count"
          type="number"
          min="0"
          value={who.count ?? 0}
          onChange={(e) =>
            onChange({ kind: 'count', count: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value) || 0) })
          }
          placeholder={t('planning.workersCountInput')}
          title={t('planning.workersCountInput')}
        />
      )}

      {kind === 'team' && (
        <select
          className="pl-select pl-who-team"
          value={(who.teamId && teams.some((tm) => tm.id === who.teamId) && who.teamId) || ''}
          onChange={(e) => onChange({ kind: 'team', teamId: e.target.value })}
          title={t('planning.selectTeam')}
        >
          <option value="">{t('planning.selectTeamOption')}</option>
          {teams.map((tm) => (
            <option key={tm.id} value={tm.id}>
              {`${tm.name || t('planning.defaultTeamName')}${teamSizeOf(tm) ? ` (${teamSizeOf(tm)})` : ''}`}
            </option>
          ))}
        </select>
      )}

      {kind === 'workers' && (
        <div className="pl-chips">
          {workers.length === 0 ? (
            <span className="pl-muted">{t('planning.noWorkersInRegistry')}</span>
          ) : (
            workers.map((w) => {
              const on = kind === 'workers' && (who.workerIds || []).includes(w.id);
              return (
                <button
                  key={w.id}
                  type="button"
                  className={`pl-chip ${on ? 'on' : ''}`}
                  onClick={() => toggleWorker(w.id)}
                >
                  {w.name || t('planning.workerFallback')}{w.trade ? ` · ${w.trade}` : ''}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PlanningScreen — rolling lookahead, 3 zoom levels
   ═══════════════════════════════════════════════════════════ */

function PlanningScreen({ tasks, computedTasks, orders, registries }) {
  const { t, lang, dir } = useI18n();
  const [plans, setPlans] = useState(loadPlans);
  const [view, setView] = useState('month'); // 'month' | 'week' | 'day'
  const [selectedMonth, setSelectedMonth] = useState(() => monthKey(todayStr()));
  const [selectedWeek, setSelectedWeek] = useState(() => isoWeekKey(todayStr()));
  const [selectedDate, setSelectedDate] = useState(() => todayStr());

  useEffect(() => {
    savePlans(plans);
  }, [plans]);

  /* ── task / registry data ── */
  const taskList = useMemo(() => (Array.isArray(tasks) ? tasks : []), [tasks]);
  const computedList = useMemo(() => (Array.isArray(computedTasks) ? computedTasks : []), [computedTasks]);
  const ordersList = useMemo(() => (Array.isArray(orders) ? orders : []), [orders]);

  // raw task first, engine output as fallback (names / units / dates)
  const infoById = useMemo(() => {
    const map = new Map();
    taskList.forEach((task) => map.set(task.id, task));
    computedList.forEach((task) => {
      if (!map.has(task.id)) map.set(task.id, task);
    });
    return map;
  }, [taskList, computedList]);

  const leafTasks = useMemo(() => taskList.filter((task) => !task.isGroup), [taskList]);

  // top-level sections (wbs depth 1) with their leaf tasks
  const sections = useMemo(() => {
    const tops = taskList.filter((task) => task.wbs && task.wbs.split('.').length === 1);
    return tops
      .map((sec) => ({
        section: sec,
        leaves: sec.isGroup
          ? taskList.filter((task) => !task.isGroup && typeof task.wbs === 'string' && task.wbs.startsWith(`${sec.wbs}.`))
          : [sec],
      }))
      .filter((entry) => entry.leaves.length > 0);
  }, [taskList]);

  /* ── current period data ── */
  const monthTargets = getMonthPlans(plans, selectedMonth);
  const weekAssignments = getWeekPlans(plans, selectedWeek);
  const dayAssignments = getDayPlans(plans, selectedDate);

  // Σ approved value orders per task inside the selected month
  const monthActualByTask = useMemo(() => {
    const map = new Map();
    ordersList.forEach((o) => {
      if (!o || o.family !== 'value' || o.status !== 'approved' || !o.taskId) return;
      if (monthKey(o.date) !== selectedMonth) return;
      const q = Number(o.quantity);
      if (!Number.isFinite(q)) return;
      map.set(o.taskId, (map.get(o.taskId) || 0) + q);
    });
    return map;
  }, [ordersList, selectedMonth]);

  // value orders (any status) per task on the selected date
  const dayOrdersByTask = useMemo(() => {
    const map = new Map();
    ordersList.forEach((o) => {
      if (!o || o.family !== 'value' || !o.taskId || o.date !== selectedDate) return;
      if (!map.has(o.taskId)) map.set(o.taskId, []);
      map.get(o.taskId).push(o);
    });
    return map;
  }, [ordersList, selectedDate]);

  const dayDoneCount = dayAssignments.filter((a) =>
    (dayOrdersByTask.get(a.taskId) || []).some((o) => o.status === 'approved')
  ).length;
  const dayApprovedOrdersCount = Array.from(dayOrdersByTask.values()).reduce(
    (acc, list) => acc + list.filter((o) => o.status === 'approved').length,
    0
  );
  const ppc = dayAssignments.length > 0 ? dayDoneCount / dayAssignments.length : null;
  const ppcTone = ppc == null ? '' : ppc >= 0.8 ? 'green' : ppc >= 0.5 ? 'amber' : 'red';

  const monthTotals = useMemo(() => {
    let target = 0;
    let actual = 0;
    const seen = new Set();
    monthTargets.forEach((row) => {
      const q = Number(row.quantity);
      if (Number.isFinite(q)) target += q;
      if (!seen.has(row.taskId)) {
        seen.add(row.taskId);
        actual += monthActualByTask.get(row.taskId) || 0;
      }
    });
    return { count: monthTargets.length, target, actual, pct: target > 0 ? actual / target : null };
  }, [monthTargets, monthActualByTask]);

  const allSectionLeafIds = useMemo(() => {
    const set = new Set();
    sections.forEach(({ leaves }) => leaves.forEach((l) => set.add(l.id)));
    return set;
  }, [sections]);
  const otherTargets = monthTargets.filter((row) => !allSectionLeafIds.has(row.taskId));

  /* ── period navigation ── */
  const stepPeriod = (navDir) => {
    if (view === 'month') setSelectedMonth(addMonthsKey(selectedMonth, navDir));
    else if (view === 'week') setSelectedWeek(addWeeksKey(selectedWeek, navDir));
    else setSelectedDate(addDaysDate(selectedDate, navDir));
  };

  const today = todayStr();
  let periodMain;
  let periodSub = '';
  if (view === 'month') {
    periodMain = monthLabel(selectedMonth, lang);
  } else if (view === 'week') {
    const [wy, wn] = selectedWeek.split('-W');
    const range = isoWeekRange(selectedWeek);
    periodMain = t('planning.weekLabel', { week: Number(wn) || '', year: wy });
    periodSub = range ? `${range.start} – ${range.end}` : '';
  } else {
    periodMain = `${weekdayLabel(selectedDate, lang)} ${selectedDate}`;
    periodSub = selectedDate === today ? t('common.today') : '';
  }

  const monthLabelText = useMemo(() => monthLabel(selectedMonth, lang), [selectedMonth, lang]);

  const prevTitle = view === 'month'
    ? t('planning.prevMonth')
    : view === 'week'
      ? t('planning.prevWeek')
      : t('planning.prevDay');
  const nextTitle = view === 'month'
    ? t('planning.nextMonth')
    : view === 'week'
      ? t('planning.nextWeek')
      : t('planning.nextDay');

  /* ── mutations ── */
  const handleAddTarget = (leaves) => {
    setPlans((p) =>
      upsertTarget(p, selectedMonth, {
        id: createPlanId(),
        taskId: leaves[0] ? leaves[0].id : '',
        quantity: '',
        note: '',
      })
    );
  };

  const handleTargetChange = (target, patch) => {
    setPlans((p) => upsertTarget(p, selectedMonth, { ...target, ...patch }));
  };

  const handleTargetDelete = (targetId) => {
    setPlans((p) => deleteTarget(p, selectedMonth, targetId));
  };

  const handleAssignChange = (scope, key, assignment, patch) => {
    setPlans((p) => upsertAssignment(p, scope, key, { ...assignment, ...patch }));
  };

  const handleAssignDelete = (scope, key, assignmentId) => {
    setPlans((p) => deleteAssignment(p, scope, key, assignmentId));
  };

  const handleAddAssignment = (scope, key) => {
    setPlans((p) =>
      upsertAssignment(p, scope, key, {
        id: createPlanId(),
        taskId: leafTasks[0] ? leafTasks[0].id : '',
        who: { kind: 'count', count: 0 },
        note: '',
      })
    );
  };

  const handleCopyLastWeek = () => {
    const lastWeek = addWeeksKey(selectedWeek, -1);
    const source = getWeekPlans(plans, lastWeek);
    if (!source.length) {
      window.alert(t('planning.alertNoLastWeek'));
      return;
    }
    if (
      weekAssignments.length > 0 &&
      !window.confirm(t('planning.confirmReplaceWeek'))
    ) {
      return;
    }
    setPlans((p) => cloneWeekPlan(p, lastWeek, selectedWeek, 'replace'));
  };

  const handleSameAsYesterday = () => {
    const yesterday = addDaysDate(selectedDate, -1);
    const source = getDayPlans(plans, yesterday);
    if (!source.length) {
      window.alert(t('planning.alertNoYesterday'));
      return;
    }
    if (
      dayAssignments.length > 0 &&
      !window.confirm(t('planning.confirmReplaceDay'))
    ) {
      return;
    }
    setPlans((p) => cloneDayPlan(p, yesterday, selectedDate, 'replace'));
  };

  /* ── render helpers (plain functions, no hooks) ── */

  const renderTaskOptions = (taskId, options) => (
    <>
      {taskId && !options.some((o) => o.id === taskId) && <option value={taskId}>{t('planning.deletedTask')}</option>}
      {options.map((leaf) => (
        <option key={leaf.id} value={leaf.id}>
          {`${leaf.wbs || ''} — ${leaf.name || t('planning.taskFallback')}`}
        </option>
      ))}
    </>
  );

  const renderTargetRow = (target, leaves) => {
    const info = infoById.get(target.taskId);
    const actual = monthActualByTask.get(target.taskId) || 0;
    const qty = Number(target.quantity);
    const pct = Number.isFinite(qty) && qty > 0 ? actual / qty : null;
    const tone = pct == null ? '' : pct >= 1 ? 'ok' : pct >= 0.5 ? 'mid' : 'low';
    return (
      <tr key={target.id}>
        <td>
          <select
            className="pl-select"
            value={target.taskId}
            onChange={(e) => handleTargetChange(target, { taskId: e.target.value })}
          >
            {renderTaskOptions(target.taskId, leaves)}
          </select>
        </td>
        <td className="pl-num">
          <input
            className="pl-input pl-input-num"
            type="number"
            min="0"
            value={target.quantity ?? ''}
            onChange={(e) => handleTargetChange(target, { quantity: toQty(e.target.value) })}
            placeholder="0"
            title={t('planning.targetQtyTitle')}
          />
        </td>
        <td className="pl-num pl-unit">{info?.unit || '—'}</td>
        <td className="pl-num pl-actual" title={t('planning.actualTitle')}>
          {fmtNum(actual)}
        </td>
        <td className="pl-num">
          <div className="pl-progress">
            <div className="pl-progress-track">
              <div
                className={`pl-progress-fill ${tone}`}
                style={{ width: pct == null ? '0%' : `${Math.min(100, pct * 100)}%` }}
              />
            </div>
            <span className="pl-progress-text">{pct == null ? '—' : `${Math.round(pct * 100)}%`}</span>
          </div>
        </td>
        <td>
          <input
            className="pl-input"
            value={target.note || ''}
            onChange={(e) => handleTargetChange(target, { note: e.target.value })}
            placeholder={t('planning.noteOptional')}
          />
        </td>
        <td>
          <button className="pl-icon-btn danger" onClick={() => handleTargetDelete(target.id)} title={t('planning.deleteTarget')}>
            ✕
          </button>
        </td>
      </tr>
    );
  };

  const renderDayCard = (a) => {
    const info = infoById.get(a.taskId);
    const unit = info?.unit || '';
    const dayOrders = dayOrdersByTask.get(a.taskId) || [];
    const approvedSum = dayOrders
      .filter((o) => o.status === 'approved')
      .reduce((s, o) => s + (Number(o.quantity) || 0), 0);
    const isDone = dayOrders.some((o) => o.status === 'approved');
    return (
      <div key={a.id} className={`pl-card ${isDone ? 'done' : ''}`}>
        <div className="pl-card-main">
          <select
            className="pl-select pl-card-task"
            value={a.taskId}
            onChange={(e) => handleAssignChange('days', selectedDate, a, { taskId: e.target.value })}
          >
            {renderTaskOptions(a.taskId, leafTasks)}
          </select>
          <WhoPicker
            value={a.who}
            onChange={(who) => handleAssignChange('days', selectedDate, a, { who })}
            registries={registries}
          />
          <input
            className="pl-input pl-card-note"
            value={a.note || ''}
            onChange={(e) => handleAssignChange('days', selectedDate, a, { note: e.target.value })}
            placeholder={t('planning.noteOptional')}
          />
          <button
            className="pl-icon-btn danger"
            onClick={() => handleAssignDelete('days', selectedDate, a.id)}
            title={t('planning.deleteAssignment')}
          >
            ✕
          </button>
        </div>
        <div className="pl-card-actual">
          <span className="pl-card-actual-label">{t('planning.dayOrdersLabel')}</span>
          {dayOrders.length === 0 ? (
            <span className="pl-muted">{t('planning.noDayOrders')}</span>
          ) : (
            <>
              {dayOrders.map((o, i) => (
                <span key={o.id || i} className={`pl-order-chip ${o.status === 'approved' ? 'approved' : 'recorded'}`}>
                  {`${fmtNum(o.quantity)} ${unit} · ${o.status === 'approved' ? t('common.approved') : t('common.recorded')}`}
                </span>
              ))}
              <span className="pl-order-sum">{t('planning.approvedSum', { sum: fmtNum(approvedSum), unit })}</span>
            </>
          )}
          <span className={`pl-done-badge ${isDone ? 'ok' : ''}`}>{isDone ? t('planning.doneBadge') : t('planning.pendingBadge')}</span>
        </div>
      </div>
    );
  };

  /* ── views ── */

  const monthlyView = (
    <div className="pl-view">
      <div className="pl-view-hint">
        {t('planning.monthHint')}
      </div>

      <div className="pl-totals">
        <div className="kpi-compact-card">
          <span className="kpi-compact-label">{t('planning.kpiMonthTargets')}</span>
          <span className="kpi-compact-value">{monthTotals.count}</span>
        </div>
        <div className="kpi-compact-card">
          <span className="kpi-compact-label">{t('planning.kpiTargetSum')}</span>
          <span className="kpi-compact-value">{fmtNum(monthTotals.target)}</span>
        </div>
        <div className="kpi-compact-card">
          <span className="kpi-compact-label">{t('planning.kpiActualExecuted')}</span>
          <span className="kpi-compact-value">{fmtNum(monthTotals.actual)}</span>
        </div>
        <div
          className={`kpi-compact-card ${
            monthTotals.pct == null ? '' : monthTotals.pct >= 1 ? 'pl-tone-green' : monthTotals.pct >= 0.5 ? 'pl-tone-amber' : 'pl-tone-red'
          }`}
        >
          <span className="kpi-compact-label">{t('planning.kpiAchievementRate')}</span>
          <span className="kpi-compact-value">
            {monthTotals.pct == null ? '—' : `${Math.round(monthTotals.pct * 100)}%`}
          </span>
        </div>
      </div>

      {sections.length === 0 && monthTargets.length === 0 ? (
        <div className="pl-empty">
          {t('planning.emptyNoTasks')}
        </div>
      ) : (
        sections.map(({ section, leaves }) => {
          const rows = monthTargets.filter((row) => leaves.some((l) => l.id === row.taskId));
          return (
            <div className="pl-section" key={section.id}>
              <div className="pl-section-head">
                <h3>{section.name || t('planning.unnamedSection')}</h3>
                <button className="pl-btn" onClick={() => handleAddTarget(leaves)}>
                  {t('planning.addTarget')}
                </button>
              </div>
              {rows.length === 0 ? (
                <div className="pl-empty small">
                  {t('planning.emptySectionTargets', { month: monthLabelText })}
                </div>
              ) : (
                <div className="pl-table-wrap">
                  <table className="pl-table">
                    <thead>
                      <tr>
                        <th>{t('planning.task')}</th>
                        <th>{t('planning.targetQty')}</th>
                        <th>{t('common.unit')}</th>
                        <th>{t('planning.executedThisMonth')}</th>
                        <th>{t('planning.achievement')}</th>
                        <th>{t('planning.note')}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>{rows.map((row) => renderTargetRow(row, leaves))}</tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })
      )}

      {otherTargets.length > 0 && (
        <div className="pl-section">
          <div className="pl-section-head">
            <h3>{t('planning.otherTasks')}</h3>
          </div>
          <div className="pl-table-wrap">
            <table className="pl-table">
              <thead>
                <tr>
                  <th>{t('planning.task')}</th>
                  <th>{t('planning.targetQty')}</th>
                  <th>{t('common.unit')}</th>
                  <th>{t('planning.executedThisMonth')}</th>
                  <th>{t('planning.achievement')}</th>
                  <th>{t('planning.note')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>{otherTargets.map((row) => renderTargetRow(row, leafTasks))}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const weeklyView = (
    <div className="pl-view">
      <div className="pl-view-head">
        <div className="pl-view-hint">
          {t('planning.weekHint')}
        </div>
        <div className="pl-head-actions">
          <button className="pl-btn ghost" onClick={handleCopyLastWeek}>
            {t('planning.copyLastWeek')}
          </button>
          <button className="pl-btn" onClick={() => handleAddAssignment('weeks', selectedWeek)} disabled={leafTasks.length === 0}>
            {t('planning.addAssignment')}
          </button>
        </div>
      </div>

      {weekAssignments.length === 0 ? (
        <div className="pl-empty">
          {t('planning.weekEmpty')}
          <div className="pl-empty-sub">{t('planning.weekEmptySub')}</div>
        </div>
      ) : (
        <div className="pl-table-wrap">
          <table className="pl-table pl-week-table">
            <thead>
              <tr>
                <th>{t('planning.task')}</th>
                <th>{t('planning.crew')}</th>
                <th>{t('planning.note')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {weekAssignments.map((a) => (
                <tr key={a.id}>
                  <td className="pl-task-cell">
                    <select
                      className="pl-select"
                      value={a.taskId}
                      onChange={(e) => handleAssignChange('weeks', selectedWeek, a, { taskId: e.target.value })}
                    >
                      {renderTaskOptions(a.taskId, leafTasks)}
                    </select>
                  </td>
                  <td className="pl-who-cell">
                    <WhoPicker
                      value={a.who}
                      onChange={(who) => handleAssignChange('weeks', selectedWeek, a, { who })}
                      registries={registries}
                    />
                  </td>
                  <td>
                    <input
                      className="pl-input"
                      value={a.note || ''}
                      onChange={(e) => handleAssignChange('weeks', selectedWeek, a, { note: e.target.value })}
                      placeholder={t('planning.noteOptional')}
                    />
                  </td>
                  <td>
                    <button
                      className="pl-icon-btn danger"
                      onClick={() => handleAssignDelete('weeks', selectedWeek, a.id)}
                      title={t('planning.deleteAssignment')}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const hasYesterdayPlan = getDayPlans(plans, addDaysDate(selectedDate, -1)).length > 0;

  const dailyView = (
    <div className="pl-view">
      <div className="pl-view-head">
        <div className="pl-view-hint">
          {t('planning.dayHint')}
        </div>
        <div className="pl-head-actions">
          <button className="pl-btn ghost" onClick={handleSameAsYesterday}>
            {t('planning.sameAsYesterday')}
          </button>
          <button className="pl-btn" onClick={() => handleAddAssignment('days', selectedDate)} disabled={leafTasks.length === 0}>
            {t('planning.addAssignment')}
          </button>
        </div>
      </div>

      <div className="pl-totals">
        <div className={`kpi-compact-card ${ppcTone ? `pl-tone-${ppcTone}` : ''}`}>
          <span className="kpi-compact-label">{t('planning.kpiPpc')}</span>
          <span className="kpi-compact-value">{ppc == null ? '—' : `${Math.round(ppc * 100)}%`}</span>
        </div>
        <div className="kpi-compact-card">
          <span className="kpi-compact-label">{t('planning.kpiDoneAssignments')}</span>
          <span className="kpi-compact-value">{`${dayDoneCount} / ${dayAssignments.length}`}</span>
        </div>
        <div className="kpi-compact-card">
          <span className="kpi-compact-label">{t('planning.kpiApprovedToday')}</span>
          <span className="kpi-compact-value">{dayApprovedOrdersCount}</span>
        </div>
      </div>

      {dayAssignments.length === 0 ? (
        <div className="pl-empty">
          {t('planning.dayEmpty')}
          <div className="pl-empty-sub">
            {hasYesterdayPlan ? t('planning.dayEmptySubYesterday') : t('planning.dayEmptySubNoYesterday')}
          </div>
        </div>
      ) : (
        <div className="pl-cards">{dayAssignments.map(renderDayCard)}</div>
      )}
    </div>
  );

  /* ── shell ── */
  return (
    <div className="planning-screen" dir={dir}>
      <div className="pl-header">
        <h2 className="pl-title">{t('planning.title')}</h2>
        <p className="pl-subtitle">
          {t('planning.subtitle')}
        </p>
      </div>

      <div className="pl-toolbar">
        <div className="pl-view-switch">
          <button type="button" className={view === 'month' ? 'on' : ''} onClick={() => setView('month')}>
            {t('planning.viewMonth')}
          </button>
          <button type="button" className={view === 'week' ? 'on' : ''} onClick={() => setView('week')}>
            {t('planning.viewWeek')}
          </button>
          <button type="button" className={view === 'day' ? 'on' : ''} onClick={() => setView('day')}>
            {t('planning.viewDay')}
          </button>
        </div>
        <div className="pl-period-nav">
          <button type="button" className="apple-btn secondary pl-nav-btn" onClick={() => stepPeriod(-1)} title={prevTitle}>
            ◀
          </button>
          <div className="pl-period-label">
            <span className="pl-period-main">{periodMain}</span>
            {periodSub && <span className="pl-period-sub">{periodSub}</span>}
          </div>
          <button type="button" className="apple-btn secondary pl-nav-btn" onClick={() => stepPeriod(1)} title={nextTitle}>
            ▶
          </button>
          {view === 'day' && (
            <button
              type="button"
              className="apple-btn secondary"
              onClick={() => setSelectedDate(todayStr())}
              title={t('planning.goToToday')}
            >
              {t('common.today')}
            </button>
          )}
        </div>
      </div>

      {view === 'month' ? monthlyView : view === 'week' ? weeklyView : dailyView}
    </div>
  );
}

export default PlanningScreen;
