import { CopyPlus, FolderPlus, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useI18n } from '../../i18n/useI18n.js';
import { previewTemplate, templateDefaults } from '../../state/portfolioModel.js';
import { loadTasks } from '../../state/projectModel.js';
import { loadProjects } from '../../utils/Projects.js';
import { loadRateLibrary } from '../../utils/RateLibrary.js';
import { activeTemplates, deleteTemplate, listTemplates, makeTemplateFromTasks, saveTemplate, toISODate } from '../../utils/TemplateEngine.js';
import { Button, Card, ConfirmDialog, Dialog, EmptyState, Field, IconButton, Input, Select, cx, useToast } from '../../ui/index.js';
import { Page } from '../Page.jsx';
import { templateName } from './templateLabels.js';
import { TemplatePreview, TemplateVariables } from './TemplatePreview.jsx';
import s from '../library/Library.module.css';

/** Values and preview of the chosen template, and "New project from it". */
function TemplateDetail({ template }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [values, setValues] = useState(() => templateDefaults(template));
  const preview = useMemo(() => previewTemplate(template, values, toISODate(new Date()), loadRateLibrary(), { lang }), [template, values, lang]);
  if (!preview) return null;

  return (
    <Card title={`${template.icon || '🏗️'} ${templateName(template, t, lang)}`} titleAs="h2" padding="md" className={s.main}>
      <TemplateVariables template={template} values={values} onChange={setValues} />
      <TemplatePreview preview={preview} />
      <div className={s.actionsEnd}>
        <Button variant="primary" icon={FolderPlus} onClick={() => navigate('/projects/new', { state: { templateId: template.id, values } })}>
          {t('projects.newFromTemplate')}
        </Button>
      </div>
    </Card>
  );
}

/**
 * /templates — structure templates, shared by all projects: pick one
 * (?t=id), set its variables, preview items and cost, then start a new
 * project from it. Also saves an existing project as a template.
 * Storage: TemplateEngine.
 */
export default function TemplatesPage() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState(() => activeTemplates(listTemplates()));
  const [params, setParams] = useSearchParams();
  const [toDelete, setToDelete] = useState(null);
  const [fromProject, setFromProject] = useState(null); // { projectId, name } while the dialog is open
  const projects = useMemo(() => (fromProject ? loadProjects() : []), [fromProject]);
  const selected = templates.find((x) => x.id === params.get('t')) || null;

  const openFromProject = () => setFromProject({ projectId: loadProjects()[0]?.id || '', name: '' });

  const saveProject = () => {
    const project = projects.find((p) => p.id === fromProject.projectId);
    const tasks = project ? loadTasks(undefined, project) : [];
    if (!tasks.length) {
      toast({ title: t('templates.noticeNoTasks') });
      return;
    }
    saveTemplate(makeTemplateFromTasks(tasks, fromProject.name || project.name));
    setTemplates(activeTemplates(listTemplates()));
    setFromProject(null);
    toast({ title: t('templates.noticeProjectSaved') });
  };

  return (
    <Page area="templates">
      <div className={s.toolbar}>
        <p className={s.hint}>{t('projects.templatesHint')}</p>
        <div className={s.actions}>
          <Button icon={CopyPlus} onClick={openFromProject}>
            {t('library.saveProject')}
          </Button>
          <Button variant="primary" icon={Plus} onClick={() => navigate('/templates/new')}>
            {t('library.newTemplate')}
          </Button>
        </div>
      </div>

      {templates.length === 0 ? (
        <EmptyState title={t('library.noTemplates')} />
      ) : (
        <ul className={s.cards}>
          {templates.map((tpl) => (
            <li key={tpl.id} className={cx(s.tplCard, tpl.id === selected?.id && s.current)}>
              <button type="button" className={s.tplButton} aria-pressed={tpl.id === selected?.id} onClick={() => setParams(tpl.id === selected?.id ? {} : { t: tpl.id }, { replace: true })}>
                <span className={s.tplIcon} aria-hidden="true">
                  {tpl.icon || '🏗️'}
                </span>
                <span className={s.tplText}>
                  <strong>{templateName(tpl, t, lang)}</strong>
                  <span className={s.muted}>{t('templates.cardMeta', { vars: (tpl.variables || []).length, elements: (tpl.elements || []).length })}</span>
                </span>
              </button>
              <IconButton icon={Trash2} label={t('templates.deleteTemplateTitle')} size="sm" variant="ghost" onClick={() => setToDelete(tpl)} />
            </li>
          ))}
        </ul>
      )}

      {selected && <TemplateDetail key={selected.id} template={selected} />}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={t('templates.confirmDeleteTemplate')}
        message={toDelete ? templateName(toDelete, t, lang) : ''}
        confirmLabel={t('common.delete')}
        tone="danger"
        onConfirm={() => {
          deleteTemplate(toDelete.id);
          setTemplates(activeTemplates(listTemplates()));
          if (selected?.id === toDelete.id) setParams({}, { replace: true });
        }}
      />

      <Dialog
        open={fromProject !== null}
        onOpenChange={(o) => !o && setFromProject(null)}
        title={t('templates.saveProjectAsTemplate')}
        description={t('library.fromProjectHint')}
        footer={
          <>
            <Button onClick={() => setFromProject(null)}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={saveProject} disabled={!fromProject?.projectId}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <Field label={t('projects.sourceProject')}>
          <Select value={fromProject?.projectId || ''} onChange={(e) => setFromProject((d) => ({ ...d, projectId: e.target.value }))}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('calculator.templateName')}>
          <Input data-autofocus value={fromProject?.name || ''} placeholder={t('templates.fromProjectNamePlaceholder')} onChange={(e) => setFromProject((d) => ({ ...d, name: e.target.value }))} />
        </Field>
      </Dialog>
    </Page>
  );
}
