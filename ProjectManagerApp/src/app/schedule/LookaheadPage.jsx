import { ChevronLeft, ChevronRight, ClipboardList, Copy, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import {
  assignmentDone,
  dayCompletion,
  dayOrdersByTask,
  monthActuals,
  monthSummary,
  planSections,
  rateTone,
  targetRate,
} from '../../state/lookaheadModel.js';
import { useProject } from '../../state/projectContext.js';
import {
  addDaysDate,
  addMonthsKey,
  addWeeksKey,
  cloneDayPlan,
  cloneWeekPlan,
  createPlanId,
  deleteAssignment,
  deleteTarget,
  getDayPlans,
  getMonthPlans,
  getWeekPlans,
  isoWeekKey,
  isoWeekRange,
  loadPlans,
  monthKey,
  savePlans,
  todayStr,
  upsertAssignment,
  upsertTarget,
} from '../../utils/PlanningStore.js';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  NumberInput,
  ProgressBar,
  Segmented,
  StatusBadge,
  TaskPicker,
  WhoPicker,
  useToast,
} from '../../ui/index.js';
import { formatDay } from '../record/orderMeta.js';
import { Page } from '../Page.jsx';
import s from './Lookahead.module.css';

const WHO_KINDS = ['count', 'team', 'workers'];
const TONE_CLASS = { success: s.toneSuccess, warning: s.toneWarning, danger: s.toneDanger, neutral: '' };

const pct = (rate) => (rate == null ? '—' : `${Math.round(rate * 100)}%`);
const num = (n) => (Number(n) ? formatNumber(n) : '—');

const locale = (lang) => (lang === 'ar' ? 'ar-IQ-u-nu-latn' : 'en-GB');
const utcDate = (ymd) => new Date(`${ymd}T00:00:00Z`);
const monthLabel = (mKey, lang) =>
  new Intl.DateTimeFormat(locale(lang), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(utcDate(`${mKey}-01`));
const weekdayLabel = (ymd, lang) => new Intl.DateTimeFormat(locale(lang), { weekday: 'long', timeZone: 'UTC' }).format(utcDate(ymd));

/** One KPI tile in the strip. */
function Kpi({ label, value, tone = 'neutral' }) {
  return (
    <div className={s.kpi}>
      <dt>{label}</dt>
      <dd className={TONE_CLASS[tone]}>{value}</dd>
    </div>
  );
}

/**
 * /schedule/lookahead — the rolling plan: monthly targets per section,
 * weekly crews, and the daily plan measured by its completion rate (PPC)
 * against that day's approved orders. Plans live in PlanningStore.
 */
export default function LookaheadPage() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const { tasks, orders, registries } = useProject();
  const [plans, setPlans] = useState(loadPlans);
  const [view, setView] = useState('month');
  const today = todayStr();
  const [month, setMonth] = useState(() => monthKey(today));
  const [week, setWeek] = useState(() => isoWeekKey(today));
  const [date, setDate] = useState(today);
  const [replace, setReplace] = useState(null); // 'week' | 'day' awaiting confirmation

  useEffect(() => {
    savePlans(plans);
  }, [plans]);

  const leaves = useMemo(() => tasks.filter((x) => !x.isGroup), [tasks]);
  const taskById = useMemo(() => new Map(tasks.map((x) => [x.id, x])), [tasks]);
  const sections = useMemo(() => planSections(tasks), [tasks]);

  const targets = getMonthPlans(plans, month);
  const weekRows = getWeekPlans(plans, week);
  const dayRows = getDayPlans(plans, date);
  const actuals = useMemo(() => monthActuals(orders, month), [orders, month]);
  const summary = monthSummary(targets, actuals);
  const byTask = useMemo(() => dayOrdersByTask(orders, date), [orders, date]);
  const completion = dayCompletion(dayRows, byTask);

  /* ── period ── */
  const step = (delta) => {
    if (view === 'month') setMonth(addMonthsKey(month, delta));
    else if (view === 'week') setWeek(addWeeksKey(week, delta));
    else setDate(addDaysDate(date, delta));
  };
  const goToday = () => {
    setMonth(monthKey(today));
    setWeek(isoWeekKey(today));
    setDate(today);
  };
  let periodMain;
  let periodSub = '';
  if (view === 'month') periodMain = monthLabel(month, lang);
  else if (view === 'week') {
    const [y, n] = week.split('-W');
    const range = isoWeekRange(week);
    periodMain = t('planning.weekLabel', { week: Number(n), year: y });
    periodSub = range ? t('schedule.lkWeekRange', { start: formatDay(range.start), end: formatDay(range.end) }) : '';
  } else {
    periodMain = `${weekdayLabel(date, lang)} ${formatDay(date)}`;
    periodSub = date === today ? t('common.today') : '';
  }
  const isCurrent = view === 'month' ? month === monthKey(today) : view === 'week' ? week === isoWeekKey(today) : date === today;
  const prevLabel = t(view === 'month' ? 'planning.prevMonth' : view === 'week' ? 'planning.prevWeek' : 'planning.prevDay');
  const nextLabel = t(view === 'month' ? 'planning.nextMonth' : view === 'week' ? 'planning.nextWeek' : 'planning.nextDay');

  /* ── changes ── */
  // A new row starts without an item (picked next); sectionId keeps it under
  // its section until then. Rows still without an item are dropped on reload.
  const addTarget = (section, sectionLeaves) =>
    setPlans((p) =>
      upsertTarget(p, month, { id: createPlanId(), taskId: sectionLeaves.length === 1 ? sectionLeaves[0].id : '', sectionId: section.id, quantity: '', note: '' })
    );
  const changeTarget = (target, patch) => setPlans((p) => upsertTarget(p, month, { ...target, ...patch }));
  const scopeKey = (scope) => (scope === 'weeks' ? week : date);
  const addAssignment = (scope) =>
    setPlans((p) => upsertAssignment(p, scope, scopeKey(scope), { id: createPlanId(), taskId: '', who: { kind: 'count', count: 0 }, note: '' }));
  const changeAssignment = (scope, a, patch) => setPlans((p) => upsertAssignment(p, scope, scopeKey(scope), { ...a, ...patch }));
  const removeAssignment = (scope, id) => setPlans((p) => deleteAssignment(p, scope, scopeKey(scope), id));

  const copyPrevious = (kind) => {
    const source = kind === 'week' ? getWeekPlans(plans, addWeeksKey(week, -1)) : getDayPlans(plans, addDaysDate(date, -1));
    if (!source.length) {
      toast({ title: t(kind === 'week' ? 'planning.alertNoLastWeek' : 'planning.alertNoYesterday') });
      return;
    }
    if ((kind === 'week' ? weekRows : dayRows).length) setReplace(kind);
    else doCopy(kind);
  };
  const doCopy = (kind) =>
    setPlans((p) => (kind === 'week' ? cloneWeekPlan(p, addWeeksKey(week, -1), week) : cloneDayPlan(p, addDaysDate(date, -1), date)));

  /* ── pieces ── */
  const unitOf = (taskId) => taskById.get(taskId)?.unit || '';

  const targetRow = (target, pickFrom) => {
    const rate = targetRate(target, actuals);
    const tone = rateTone(rate);
    return (
      <li key={target.id} className={s.row}>
        <Field label={t('planning.task')} className={s.taskCell}>
          <TaskPicker tasks={pickFrom} orders={orders} value={target.taskId} onChange={(taskId) => changeTarget(target, { taskId })} placeholder={t('schedule.pickItem')} />
        </Field>
        <Field label={t('planning.targetQty')} className={s.qtyCell}>
          <NumberInput min="0" value={target.quantity ?? ''} unit={unitOf(target.taskId)} onChange={(e) => changeTarget(target, { quantity: e.target.value === '' ? '' : Number(e.target.value) })} />
        </Field>
        <div className={s.rateCell} title={t('planning.actualTitle')}>
          <span className={s.cellLabel}>{t('planning.executedThisMonth')}</span>
          <span className={s.rateLine}>
            <span className={s.rateNum}>{num(actuals.get(target.taskId))}</span>
            <span className={TONE_CLASS[tone]}>{pct(rate)}</span>
          </span>
          <ProgressBar value={Math.min(100, (rate || 0) * 100)} tone={tone === 'neutral' ? 'accent' : tone} size="sm" label={t('planning.achievement')} />
        </div>
        <Field label={t('planning.note')} optional className={s.noteCell}>
          <Input value={target.note || ''} onChange={(e) => changeTarget(target, { note: e.target.value })} />
        </Field>
        <IconButton icon={Trash2} label={t('planning.deleteTarget')} variant="ghost" className={s.removeCell} onClick={() => setPlans((p) => deleteTarget(p, month, target.id))} />
      </li>
    );
  };

  const assignmentRow = (scope, a) => {
    const dayOrders = scope === 'days' && a.taskId ? byTask.get(a.taskId) || [] : null;
    const done = scope === 'days' && assignmentDone(a, byTask);
    return (
      <li key={a.id} className={s.row}>
        <Field label={t('planning.task')} className={s.taskCell}>
          <TaskPicker tasks={leaves} orders={orders} value={a.taskId} onChange={(taskId) => changeAssignment(scope, a, { taskId })} placeholder={t('schedule.pickItem')} />
        </Field>
        <Field label={t('planning.crew')} className={s.whoCell}>
          <WhoPicker value={a.who} onChange={(who) => changeAssignment(scope, a, { who })} registries={registries} kinds={WHO_KINDS} label={t('planning.crew')} />
        </Field>
        <Field label={t('planning.note')} optional className={s.noteCell}>
          <Input value={a.note || ''} onChange={(e) => changeAssignment(scope, a, { note: e.target.value })} />
        </Field>
        <IconButton icon={Trash2} label={t('planning.deleteAssignment')} variant="ghost" className={s.removeCell} onClick={() => removeAssignment(scope, a.id)} />
        {dayOrders && (
          <div className={s.dayStatus}>
            <StatusBadge tone={done ? 'success' : 'neutral'}>{done ? t('schedule.planDone') : t('schedule.planPending')}</StatusBadge>
            <span className={s.muted}>
              {dayOrders.length === 0
                ? t('planning.noDayOrders')
                : `${t('schedule.dayOrders')}: ${dayOrders
                    .map((o) => `${num(o.quantity)} ${unitOf(o.taskId)} · ${o.status === 'approved' ? t('common.approved') : t('common.recorded')}`)
                    .join('، ')}`}
            </span>
            {!done && (
              <Button size="sm" icon={ClipboardList} onClick={() => navigate('/record', { state: { taskId: a.taskId } })}>
                {t('schedule.recordWork')}
              </Button>
            )}
          </div>
        )}
      </li>
    );
  };

  const sectionIds = new Set(sections.flatMap((x) => x.leaves.map((l) => l.id)));
  const otherTargets = targets.filter((x) => !sectionIds.has(x.taskId) && !(x.taskId === '' && x.sectionId));
  const monthText = monthLabel(month, lang);

  return (
    <Page area="schedule">
      <div className={s.toolbar}>
        <Segmented
          label={t('schedule.lkPeriod')}
          value={view}
          onChange={setView}
          options={[
            { value: 'month', label: t('schedule.lkMonth') },
            { value: 'week', label: t('schedule.lkWeek') },
            { value: 'day', label: t('schedule.lkDay') },
          ]}
        />
        <div className={s.period}>
          <IconButton icon={ChevronLeft} label={prevLabel} variant="secondary" className="ui-flip-rtl" onClick={() => step(-1)} />
          <div className={s.periodLabel} aria-live="polite">
            <strong>{periodMain}</strong>
            {periodSub && <span className={s.muted}>{periodSub}</span>}
          </div>
          <IconButton icon={ChevronRight} label={nextLabel} variant="secondary" className="ui-flip-rtl" onClick={() => step(1)} />
          {!isCurrent && (
            <Button size="sm" onClick={goToday} title={t('planning.goToToday')}>
              {t('common.today')}
            </Button>
          )}
        </div>
      </div>

      {view === 'month' && (
        <>
          <p className={s.hint}>{t('planning.monthHint')}</p>
          <dl className={s.kpis}>
            <Kpi label={t('planning.kpiMonthTargets')} value={summary.count} />
            <Kpi label={t('planning.kpiTargetSum')} value={num(summary.target)} />
            <Kpi label={t('planning.kpiActualExecuted')} value={num(summary.actual)} />
            <Kpi label={t('planning.kpiAchievementRate')} value={pct(summary.rate)} tone={rateTone(summary.rate)} />
          </dl>
          {sections.length === 0 ? (
            <EmptyState title={t('planning.emptyNoTasks')} />
          ) : (
            sections.map(({ section, leaves: sectionLeaves }) => {
              const rows = targets.filter((x) => sectionLeaves.some((l) => l.id === x.taskId) || (x.taskId === '' && x.sectionId === section.id));
              return (
                <Card
                  key={section.id}
                  title={`${section.wbs} ${section.name || t('planning.unnamedSection')}`}
                  titleAs="h3"
                  actions={
                    <Button size="sm" icon={Plus} onClick={() => addTarget(section, sectionLeaves)}>
                      {t('schedule.addTarget')}
                    </Button>
                  }
                >
                  {rows.length === 0 ? (
                    <p className={s.muted}>{t('schedule.noTargetsYet', { month: monthText })}</p>
                  ) : (
                    <ul className={s.rows}>{rows.map((x) => targetRow(x, sectionLeaves))}</ul>
                  )}
                </Card>
              );
            })
          )}
          {otherTargets.length > 0 && (
            <Card title={t('planning.otherTasks')} titleAs="h3">
              <ul className={s.rows}>{otherTargets.map((x) => targetRow(x, leaves))}</ul>
            </Card>
          )}
        </>
      )}

      {view === 'week' && (
        <>
          <p className={s.hint}>{t('planning.weekHint')}</p>
          <div className={s.actions}>
            <Button icon={Copy} onClick={() => copyPrevious('week')}>
              {t('schedule.copyLastWeek')}
            </Button>
            <Button variant="primary" icon={Plus} disabled={leaves.length === 0} onClick={() => addAssignment('weeks')}>
              {t('schedule.addAssignment')}
            </Button>
          </div>
          {weekRows.length === 0 ? (
            <EmptyState title={t('planning.weekEmpty')} body={t('planning.weekEmptySub')} />
          ) : (
            <Card padding="sm">
              <ul className={s.rows}>{weekRows.map((a) => assignmentRow('weeks', a))}</ul>
            </Card>
          )}
        </>
      )}

      {view === 'day' && (
        <>
          <p className={s.hint}>{t('planning.dayHint')}</p>
          <dl className={s.kpis}>
            <Kpi label={t('planning.kpiPpc')} value={pct(completion.rate)} tone={rateTone(completion.rate, 0.8)} />
            <Kpi label={t('planning.kpiDoneAssignments')} value={`${completion.done} / ${completion.total}`} />
            <Kpi label={t('planning.kpiApprovedToday')} value={completion.approvedOrders} />
          </dl>
          <div className={s.actions}>
            <Button icon={Copy} onClick={() => copyPrevious('day')}>
              {t('schedule.sameAsYesterday')}
            </Button>
            <Button variant="primary" icon={Plus} disabled={leaves.length === 0} onClick={() => addAssignment('days')}>
              {t('schedule.addAssignment')}
            </Button>
          </div>
          {dayRows.length === 0 ? (
            <EmptyState
              title={t('planning.dayEmpty')}
              body={getDayPlans(plans, addDaysDate(date, -1)).length ? t('planning.dayEmptySubYesterday') : t('planning.dayEmptySubNoYesterday')}
            />
          ) : (
            <Card padding="sm">
              <ul className={s.rows}>{dayRows.map((a) => assignmentRow('days', a))}</ul>
            </Card>
          )}
        </>
      )}

      <ConfirmDialog
        open={replace !== null}
        onOpenChange={(open) => !open && setReplace(null)}
        title={t(replace === 'week' ? 'schedule.replaceWeekTitle' : 'schedule.replaceDayTitle')}
        message={t(replace === 'week' ? 'planning.confirmReplaceWeek' : 'planning.confirmReplaceDay')}
        confirmLabel={t('schedule.replace')}
        tone="danger"
        onConfirm={() => doCopy(replace)}
      />
    </Page>
  );
}
