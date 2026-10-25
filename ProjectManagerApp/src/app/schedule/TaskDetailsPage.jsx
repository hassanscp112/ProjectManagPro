import { ArrowLeft, ArrowRight, Eye, Lock, Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { useProject } from '../../state/projectContext.js';
import { columnSums, directChildren, spanDays } from '../../state/taskDetailsModel.js';
import { Button, Segmented, StatusBadge } from '../../ui/index.js';
import { formatDay } from '../record/orderMeta.js';
import { Page } from '../Page.jsx';
import TaskDetailsEdit from './TaskDetailsEdit.jsx';
import TaskDetailsRead from './TaskDetailsRead.jsx';
import s from './TaskDetails.module.css';

/**
 * /schedule/task/:taskId/details — the full page behind the task panel's
 * "Full details": a read-first report of one item (quantities by type,
 * elements map, orders, money, evidence, sub-items) and an Edit view for
 * sub-items, quantity types with their BOQ links, and elements.
 * Rules: src/state/taskDetailsModel.js.
 */
export default function TaskDetailsPage() {
  const { taskId } = useParams();
  const id = decodeURIComponent(taskId);
  const navigate = useNavigate();
  const { t, dir } = useI18n();
  const { tasks, engineResult, projectMeta } = useProject();
  const [mode, setMode] = useState('read');
  const [shownId, setShownId] = useState(id);
  // Another item → back to the report view.
  if (shownId !== id) {
    setShownId(id);
    setMode('read');
  }

  const task = tasks.find((x) => x.id === id) || null;
  const computedById = useMemo(() => new Map(engineResult.tasks.map((x) => [x.id, x])), [engineResult.tasks]);
  const columns = useMemo(() => (Array.isArray(task?.elementColumns) ? task.elementColumns : []), [task]);
  const elements = useMemo(() => (Array.isArray(task?.elements) ? task.elements : []), [task]);
  const sums = useMemo(() => columnSums(columns, elements), [columns, elements]);
  const children = useMemo(() => directChildren(tasks, task), [tasks, task]);
  if (!task) return <Navigate to="/schedule" replace />;

  const computed = computedById.get(task.id) || task;
  const isSigned = Boolean(projectMeta.baseline);
  const days = spanDays(computed.startDate, computed.endDate);
  const linked = columns.filter((c) => c.linkedTaskId).length;
  const props = { task, computed, columns, elements, sums, children, computedById };
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  return (
    <Page area="schedule">
      <div className={s.head}>
        <Button icon={BackIcon} onClick={() => navigate(`/schedule/task/${encodeURIComponent(task.id)}`)}>
          {t('details.back')}
        </Button>
        <div className={s.title}>
          <span className={s.wbs}>
            <span className="ui-ltr">{task.wbs}</span>
          </span>
          <h2>{task.name || t('taskDetails.untitledItem')}</h2>
          <div className={s.badges}>
            <StatusBadge icon={false}>{task.isGroup ? t('taskDetails.groupBadge') : t('taskDetails.workItemBadge')}</StatusBadge>
            {isSigned && (
              <StatusBadge tone="accent" icon={false}>
                <Lock size={12} aria-hidden="true" /> {t('taskDetails.signedContract')}
              </StatusBadge>
            )}
            {elements.length > 0 && <StatusBadge icon={false}>{t(elements.length === 1 ? 'taskDetails.elementOne' : 'taskDetails.elementsMany', { n: elements.length })}</StatusBadge>}
            {linked > 0 && <StatusBadge tone="accent" icon={false}>{t(linked === 1 ? 'taskDetails.boqOne' : 'taskDetails.boqMany', { n: linked })}</StatusBadge>}
            <span className={s.muted}>
              {formatDay(computed.startDate)} – {formatDay(computed.endDate)}
              {days != null && ` · ${t(days === 1 ? 'taskDetails.dayOne' : 'taskDetails.daysMany', { n: formatNumber(days) })}`}
            </span>
          </div>
        </div>
        <Segmented
          label={t('taskDetails.viewModeAria')}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'read', label: t('taskDetails.view'), icon: Eye },
            { value: 'edit', label: t('common.edit'), icon: Pencil },
          ]}
        />
      </div>
      {mode === 'edit' && isSigned && <p className={s.signedNote}>{t('taskDetails.editTitleSigned')}</p>}

      {mode === 'read' ? <TaskDetailsRead {...props} /> : <TaskDetailsEdit {...props} />}
    </Page>
  );
}
