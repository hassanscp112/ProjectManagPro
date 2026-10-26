import {
  CalendarDays,
  ChevronsDownUp,
  ChevronsUpDown,
  CircleCheck,
  Download,
  Ellipsis,
  Lock,
  Pencil,
  Play,
  RotateCcw,
  ScrollText,
  Undo2,
  Upload,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useMatch, useNavigate } from 'react-router';
import { compactCurrency } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { useProject } from '../../state/projectContext.js';
import { timelineRange, visibleRows } from '../../state/scheduleModel.js';
import { todayStr } from '../../utils/OrderEngine.js';
import { Button, EmptyState, IconButton, Input, Menu, Segmented, StatusBadge, useToast } from '../../ui/index.js';
import { ltr } from '../bidi.js';
import { Page } from '../Page.jsx';
import Gantt from './Gantt.jsx';
import { SignOffDialog, VariationDialog } from './LifecycleDialogs.jsx';
import { useBackupRestore } from '../useBackupRestore.jsx';
import { useCan } from '../useCan.js';
import TaskPanel from './TaskPanel.jsx';
import s from './Schedule.module.css';

/**
 * /schedule (and /schedule/task/:taskId with the side panel open):
 * KPI strip, lifecycle + view toolbar, the Gantt, and the task panel.
 */
export default function SchedulePage() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const match = useMatch('/schedule/task/:taskId');
  const panelTaskId = match ? decodeURIComponent(match.params.taskId) : null;
  const { tasks, engineResult, projectMeta, projectStart, ganttView, setGanttView, setStatus, updateTask, addMainTask, addSubTask, requestDeleteTask, undo, canUndo } = useProject();
  const can = useCan();
  const canEdit = can('plan.edit');
  const canSign = can('plan.signOff');
  // Editing needs plan.edit (an edit mode left on from elsewhere is ignored).
  const view = canEdit ? ganttView : { ...ganttView, isEditMode: false };
  const setView = useCallback((changes) => setGanttView((v) => ({ ...v, ...changes })), [setGanttView]);
  const location = useLocation();

  // A project just created ("start planning") opens with editing on.
  useEffect(() => {
    if (!location.state?.startPlanning) return;
    setView({ isEditMode: true });
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, setView, navigate]);
  const [signOffOpen, setSignOffOpen] = useState(false);
  const [voOpen, setVoOpen] = useState(false);
  const backupRestore = useBackupRestore();
  const todayRef = useRef(null);
  const today = todayStr();
  const status = projectMeta.status || 'draft';
  const isSigned = Boolean(projectMeta.baseline);

  const collapsed = useMemo(() => new Set(view.collapsed || []), [view.collapsed]);
  const rows = useMemo(
    () => visibleRows(engineResult.tasks, { collapsed, criticalOnly: view.criticalOnly, query: view.query || '' }),
    [engineResult.tasks, collapsed, view.criticalOnly, view.query]
  );
  const range = useMemo(() => timelineRange(engineResult.tasks, projectStart, today), [engineResult.tasks, projectStart, today]);
  const taskById = useMemo(() => new Map(engineResult.tasks.map((x) => [x.id, x])), [engineResult.tasks]);

  // The panel's item was deleted (here, in another tab, or by a restore): drop the stale URL.
  const panelMissing = panelTaskId !== null && !tasks.some((x) => x.id === panelTaskId);
  useEffect(() => {
    if (panelMissing) navigate('/schedule', { replace: true });
  }, [panelMissing, navigate]);
  const dependencyOptions = useMemo(() => tasks.filter((x) => !x.isGroup), [tasks]);
  const groupIds = useMemo(() => tasks.filter((x) => tasks.some((y) => y.wbs && x.wbs && y.wbs.startsWith(`${x.wbs}.`))).map((x) => x.id), [tasks]);

  const scrollToToday = (behavior = 'smooth') => todayRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior });

  // Land on today when the page opens and whenever the zoom changes.
  useEffect(() => {
    todayRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [view.zoom]);

  const toggle = (task) => {
    const next = new Set(collapsed);
    if (next.has(task.id)) next.delete(task.id);
    else next.add(task.id);
    setView({ collapsed: [...next] });
  };

  const changeStatus = (next) => {
    setStatus(next);
    toast({ title: t('schedule.statusToast') });
  };

  const deviation = Number(engineResult.projectDeviation) || 0;
  const kpis = [
    ['app.kpi.totalCost', compactCurrency(engineResult.projectTotalCost, lang)],
    ['app.kpi.progress', `${(Number(engineResult.projectTotalProgress) || 0).toFixed(2)}%`],
    ['app.kpi.planned', `${(Number(engineResult.projectPlannedProgress) || 0).toFixed(2)}%`],
    // Signed number: isolated left-to-right so '-77.89%' doesn't flip in Arabic.
    ['app.kpi.deviation', ltr(`${deviation > 0 ? '+' : ''}${deviation.toFixed(2)}%`), deviation < 0 ? s.toneDanger : s.toneSuccess],
    ['app.kpi.duration', `${engineResult.projectDuration} ${t('app.kpi.days')}`],
    ['app.kpi.activeItems', engineResult.tasks.filter((x) => !x.isGroup).length],
    ['app.kpi.warnings', engineResult.warnings.length, engineResult.warnings.length ? s.toneDanger : undefined],
  ];

  return (
    <Page area="schedule" fill>
      <dl className={s.kpis}>
        {kpis.map(([key, value, tone]) => (
          <div key={key} className={s.kpi}>
            <dt>{t(key)}</dt>
            <dd className={tone}>{value}</dd>
          </div>
        ))}
      </dl>

      <div className={s.toolbar}>
        <div className={s.group}>
          {status === 'draft' ? (
            canSign && (
              <Button variant="primary" icon={Lock} onClick={() => setSignOffOpen(true)}>
                {t('schedule.signOff')}
              </Button>
            )
          ) : (
            <>
              {canSign && status === 'signed' && (
                <Button variant="primary" icon={Play} onClick={() => changeStatus('executing')}>
                  {t('schedule.startExecution')}
                </Button>
              )}
              {canSign && status === 'executing' && (
                <Button icon={CircleCheck} onClick={() => changeStatus('completed')}>
                  {t('schedule.complete')}
                </Button>
              )}
              {canSign && (
                <Button icon={RotateCcw} title={t('app.toolbar.reBaselineTitle')} onClick={() => setSignOffOpen(true)}>
                  {t('schedule.reBaseline')}
                </Button>
              )}
              {can('vo.draft') && (
                <Button icon={ScrollText} onClick={() => setVoOpen(true)}>
                  {t('schedule.variations')}
                  <StatusBadge>{(projectMeta.variations || []).length}</StatusBadge>
                </Button>
              )}
            </>
          )}
        </div>
        <div className={s.spacer} />
        <div className={s.group}>
          {view.isEditMode && canUndo && (
            <Button icon={Undo2} title={t('app.toolbar.undoTitle')} onClick={undo}>
              {t('schedule.undo')}
            </Button>
          )}
          {canEdit && (
            <Button variant={view.isEditMode ? 'primary' : 'secondary'} icon={Pencil} aria-pressed={view.isEditMode} onClick={() => setView({ isEditMode: !view.isEditMode })}>
              {view.isEditMode ? t('schedule.doneEditing') : t('schedule.edit')}
            </Button>
          )}
          <Menu
            trigger={<IconButton icon={Ellipsis} label={t('ui.more')} variant="secondary" />}
            items={[
              { label: t('schedule.backup'), icon: Download, onSelect: backupRestore.backup },
              { label: t('schedule.restore'), icon: Upload, onSelect: backupRestore.restore },
            ]}
          />
        </div>
      </div>

      <div className={s.toolbar}>
        <Segmented
          label={t('schedule.zoom')}
          value={view.zoom}
          onChange={(zoom) => setView({ zoom })}
          options={[
            { value: 'week', label: t('schedule.zoomWeek') },
            { value: 'month', label: t('schedule.zoomMonth') },
            { value: 'quarter', label: t('schedule.zoomQuarter') },
          ]}
        />
        <Segmented
          label={t('schedule.columns')}
          value={view.cols}
          onChange={(cols) => setView({ cols })}
          options={[
            { value: 'schedule', label: t('schedule.colsSchedule') },
            { value: 'quantities', label: t('schedule.colsQuantities') },
          ]}
        />
        <Button size="sm" variant={view.criticalOnly ? 'outline' : 'secondary'} aria-pressed={view.criticalOnly} onClick={() => setView({ criticalOnly: !view.criticalOnly })}>
          {t('schedule.criticalOnly')}
        </Button>
        <Input type="search" className={s.search} aria-label={t('schedule.searchItems')} placeholder={t('schedule.searchItems')} value={view.query || ''} onChange={(e) => setView({ query: e.target.value })} />
        <div className={s.spacer} />
        <Button size="sm" icon={CalendarDays} onClick={() => scrollToToday()}>
          {t('schedule.today')}
        </Button>
        <IconButton icon={ChevronsUpDown} size="sm" variant="secondary" label={t('schedule.expandAll')} onClick={() => setView({ collapsed: [] })} />
        <IconButton icon={ChevronsDownUp} size="sm" variant="secondary" label={t('schedule.collapseAll')} onClick={() => setView({ collapsed: groupIds })} />
      </div>

      {rows.length === 0 ? (
        <EmptyState title={t('schedule.noRows')} body={t('schedule.noRowsBody')} />
      ) : (
        <Gantt
          ref={todayRef}
          rows={rows}
          range={range}
          zoom={view.zoom}
          cols={view.cols}
          today={today}
          editMode={view.isEditMode}
          isSigned={isSigned}
          selectedId={panelTaskId}
          dependencyOptions={dependencyOptions}
          taskById={taskById}
          onSelect={(task) => navigate(`/schedule/task/${encodeURIComponent(task.id)}`)}
          onToggle={toggle}
          onUpdate={(id, changes) => {
            const raw = tasks.find((x) => x.id === id);
            if (raw) updateTask({ ...raw, ...changes });
          }}
          onAddSub={addSubTask}
          onDelete={requestDeleteTask}
          onAddMain={addMainTask}
        />
      )}

      {panelTaskId && <TaskPanel key={panelTaskId} taskId={panelTaskId} onClose={() => navigate('/schedule')} />}
      <SignOffDialog open={signOffOpen} onOpenChange={setSignOffOpen} />
      <VariationDialog open={voOpen} onOpenChange={setVoOpen} />
      {backupRestore.element}
    </Page>
  );
}
