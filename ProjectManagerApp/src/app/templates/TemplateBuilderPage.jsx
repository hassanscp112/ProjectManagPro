import { ArrowLeft, ArrowRight, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '../../i18n/useI18n.js';
import { cleanTemplateDraft } from '../../state/libraryModel.js';
import { PARTS, saveTemplate } from '../../utils/TemplateEngine.js';
import { Button, Card, Field, IconButton, Input, NumberInput, Select, useToast } from '../../ui/index.js';
import { Page } from '../Page.jsx';
import s from '../library/Library.module.css';

const DEP_TYPES = ['FS', 'SS', 'FF', 'SF'];
const partName = (id) => PARTS.find((p) => p.id === id)?.name || '—';

/**
 * /templates/new — build a structure template: variables (e.g.
 * area, floors) and line items (a part, its section, a quantity formula
 * over the variables, optional "repeats per" and a dependency).
 */
export default function TemplateBuilderPage() {
  const { t, dir } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(() => ({
    name: '',
    icon: '🏗️',
    variables: [{ key: 'area', label: t('templates.defaultAreaVarLabel'), default: 100 }],
    elements: [],
  }));
  const [error, setError] = useState(null);
  const groups = useMemo(() => [...new Set(draft.elements.map((el) => el.group).filter(Boolean))], [draft.elements]);

  const patch = (changes) => setDraft((d) => ({ ...d, ...changes }));
  const patchItem = (list, i, changes) => setDraft((d) => ({ ...d, [list]: d[list].map((x, j) => (j === i ? { ...x, ...changes } : x)) }));
  const removeItem = (list, i) => setDraft((d) => ({ ...d, [list]: d[list].filter((_, j) => j !== i) }));

  const save = () => {
    const result = cleanTemplateDraft(draft);
    if (result.error) {
      setError(result.error);
      return;
    }
    saveTemplate(result.template);
    toast({ title: t('library.templateSaved') });
    navigate('/templates');
  };

  return (
    <Page area="templates">
      <div className={s.toolbar}>
        <Button icon={dir === 'rtl' ? ArrowRight : ArrowLeft} onClick={() => navigate('/templates')}>
          {t('library.backToTemplates')}
        </Button>
        <Button variant="primary" onClick={save}>
          {t('library.saveTemplate')}
        </Button>
      </div>

      <Card title={t('templates.editorTitle')} titleAs="h2" padding="md">
        <div className={s.builderHead}>
          <Field label={t('calculator.templateName')} error={error === 'name' ? t('record.required') : undefined} className={s.grow}>
            <Input data-autofocus value={draft.name} placeholder={t('templates.templateNamePlaceholder')} onChange={(e) => patch({ name: e.target.value })} />
          </Field>
          <Field label={t('templates.iconPlaceholder')} className={s.iconField}>
            <Input value={draft.icon} onChange={(e) => patch({ icon: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card title={t('templates.variablesTitle')} titleAs="h2" padding="md" subtitle={t('library.variablesHint')}>
        <ul className={s.rows}>
          {draft.variables.map((v, i) => (
            <li key={i} className={s.varRow}>
              <Field label={t('templates.varKeyPlaceholder')}>
                <Input className="ui-ltr" value={v.key} onChange={(e) => patchItem('variables', i, { key: e.target.value })} />
              </Field>
              <Field label={t('templates.varLabelPlaceholder')}>
                <Input value={v.label} onChange={(e) => patchItem('variables', i, { label: e.target.value })} />
              </Field>
              <Field label={t('templates.varDefaultPlaceholder')}>
                <NumberInput value={v.default} onChange={(e) => patchItem('variables', i, { default: e.target.value })} />
              </Field>
              <IconButton icon={Trash2} label={t('common.delete')} variant="ghost" className={s.rowRemove} onClick={() => removeItem('variables', i)} />
            </li>
          ))}
        </ul>
        <div>
          <Button
            icon={Plus}
            onClick={() => patch({ variables: [...draft.variables, { key: `var${draft.variables.length + 1}`, label: t('templates.defaultNewVarLabel'), default: 1 }] })}
          >
            {t('library.addVariable')}
          </Button>
        </div>
      </Card>

      <Card title={t('templates.elementsTitle')} titleAs="h2" padding="md">
        {error === 'elements' && <p className={s.notice}>{t('templates.noticeNeedElement')}</p>}
        <ul className={s.rows}>
          {draft.elements.map((el, i) => (
            <li key={i} className={s.elementRow}>
              <span className={s.elementIndex}>{i}</span>
              <Field label={t('templates.itemSelectTitle')} className={s.aPart}>
                <Select value={el.partId} onChange={(e) => patchItem('elements', i, { partId: e.target.value })}>
                  {PARTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.unit})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('library.section')} className={s.aSec}>
                <Input list="tpl-groups" value={el.group} placeholder={t('templates.groupPlaceholder')} onChange={(e) => patchItem('elements', i, { group: e.target.value })} />
              </Field>
              <Field label={t('library.qtyFormula')} className={s.aForm}>
                <Input className="ui-ltr" value={el.qtyFormula} placeholder="floors*area*0.34" onChange={(e) => patchItem('elements', i, { qtyFormula: e.target.value })} />
              </Field>
              <Field label={t('templates.repeatsTitle')} className={s.aRep}>
                <Select value={el.repeatsVar || ''} onChange={(e) => patchItem('elements', i, { repeatsVar: e.target.value || null })}>
                  <option value="">{t('templates.noRepeat')}</option>
                  {draft.variables.map((v) => (
                    <option key={v.key} value={v.key}>
                      {v.label || v.key}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('templates.dependsOnTitle')} className={s.aDep}>
                <Select value={el.depOn ?? ''} onChange={(e) => patchItem('elements', i, { depOn: e.target.value === '' ? null : Number(e.target.value) })}>
                  <option value="">{t('templates.noDependency')}</option>
                  {draft.elements.map((other, j) =>
                    j === i ? null : (
                      <option key={j} value={j}>
                        {j} — {partName(other.partId)}
                      </option>
                    )
                  )}
                </Select>
              </Field>
              <Field label={t('templates.linkTypeTitle')} className={s.aType}>
                <Select value={el.depType} onChange={(e) => patchItem('elements', i, { depType: e.target.value })}>
                  {DEP_TYPES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('templates.lagTitle')} className={s.aLag}>
                <NumberInput value={el.lag} onChange={(e) => patchItem('elements', i, { lag: e.target.value })} />
              </Field>
              <IconButton icon={Trash2} label={t('common.delete')} variant="ghost" className={s.elRemove} onClick={() => removeItem('elements', i)} />
            </li>
          ))}
        </ul>
        <datalist id="tpl-groups">
          {groups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
        <div>
          <Button
            icon={Plus}
            onClick={() =>
              patch({ elements: [...draft.elements, { partId: PARTS[0].id, qtyFormula: '', group: t('templates.defaultGroup'), repeatsVar: null, depOn: null, depType: 'FS', lag: 0 }] })
            }
          >
            {t('library.addElement')}
          </Button>
        </div>
      </Card>
    </Page>
  );
}
