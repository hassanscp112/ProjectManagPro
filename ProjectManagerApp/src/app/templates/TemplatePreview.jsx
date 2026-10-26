import { compactCurrency, formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { Field, NumberInput, Select, Table, cx } from '../../ui/index.js';
import { variableLabel } from './templateLabels.js';
import s from '../library/Library.module.css';

/**
 * A template's variable inputs (values: { key: number }): numbers, choices
 * (building templates: slab system, finish level…) and yes / no.
 */
export function TemplateVariables({ template, values, onChange, children }) {
  const { t, lang } = useI18n();
  const set = (key, value) => onChange({ ...values, [key]: value });
  return (
    <div className={s.varForm}>
      {(template.variables || []).map((v) => {
        const value = values[v.key] ?? v.default ?? '';
        return (
          <Field key={v.key} label={variableLabel(v, lang)}>
            {v.type === 'choice' ? (
              <Select value={String(value)} onChange={(e) => set(v.key, Number(e.target.value))}>
                {(v.options || []).map((o) => (
                  <option key={o.value} value={String(o.value)}>
                    {lang === 'en' && o.labelEn ? o.labelEn : o.label}
                  </option>
                ))}
              </Select>
            ) : v.type === 'bool' ? (
              <Select value={Number(value) ? '1' : '0'} onChange={(e) => set(v.key, Number(e.target.value))}>
                <option value="0">{t('templates.answerNo')}</option>
                <option value="1">{t('templates.answerYes')}</option>
              </Select>
            ) : (
              <NumberInput value={value} min={v.min} max={v.max} unit={v.unit} onChange={(e) => set(v.key, e.target.value)} />
            )}
          </Field>
        );
      })}
      {children}
    </div>
  );
}

/**
 * What a template generates with the current values (portfolioModel.previewTemplate):
 * unpriced warning, headline figures and the item table.
 */
export function TemplatePreview({ preview }) {
  const { t, lang } = useI18n();
  if (!preview) return null;
  const leaves = preview.tasks.filter((x) => !x.isGroup);
  const unpriced = preview.stats.unpriced || [];

  return (
    <>
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
    </>
  );
}
