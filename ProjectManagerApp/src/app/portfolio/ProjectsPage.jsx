import { CalendarRange, Ellipsis, FolderOpen, FolderPlus, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { compactCurrency, formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { cleanProjectDraft, sortProjects, summarizeProject, validateProjectDraft } from '../../state/portfolioModel.js';
import { STATUS_KEYS } from '../../state/projectModel.js';
import { exportAppData } from '../../utils/DataIO.js';
import { deleteProjectFiles } from '../../utils/FileDB.js';
import { currentProject, deleteProject, loadProjects, openProject, updateProject } from '../../utils/Projects.js';
import { Button, ConfirmDialog, Dialog, EmptyState, IconButton, Menu, ProgressBar, StatusBadge, useToast } from '../../ui/index.js';
import { formatDay } from '../record/orderMeta.js';
import { Page } from '../Page.jsx';
import { ProjectFields } from './ProjectFields.jsx';
import s from './Portfolio.module.css';

const STATUS_TONE = { draft: 'neutral', signed: 'accent', executing: 'success', completed: 'success' };
const pct1 = (n) => `${(Number(n) || 0).toFixed(1)}%`;

/** One project: name, contract, status, value, progress, dates; Open and a ⋯ menu. */
function ProjectCard({ project, summary, isOpen, onOpen, onEdit, onDelete }) {
  const { t, lang } = useI18n();
  return (
    <li className={s.card}>
      <div className={s.cardHead}>
        <span className={s.logo} aria-hidden="true">
          {project.name.trim().charAt(0) || '؟'}
        </span>
        <div className={s.cardTitle}>
          <h2 className={s.name}>{project.name}</h2>
          {project.contract && <span className={s.muted}>{project.contract}</span>}
        </div>
        <Menu
          trigger={<IconButton icon={Ellipsis} label={t('projects.actions', { name: project.name })} size="sm" variant="ghost" />}
          items={[
            { label: t('projects.editDetails'), icon: Pencil, onSelect: onEdit },
            { label: t('projects.delete'), icon: Trash2, tone: 'danger', onSelect: onDelete },
          ]}
        />
      </div>

      <div className={s.badges}>
        <StatusBadge tone={STATUS_TONE[summary.status] || 'neutral'} icon="dot">
          {STATUS_KEYS[summary.status] ? t(STATUS_KEYS[summary.status]) : summary.status}
        </StatusBadge>
        {isOpen && <StatusBadge tone="accent">{t('projects.openNow')}</StatusBadge>}
      </div>

      <dl className={s.figures}>
        <div>
          <dt>{t('projects.value')}</dt>
          <dd>{compactCurrency(summary.totalCost, lang)}</dd>
        </div>
        <div>
          <dt>{t('projects.items')}</dt>
          <dd>{formatNumber(summary.itemCount)}</dd>
        </div>
        <div>
          <dt>{t('projects.orders')}</dt>
          <dd>{formatNumber(summary.orderCount)}</dd>
        </div>
      </dl>

      <div className={s.progress}>
        <div className={s.progressText}>
          <span>{t('home.progressActual')}</span>
          <span className="ui-ltr">{pct1(summary.progress)}</span>
        </div>
        <ProgressBar value={summary.progress} marker={summary.plannedProgress} label={t('home.progressActual')} size="sm" />
      </div>

      <p className={s.meta}>
        <span>
          <CalendarRange size={14} aria-hidden="true" />
          <span className="ui-ltr">
            {formatDay(summary.startDate)}
            {summary.endDate ? ` → ${formatDay(summary.endDate)}` : ''}
          </span>
        </span>
        {project.location && (
          <span>
            <MapPin size={14} aria-hidden="true" />
            {project.location}
          </span>
        )}
      </p>

      <Button variant="primary" icon={FolderOpen} block onClick={onOpen}>
        {t('projects.open')}
      </Button>
    </li>
  );
}

/**
 * /projects — the level above every project: all projects with their
 * status and progress, open one, create one, edit or delete one.
 * Storage: utils/Projects (+ each project's own stores for the figures).
 */
export default function ProjectsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const [projects, setProjects] = useState(() => sortProjects(loadProjects()));
  const summaries = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, summarizeProject(p)])), [projects]);
  const [editing, setEditing] = useState(null); // { id, draft, errors }
  const [toDelete, setToDelete] = useState(null);
  const openId = currentProject()?.id;
  const refresh = () => setProjects(sortProjects(loadProjects()));

  const open = (project) => {
    if (openProject(project.id)) navigate('/');
  };

  const saveEdit = () => {
    const errors = validateProjectDraft(editing.draft);
    if (Object.keys(errors).length) {
      setEditing((e) => ({ ...e, errors }));
      return;
    }
    if (!updateProject(editing.id, cleanProjectDraft(editing.draft))) {
      toast({ title: t('settings.storageFull'), tone: 'danger' });
      return;
    }
    setEditing(null);
    refresh();
  };

  const confirmDelete = async () => {
    const project = toDelete;
    // A copy of everything first: deleting a project can't be undone otherwise.
    try {
      await exportAppData({ label: 'before-delete' });
    } catch {
      toast({ title: t('app.backup.safetyFail'), tone: 'danger' });
      return;
    }
    deleteProject(project.id);
    try {
      await deleteProjectFiles(project.id);
    } catch {
      // files stay orphaned but harmless; the backup holds them
    }
    refresh();
    toast({ title: t('projects.deleted', { name: project.name }) });
  };

  return (
    <Page area="projects">
      <div className={s.toolbar}>
        <p className={s.muted}>{t('projects.pageHint')}</p>
        <Button variant="primary" icon={Plus} onClick={() => navigate('/projects/new')}>
          {t('projects.newProject')}
        </Button>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderPlus}
          title={t('projects.emptyTitle')}
          body={t('projects.emptyBody')}
          action={
            <Button variant="primary" icon={Plus} onClick={() => navigate('/projects/new')}>
              {t('projects.newProject')}
            </Button>
          }
        />
      ) : (
        <ul className={s.grid}>
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              summary={summaries[p.id]}
              isOpen={p.id === openId}
              onOpen={() => open(p)}
              onEdit={() => setEditing({ id: p.id, draft: { ...p }, errors: {} })}
              onDelete={() => setToDelete(p)}
            />
          ))}
        </ul>
      )}

      <Dialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={t('projects.editDetails')}
        footer={
          <>
            <Button onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={saveEdit}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        {editing && <ProjectFields value={editing.draft} errors={editing.errors} onChange={(draft) => setEditing((e) => ({ ...e, draft }))} />}
      </Dialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={t('projects.deleteTitle')}
        message={toDelete ? t('projects.deleteBody', { name: toDelete.name }) : ''}
        confirmLabel={t('projects.delete')}
        tone="danger"
        onConfirm={confirmDelete}
      />
    </Page>
  );
}
