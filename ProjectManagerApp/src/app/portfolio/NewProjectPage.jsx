import { ArrowLeft, ArrowRight, Copy, FilePlus2, LayoutTemplate, Rocket } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { compactCurrency, formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import {
  START_KINDS,
  blankProjectTasks,
  cleanProjectDraft,
  copyProjectTasks,
  newProjectMeta,
  previewTemplate,
  summarizeProject,
  templateDefaults,
  validateProjectDraft,
} from '../../state/portfolioModel.js';
import { createTaskId, loadTasks, saveProjectPlan } from '../../state/projectModel.js';
import { logAppEvent } from '../../utils/ActivityLog.js';
import { loadIdentity } from '../../utils/Identity.js';
import { createProject, deleteProject, loadProjects, openProject, projectStartDate } from '../../utils/Projects.js';
import { loadRateLibrary } from '../../utils/RateLibrary.js';
import { listTemplates, toISODate } from '../../utils/TemplateEngine.js';
import { Button, Card, EmptyState, Field, Segmented, Select, useToast } from '../../ui/index.js';
import { Page } from '../Page.jsx';
import { templateName } from '../templates/templateLabels.js';
import { TemplatePreview, TemplateVariables } from '../templates/TemplatePreview.jsx';
import { ProjectFields } from './ProjectFields.jsx';
import s from './Portfolio.module.css';

const KIND_ICONS = { template: LayoutTemplate, blank: FilePlus2, copy: Copy };

/**
 * /projects/new — create a project and start planning it: details, then
 * where its task tree comes from (a template with its variables, a blank
 * tree, or a copy of another project), then open its Schedule in edit mode.
 * Arriving from Templates (state { templateId, values }) preselects it.
 */
export default function NewProjectPage() {
  const { t, lang, dir } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const { state } = useLocation();
  const templates = useMemo(() => listTemplates(), []);
  const projects = useMemo(() => loadProjects(), []);

  const initialTemplate = templates.find((x) => x.id === state?.templateId) || templates[0] || null;
  const [draft, setDraft] = useState(() => ({ name: '', contract: '', location: '', startDate: toISODate(new Date()) }));
  const [errors, setErrors] = useState({});
  const [kind, setKind] = useState(templates.length ? 'template' : 'blank');
  const [templateId, setTemplateId] = useState(initialTemplate?.id || '');
  const [values, setValues] = useState(() => (state?.templateId && state.values ? state.values : templateDefaults(initialTemplate)));
  const [sourceId, setSourceId] = useState(projects[0]?.id || '');

  const template = templates.find((x) => x.id === templateId) || null;
  const source = projects.find((p) => p.id === sourceId) || null;
  const preview = useMemo(
    () => (kind === 'template' ? previewTemplate(template, values, draft.startDate, loadRateLibrary()) : null),
    [kind, template, values, draft.startDate]
  );
  const sourceSummary = useMemo(() => (kind === 'copy' && source ? summarizeProject(source) : null), [kind, source]);

  const pickTemplate = (id) => {
    setTemplateId(id);
    setValues(templateDefaults(templates.find((x) => x.id === id)));
  };

  const startTasks = (startDate) => {
    if (kind === 'template') return preview?.tasks || [];
    if (kind === 'copy') return source ? copyProjectTasks(loadTasks(undefined, source), projectStartDate(source), startDate) : [];
    return blankProjectTasks({ id: createTaskId(), name: t('app.newMainGroup'), startDate });
  };

  const create = () => {
    const found = validateProjectDraft(draft);
    if (kind === 'template' && !preview) found.start = 'template';
    if (kind === 'copy' && !source) found.start = 'copy';
    setErrors(found);
    if (Object.keys(found).length) return;

    const details = cleanProjectDraft(draft);
    const tasks = startTasks(details.startDate);
    const project = createProject(details);
    if (!project) {
      toast({ title: t('settings.storageFull'), tone: 'danger' });
      return;
    }
    openProject(project.id);
    if (!saveProjectPlan(project, { tasks, meta: newProjectMeta() })) {
      deleteProject(project.id);
      toast({ title: t('settings.storageFull'), tone: 'danger' });
      return;
    }
    const leaves = tasks.filter((x) => !x.isGroup).length;
    logAppEvent({
      actor: loadIdentity().name,
      kind: kind === 'template' ? 'template' : 'project',
      summary:
        kind === 'template'
          ? `${t('app.template.generatedLog')} «${templateName(template, t)}» — ${leaves} ${t('app.template.itemsLog')}`
          : kind === 'copy'
            ? t('projects.copiedLog', { name: source.name, count: leaves })
            : t('projects.createdLog'),
      refType: 'project',
      refId: project.id,
    });
    navigate('/schedule', { state: { startPlanning: true } });
  };

  return (
    <Page area="projects">
      <div className={s.toolbar}>
        <Button icon={dir === 'rtl' ? ArrowRight : ArrowLeft} onClick={() => navigate('/projects')}>
          {t('projects.backToProjects')}
        </Button>
      </div>

      <Card title={t('projects.detailsTitle')} titleAs="h2" padding="md">
        <ProjectFields value={draft} errors={errors} onChange={setDraft} />
      </Card>

      <Card title={t('projects.startFrom')} titleAs="h2" padding="md" subtitle={t('projects.startFromHint')}>
        <div className={s.startBody}>
          <Segmented
            label={t('projects.startFrom')}
            value={kind}
            onChange={setKind}
            options={START_KINDS.map((k) => ({ value: k, label: t(`projects.start_${k}`), icon: KIND_ICONS[k] }))}
          />

          {kind === 'template' &&
            (templates.length === 0 ? (
              <EmptyState title={t('library.noTemplates')} />
            ) : (
              <>
                <Field label={t('projects.template')} error={errors.start ? t('record.required') : undefined}>
                  <Select value={templateId} onChange={(e) => pickTemplate(e.target.value)}>
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {`${tpl.icon || '🏗️'} ${templateName(tpl, t)}`}
                      </option>
                    ))}
                  </Select>
                </Field>
                {template && <TemplateVariables key={template.id} template={template} values={values} onChange={setValues} />}
                <TemplatePreview preview={preview} />
              </>
            ))}

          {kind === 'copy' &&
            (projects.length === 0 ? (
              <EmptyState title={t('projects.emptyTitle')} />
            ) : (
              <>
                <Field label={t('projects.sourceProject')} error={errors.start ? t('record.required') : undefined}>
                  <Select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                {sourceSummary && (
                  <p className={s.muted}>
                    {t('projects.copySummary', { count: formatNumber(sourceSummary.itemCount), value: compactCurrency(sourceSummary.totalCost, lang) })}
                  </p>
                )}
                <p className={s.muted}>{t('projects.copyHint')}</p>
              </>
            ))}

          {kind === 'blank' && <p className={s.muted}>{t('projects.blankHint')}</p>}
        </div>
      </Card>

      <div className={s.footer}>
        <Button onClick={() => navigate('/projects')}>{t('common.cancel')}</Button>
        <Button variant="primary" icon={Rocket} onClick={create}>
          {t('projects.createAndPlan')}
        </Button>
      </div>
    </Page>
  );
}
