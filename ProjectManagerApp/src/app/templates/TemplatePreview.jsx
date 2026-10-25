import { compactCurrency, formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { Field, NumberInput, Table, cx } from '../../ui/index.js';
import s from '../library/Library.module.css';

/** A template's variable inputs (values: { key: number }). */
export function TemplateVariables({ template, values, onChange, children }) {
  return (
    <div className={s.varForm}>
      {(template.variables || []).map((v) => (
        <Field key={v.key} label={v.label || v.key}>
          <NumberInput value={values[v.key] ?? ''} onChange={(e) => onChange({ ...values, [v.key]: e.target.value })} />
        </Field>
      ))}
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
