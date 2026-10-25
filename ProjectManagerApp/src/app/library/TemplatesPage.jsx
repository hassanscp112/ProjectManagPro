import { CopyPlus, Plus, Trash2, Wand2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { compactCurrency, formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { useProject } from '../../state/projectContext.js';
import { loadRateLibrary } from '../../utils/RateLibrary.js';
import { deleteTemplate, generateProject, listTemplates, makeTemplateFromTasks, saveTemplate, toISODate } from '../../utils/TemplateEngine.js';
import { Button, Card, ConfirmDialog, Dialog, EmptyState, Field, IconButton, Input, NumberInput, Table, cx, useToast } from '../../ui/index.js';
import { Page } from '../Page.jsx';
import { templateName } from './templateLabels.js';
import s from './Library.module.css';

const defaultsOf = (tpl) => Object.fromEntries((tpl?.variables || []).map((v) => [v.key, v.default]));

/** Values, preview and Generate for the chosen template. */
function TemplateDetail({ template, onGenerate }) {
  const { t, lang } = useI18n();
  const [values, setValues] = useState(() => defaultsOf(template));
  const [startDate, setStartDate] = useState(() => toISODate(new Date()));
  const [confirm, setConfirm] = useState(false);
  const preview = useMemo(() => {
    try {
      return generateProject(template, values, { startDate, rateLibrary: loadRateLibrary() });
    } catch {
      return null;
    }
  }, [template, values, startDate]);
  if (!preview) return null;
  const leaves = preview.tasks.filter((x) => !x.isGroup);
  const unpriced = preview.stats.unpriced || [];

  return (
    <Card title={`${template.icon || '🏗️'} ${templateName(template, t)}`} titleAs="h2" padding="md" className={s.main}>
      <div className={s.varForm}>
        {(template.variables || []).map((v) => (
          <Field key={v.key} label={v.label || v.key}>
            <NumberInput value={values[v.key] ?? ''} onChange={(e) => setValues((p) => ({ ...p, [v.key]: e.target.value }))} />
          </Field>
        ))}
        <Field label={t('templates.startDate')}>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
      </div>

      {unpriced.length > 0 && (
        <p className={s.notice}>
          <strong>{t('templates.warningUnpricedLabel', { count: unpriced.length })}</strong> {unpriced.slice(0, 6).join(lang === 'ar' ? '، ' : ', ')}
          {unpriced.length > 6 ? ` ${t('templates.warningMore')}` : ''} {t('library.unpricedFix')}
        </p>
      )}

      <dl className={s.figures}>
        {[
          ['templates.totalItems', formatNumber(preview.stats.leafCount)],
          ['templates.totalGroups', formatNumber(preview.stats.groupCount)],
          ['templates.totalPriced', `${formatNumber(preview.stats.pricedCount)} / ${formatNumber(preview.stats.leafCount)}`],
          ['templates.totalCost', compactCurrency(preview.stats.totalCost, lang)],
        ].map(([k, v]) => (
          <div key={k} className={s.figure}>
            <dt>{t(k)}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <Table minWidth={640} label={t('library.preview')} className={s.previewTable}>
        <thead>
          <tr>
            <th>{t('templates.colItem')}</th>
            <th className="ui-num">{t('common.quantity')}</th>
            <th>{t('common.unit')}</th>
            <th className="ui-num">{t('templates.colUnitPrice')}</th>
            <th className="ui-num">{t('templates.colCost')}</th>
            <th className="ui-num">{t('templates.colDuration')}</th>
          </tr>
        </thead>
        <tbody>
          {leaves.map((row) => (
            <tr key={row.id} className={cx(row.unitPrice === 0 && s.unpriced)}>
              <td style={{ paddingInlineStart: `${Math.min(4, row.wbs.split('.').length - 2) * 14 + 8}px` }}>
                <span className={cx(s.wbs, 'ui-ltr')}>{row.wbs}</span> {row.name}
              </td>
              <td className="ui-num">{formatNumber(row.quantity)}</td>
              <td>{row.unit}</td>
              <td className="ui-num">{formatNumber(row.unitPrice)}</td>
              <td className="ui-num">{compactCurrency(row.quantity * row.unitPrice, lang)}</td>
              <td className="ui-num">{formatNumber(row.duration)}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <div className={s.actionsEnd}>
        <Button variant="primary" icon={Wand2} onClick={() => setConfirm(true)}>
          {t('library.generate', { count: formatNumber(preview.stats.taskCount) })}
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t('library.generateTitle')}
        message={t('library.generateBody', { count: formatNumber(preview.stats.taskCount) })}
        confirmLabel={t('library.generateConfirm')}
        onConfirm={() =>
          onGenerate(preview.tasks, { templateId: template.id, templateName: template.name, values: { ...values }, startDate, stats: preview.stats })
        }
      />
    </Card>
  );
}

/**
 * /library/templates — structure templates: pick one (?t=id), set its
 * variables, preview items and cost, then generate them into the project.
 * Also saves the current project as a template. Storage: TemplateEngine.
 */
export default function TemplatesPage() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const { tasks, generateFromTemplate } = useProject();
  const [templates, setTemplates] = useState(listTemplates);
  const [params, setParams] = useSearchParams();
  const [toDelete, setToDelete] = useState(null);
  const [fromProject, setFromProject] = useState(null); // name draft while the dialog is open
  const selected = templates.find((x) => x.id === params.get('t')) || null;

  const saveProject = () => {
    if (!tasks.length) {
      toast({ title: t('templates.noticeNoTasks') });
      return;
    }
    saveTemplate(makeTemplateFromTasks(tasks, fromProject));
    setTemplates(listTemplates());
    setFromProject(null);
    toast({ title: t('templates.noticeProjectSaved') });
  };

  return (
    <Page area="library">
      <div className={s.toolbar}>
        <p className={s.hint}>{t('templates.pageSub')}</p>
        <div className={s.actions}>
          <Button icon={CopyPlus} onClick={() => setFromProject('')}>
            {t('library.saveProject')}
          </Button>
          <Button variant="primary" icon={Plus} onClick={() => navigate('/library/templates/new')}>
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
                  <strong>{templateName(tpl, t)}</strong>
                  <span className={s.muted}>{t('templates.cardMeta', { vars: (tpl.variables || []).length, elements: (tpl.elements || []).length })}</span>
                </span>
              </button>
              <IconButton icon={Trash2} label={t('templates.deleteTemplateTitle')} size="sm" variant="ghost" onClick={() => setToDelete(tpl)} />
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <TemplateDetail
          key={selected.id}
          template={selected}
          onGenerate={(generated, meta) => {
            if (generateFromTemplate(generated, meta)) navigate('/schedule');
          }}
        />
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={t('templates.confirmDeleteTemplate')}
        message={toDelete ? templateName(toDelete, t) : ''}
        confirmLabel={t('common.delete')}
        tone="danger"
        onConfirm={() => {
          deleteTemplate(toDelete.id);
          setTemplates(listTemplates());
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
            <Button variant="primary" onClick={saveProject}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <Field label={t('calculator.templateName')}>
          <Input data-autofocus value={fromProject || ''} placeholder={t('templates.fromProjectNamePlaceholder')} onChange={(e) => setFromProject(e.target.value)} />
        </Field>
      </Dialog>
    </Page>
  );
}
