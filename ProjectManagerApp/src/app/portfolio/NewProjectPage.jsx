import { ArrowLeft, ArrowRight, Copy, FilePlus2, LayoutTemplate, Rocket } from 'lucide-react';
import { useEffect, useMemo, useReducer, useRef } from 'react';
import { useBlocker, useLocation, useNavigate, useSearchParams } from 'react-router';
import { compactCurrency, formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { createPlanner, planOptions, plannerReducer, stepErrors, stepsFor } from '../../state/plannerModel.js';
import { START_KINDS, blankProjectTasks, cleanProjectDraft, copyProjectTasks, newProjectMeta, previewTemplate, summarizeProject, templateDefaults } from '../../state/portfolioModel.js';
import { createTaskId, loadMeta, loadTasks, saveProjectPlan } from '../../state/projectModel.js';
import { logAppEvent } from '../../utils/ActivityLog.js';
import { GanttEngine } from '../../utils/GanttEngine.js';
import { loadIdentity } from '../../utils/Identity.js';
import { planProject } from '../../utils/planning/autoPlan.js';
import { loadWorkTypes, workTypeMap } from '../../utils/planning/WorkTypes.js';
import { createProject, deleteProject, loadProjects, openProject, projectStartDate } from '../../utils/Projects.js';
import { loadRateLibrary } from '../../utils/RateLibrary.js';
import { activeTemplates, isPlanTemplate, listTemplates, toISODate } from '../../utils/TemplateEngine.js';
import { Button, Card, ConfirmDialog, EmptyState, Field, Segmented, Select, useToast } from '../../ui/index.js';
import { Page } from '../Page.jsx';
import { templateName } from '../templates/templateLabels.js';
import { TemplatePreview, TemplateVariables } from '../templates/TemplatePreview.jsx';
import { useCan } from '../useCan.js';
import { ProjectFields } from './ProjectFields.jsx';
import { StepLevels, StepPrices, StepQuantities } from './wizard/PlanSteps.jsx';
import { StepReview } from './wizard/ReviewStep.jsx';
import { StepLinks, StepSchedule } from './wizard/ScheduleSteps.jsx';
import { WizardSteps } from './wizard/WizardNav.jsx';
import s from './Portfolio.module.css';
import w from './wizard/Wizard.module.css';

const KIND_ICONS = { template: LayoutTemplate, blank: FilePlus2, copy: Copy };

/**
 * /projects/new?step=… — the New project wizard. Details → where the plan
 * comes from (a building template, an older template, a blank tree or a copy
 * of another project) → for building templates: building inputs, levels,
 * quantities, prices + markups, calendar / productivity / crews, links →
 * review (figures, warnings, the schedule) → create as a draft and open its
 * Schedule. Every step re-generates the plan from the answers
 * (state/plannerModel + utils/planning/autoPlan). Arriving from Templates
 * (state { templateId, values }) preselects that template.
 */
export default function NewProjectPage() {
  const { t, lang, dir } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const { state: arrival } = useLocation();
  const [params, setParams] = useSearchParams();
  const can = useCan();
  const templates = useMemo(() => activeTemplates(listTemplates()), []);
  const projects = useMemo(() => loadProjects(), []);
  const workTypeList = useMemo(() => loadWorkTypes(), []);
  const workTypes = useMemo(() => workTypeMap(workTypeList), [workTypeList]);
  const rates = useMemo(() => loadRateLibrary(), []);
  const created = useRef(false);

  const [state, dispatch] = useReducer(plannerReducer, null, () => {
    const first = templates.find((x) => x.id === arrival?.templateId) || templates.find(isPlanTemplate) || templates[0] || null;
    return createPlanner({
      startDate: toISODate(new Date()),
      kind: templates.length ? 'template' : 'blank',
      templateId: first?.id || '',
      values: arrival?.templateId && arrival.values ? arrival.values : templateDefaults(first),
      sourceId: projects[0]?.id || '',
    });
  });

  // Everything that follows from the answers, re-derived on every change:
  // the chosen template / source, the steps, the building plan, the older
  // templates' preview and what each step still lacks.
  const derived = useMemo(() => {
    const template = templates.find((x) => x.id === state.templateId) || null;
    const source = projects.find((p) => p.id === state.sourceId) || null;
    const building = state.kind === 'template' && isPlanTemplate(template);
    const steps = stepsFor(state, template);
    let plan = null;
    if (building) {
      try {
        plan = planProject(template, state.values, planOptions(state, { workTypes: workTypeList, rates, lang }));
      } catch {
        plan = null;
      }
    }
    const legacyPreview = state.kind === 'template' && template && !building ? previewTemplate(template, state.values, state.details.startDate, rates, { lang }) : null;
    const errors = steps.map((id) => stepErrors(state, id, template, source));
    return { template, source, building, steps, plan, legacyPreview, errors };
  }, [templates, projects, state, workTypeList, rates, lang]);
  const { template, source, building, steps, plan, legacyPreview } = derived;
  const step = steps.includes(params.get('step')) ? params.get('step') : 'details';
  const at = steps.indexOf(step);

  const engine = useMemo(() => {
    if (!derived.plan || step !== 'review') return null;
    return GanttEngine.calculate(derived.plan.tasks, state.details.startDate, { planning: derived.plan.planning }, []);
  }, [derived, step, state.details.startDate]);
  const sourceSummary = useMemo(() => (state.kind === 'copy' && derived.source ? summarizeProject(derived.source) : null), [state.kind, derived]);

  // The furthest step that may be opened: every step before it is complete.
  const errorsAt = (id) => derived.errors[steps.indexOf(id)] || {};
  let reachable = 0;
  while (reachable < steps.length - 1 && !Object.keys(errorsAt(steps[reachable])).length) reachable += 1;
  const errors = errorsAt(step);
  const shownErrors = state.touched ? errors : {};

  const go = (id) => setParams(id === 'details' ? {} : { step: id });
  const next = () => {
    if (Object.keys(errors).length) {
      dispatch({ type: 'details', patch: {} }); // marks the form as touched → errors show
      return;
    }
    go(steps[at + 1]);
  };

  // Leaving with answers that were not created asks first.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => state.touched && !created.current && currentLocation.pathname !== nextLocation.pathname);
  // The shell's links are plain "#/…" anchors, which the router cannot hold
  // back: while there are answers, send those clicks through the router.
  useEffect(() => {
    if (!state.touched) return undefined;
    const onClick = (e) => {
      const a = e.target instanceof Element ? e.target.closest('a[href^="#/"]') : null;
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank') return;
      e.preventDefault();
      navigate(a.getAttribute('href').slice(1));
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [state.touched, navigate]);

  const startTasks = (startDate) => {
    if (state.kind === 'template') return (building ? plan?.tasks : legacyPreview?.tasks) || [];
    if (state.kind === 'copy') return source ? copyProjectTasks(loadTasks(undefined, source), projectStartDate(source), startDate) : [];
    return blankProjectTasks({ id: createTaskId(), name: t('app.newMainGroup'), startDate });
  };

  const create = () => {
    const missing = steps.find((id) => Object.keys(errorsAt(id)).length);
    if (missing) {
      go(missing);
      return;
    }
    const details = cleanProjectDraft(state.details);
    const tasks = startTasks(details.startDate);
    const project = createProject(details);
    if (!project) {
      toast({ title: t('settings.storageFull'), tone: 'danger' });
      return;
    }
    openProject(project.id);
    // A generated plan brings its planning settings; a copy keeps the source's.
    const planning = building ? plan?.planning : state.kind === 'copy' && source ? loadMeta(undefined, source).planning : null;
    if (!saveProjectPlan(project, { tasks, meta: newProjectMeta(planning || null) })) {
      deleteProject(project.id);
      toast({ title: t('settings.storageFull'), tone: 'danger' });
      return;
    }
    const leaves = tasks.filter((x) => !x.isGroup).length;
    logAppEvent({
      actor: loadIdentity().name,
      kind: state.kind === 'template' ? 'template' : 'project',
      summary:
        state.kind === 'template'
          ? `${t('app.template.generatedLog')} «${templateName(template, t, lang)}» — ${leaves} ${t('app.template.itemsLog')}`
          : state.kind === 'copy'
            ? t('projects.copiedLog', { name: source.name, count: leaves })
            : t('projects.createdLog'),
      refType: 'project',
      refId: project.id,
    });
    created.current = true;
    navigate('/schedule', { state: { startPlanning: true } });
  };

  const pickTemplate = (id) => dispatch({ type: 'template', templateId: id, values: templateDefaults(templates.find((x) => x.id === id)) });
  const stepProps = { plan, template, state, dispatch, workTypes, rates };

  if (!can('plan.edit')) {
    return (
      <Page area="projects">
        <EmptyState title={t('planning.wiz.notAllowed')} body={t('planning.wiz.notAllowedBody')} />
      </Page>
    );
  }

  return (
    <Page area="projects">
      <div className={s.toolbar}>
        <Button icon={dir === 'rtl' ? ArrowRight : ArrowLeft} onClick={() => navigate('/projects')}>
          {t('projects.backToProjects')}
        </Button>
      </div>

      <WizardSteps steps={steps} current={step} reachable={reachable} onGo={go} />

      <div className={w.body}>
        {step === 'details' && (
          <Card title={t('projects.detailsTitle')} titleAs="h2" padding="md">
            <ProjectFields value={state.details} errors={shownErrors} onChange={(details) => dispatch({ type: 'details', patch: details })} />
          </Card>
        )}

        {step === 'start' && (
          <Card title={t('projects.startFrom')} titleAs="h2" padding="md" subtitle={t('projects.startFromHint')}>
            <div className={s.startBody}>
              <Segmented
                label={t('projects.startFrom')}
                value={state.kind}
                onChange={(kind) => dispatch({ type: 'kind', kind })}
                options={START_KINDS.map((k) => ({ value: k, label: t(`projects.start_${k}`), icon: KIND_ICONS[k] }))}
              />
              {state.kind === 'template' &&
                (templates.length === 0 ? (
                  <EmptyState title={t('library.noTemplates')} />
                ) : (
                  <ul className={w.templates} aria-label={t('projects.template')}>
                    {templates.map((tpl) => (
                      <li key={tpl.id}>
                        <button type="button" className={w.templateButton} aria-pressed={tpl.id === state.templateId} onClick={() => pickTemplate(tpl.id)}>
                          <span className={w.templateIcon} aria-hidden="true">
                            {tpl.icon || '🏗️'}
                          </span>
                          {templateName(tpl, t, lang)}
                        </button>
                      </li>
                    ))}
                  </ul>
                ))}
              {state.kind === 'copy' &&
                (projects.length === 0 ? (
                  <EmptyState title={t('projects.emptyTitle')} />
                ) : (
                  <>
                    <Field label={t('projects.sourceProject')} error={shownErrors.start ? t('record.required') : undefined}>
                      <Select value={state.sourceId} onChange={(e) => dispatch({ type: 'source', sourceId: e.target.value })}>
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
              {state.kind === 'blank' && <p className={s.muted}>{t('projects.blankHint')}</p>}
            </div>
          </Card>
        )}

        {step === 'building' && template && (
          <Card title={`${template.icon || '🏗️'} ${templateName(template, t, lang)}`} subtitle={building ? t('planning.wiz.buildingHint') : undefined} titleAs="h2" padding="md">
            <TemplateVariables key={template.id} template={template} values={state.values} onChange={(values) => Object.entries(values).forEach(([key, value]) => value !== state.values[key] && dispatch({ type: 'value', key, value }))} />
            {building && plan && (
              <p className={w.muted}>
                {t('planning.wiz.buildingSummary', { levels: plan.levels.length, items: plan.stats.leafCount, value: compactCurrency(plan.stats.totalCost, lang) })}
              </p>
            )}
          </Card>
        )}

        {step === 'levels' && <StepLevels {...stepProps} />}
        {step === 'quantities' && <StepQuantities {...stepProps} />}
        {step === 'prices' && <StepPrices {...stepProps} />}
        {step === 'schedule' && <StepSchedule {...stepProps} />}
        {step === 'links' && <StepLinks {...stepProps} />}

        {step === 'review' &&
          (building ? (
            <StepReview plan={plan} engine={engine} startDate={state.details.startDate} />
          ) : (
            <Card title={t('planning.wiz.step.review')} titleAs="h2" padding="md">
              {state.kind === 'template' && <TemplatePreview preview={legacyPreview} />}
              {state.kind === 'copy' && sourceSummary && (
                <p className={s.muted}>{t('projects.copySummary', { count: formatNumber(sourceSummary.itemCount), value: compactCurrency(sourceSummary.totalCost, lang) })}</p>
              )}
              {state.kind === 'blank' && <p className={s.muted}>{t('projects.blankHint')}</p>}
            </Card>
          ))}
      </div>

      <div className={w.footer}>
        <Button onClick={() => (at > 0 ? go(steps[at - 1]) : navigate('/projects'))}>{at > 0 ? t('planning.wiz.back') : t('common.cancel')}</Button>
        <span className={w.muted}>{t('planning.wiz.stepOf', { n: at + 1, total: steps.length })}</span>
        <div className={w.spacer} />
        {step === 'review' ? (
          <Button variant="primary" icon={Rocket} onClick={create}>
            {t('projects.createAndPlan')}
          </Button>
        ) : (
          <Button variant="primary" icon={dir === 'rtl' ? ArrowLeft : ArrowRight} onClick={next}>
            {t('planning.wiz.next')}
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => !open && blocker.state === 'blocked' && blocker.reset()}
        title={t('planning.wiz.leaveTitle')}
        message={t('planning.wiz.leaveBody')}
        confirmLabel={t('planning.wiz.leave')}
        tone="danger"
        onConfirm={() => blocker.proceed()}
      />
    </Page>
  );
}
