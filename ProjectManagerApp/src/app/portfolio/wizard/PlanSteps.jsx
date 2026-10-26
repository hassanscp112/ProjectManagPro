import { useMemo } from 'react';
import { compactCurrency, formatNumber } from '../../../i18n/index.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { groupItems } from '../../../state/plannerModel.js';
import { LEVEL_USES } from '../../../utils/planning/buildingTemplates.js';
import { expandTemplate } from '../../../utils/planning/generator.js';
import { markupPercent } from '../../../utils/planning/autoPlan.js';
import { findRateById } from '../../../utils/RateLibrary.js';
import { Card, Field, NumberInput, Select, Table, cx } from '../../../ui/index.js';
import { itemLabel, levelLabel, levelUseLabel, sectionLabel } from './wizardText.js';
import s from './Wizard.module.css';

/** Collapsible group of items (a section or a level). */
function Group({ label, meta, open, children }) {
  return (
    <details className={s.group} open={open}>
      <summary>
        {label}
        {meta && <span className={s.groupMeta}>{meta}</span>}
      </summary>
      <div className={s.groupBody}>{children}</div>
    </details>
  );
}

const useGroups = (plan, template) => {
  const { lang } = useI18n();
  return useMemo(() => groupItems(plan, (key) => sectionLabel(template, key, lang), (level) => levelLabel(level, lang)), [plan, template, lang]);
};

/* ─────────────── levels ─────────────── */

/** One row per level: area, height and use, each defaulting to the building's. */
export function StepLevels({ plan, state, dispatch }) {
  const { t, lang } = useI18n();
  if (!plan) return null;
  const set = (index, patch) => dispatch({ type: 'level', index, patch });
  return (
    <Card title={t('planning.wiz.step.levels')} subtitle={t('planning.wiz.levelsHint')} titleAs="h2" padding="md">
      <Table label={t('planning.wiz.step.levels')} minWidth={560}>
        <thead>
          <tr>
            <th>{t('planning.wiz.level')}</th>
            <th>{t('planning.wiz.levelArea')}</th>
            <th>{t('planning.wiz.levelHeight')}</th>
            <th>{t('planning.wiz.levelUse')}</th>
          </tr>
        </thead>
        <tbody>
          {plan.levels.map((level) => {
            const o = state.levelOverrides[level.index] || {};
            return (
              <tr key={level.index}>
                <td>{levelLabel(level, lang)}</td>
                <td>
                  <NumberInput aria-label={t('planning.wiz.levelArea')} size="sm" className={s.cellInput} value={o.area ?? ''} placeholder={formatNumber(level.area)} onChange={(e) => set(level.index, { area: e.target.value })} />
                </td>
                <td>
                  <NumberInput aria-label={t('planning.wiz.levelHeight')} size="sm" className={s.cellInput} value={o.height ?? ''} placeholder={formatNumber(level.height)} onChange={(e) => set(level.index, { height: e.target.value })} />
                </td>
                <td>
                  <Select aria-label={t('planning.wiz.levelUse')} value={level.use} onChange={(e) => set(level.index, { use: e.target.value })}>
                    {Object.keys(LEVEL_USES).map((use) => (
                      <option key={use} value={use}>
                        {levelUseLabel(t, use)}
                      </option>
                    ))}
                  </Select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <p className={s.muted}>
        {t('planning.wiz.levelsTotal', { n: plan.levels.length, area: formatNumber(plan.levels.reduce((sum, l) => sum + l.area, 0)) })}
      </p>
    </Card>
  );
}

/* ─────────────── quantities ─────────────── */

/** Every generated item with its formula; quantities can be overwritten and items dropped. */
export function StepQuantities({ plan, template, state, dispatch, workTypes }) {
  const { t, lang } = useI18n();
  const groups = useGroups(plan, template);
  const base = useMemo(() => {
    const { items } = expandTemplate(template, state.values, { levelOverrides: state.levelOverrides });
    return new Map(items.map((it) => [it.key, it.qty]));
  }, [template, state.values, state.levelOverrides]);
  if (!plan) return null;
  const dropped = new Set(state.dropped);
  const total = plan.items.filter((it) => !it.leftOut).length;
  const kept = total - dropped.size;

  return (
    <Card title={t('planning.wiz.step.quantities')} subtitle={t('planning.wiz.quantitiesHint')} titleAs="h2" padding="md">
      <p className={s.muted}>{t('planning.wiz.itemsKept', { kept, total })}</p>
      <div className={s.groups}>
        {groups.map((g, gi) => (
          <Group key={g.key} label={g.label} meta={t('planning.wiz.itemsCount', { n: g.items.length })} open={gi < 3}>
            <Table label={g.label} minWidth={620}>
              <thead>
                <tr>
                  <th>{t('planning.wiz.keep')}</th>
                  <th>{t('templates.colItem')}</th>
                  <th>{t('planning.wiz.formula')}</th>
                  <th className="ui-num">{t('common.quantity')}</th>
                  <th>{t('common.unit')}</th>
                </tr>
              </thead>
              <tbody>
                {g.items.map((item) => {
                  const off = dropped.has(item.key);
                  const name = itemLabel(item, workTypes, lang);
                  return (
                    <tr key={item.key} className={cx(off && s.dropped)}>
                      <td>
                        <input type="checkbox" className={s.check} checked={!off} aria-label={t('planning.wiz.keepItem', { name })} onChange={() => dispatch({ type: 'drop', key: item.key })} />
                      </td>
                      <td>{name}</td>
                      <td>
                        {item.boqRow !== undefined ? (
                          <span className={s.formula}>{t('planning.wiz.fromBoq', { no: item.boqNo || '—' })}</span>
                        ) : (
                          <code className={cx(s.formula, 'ui-ltr')}>{item.qtyFormula}</code>
                        )}
                      </td>
                      <td className="ui-num">
                        <NumberInput
                          aria-label={t('planning.wiz.qtyOf', { name })}
                          size="sm"
                          className={s.cellInput}
                          disabled={off}
                          value={state.qtyOverrides[item.key] ?? ''}
                          placeholder={formatNumber(item.qtyBase ?? base.get(item.key) ?? item.qty)}
                          onChange={(e) => dispatch({ type: 'qty', key: item.key, value: e.target.value })}
                        />
                      </td>
                      <td>{item.unit}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Group>
        ))}
      </div>
    </Card>
  );
}

/* ─────────────── prices ─────────────── */

/** Direct cost per item (from the rate library, can be overwritten), markups, contract prices. */
export function StepPrices({ plan, template, state, dispatch, workTypes, rates }) {
  const { t, lang } = useI18n();
  const groups = useGroups(plan, template);
  if (!plan) return null;
  const dropped = new Set(state.dropped);
  const rateCost = (item) => {
    const rate = findRateById(rates, workTypes.get(item.workTypeId)?.rateId);
    return rate ? Number(rate.unitPrice) || 0 : 0;
  };
  const pct = markupPercent(Object.fromEntries(Object.entries(state.markups).map(([k, v]) => [k, Number(v)])));

  return (
    <Card title={t('planning.wiz.step.prices')} subtitle={t('planning.wiz.pricesHint')} titleAs="h2" padding="md">
      <div className={s.row}>
        {['overhead', 'contingency', 'profit'].map((k) => (
          <Field key={k} label={t(`planning.wiz.markup.${k}`)} className={s.narrow}>
            <NumberInput min="0" unit="%" value={state.markups[k] ?? ''} onChange={(e) => dispatch({ type: 'markup', key: k, value: e.target.value })} />
          </Field>
        ))}
      </div>
      <dl className={s.figures}>
        {[
          ['planning.wiz.directCost', compactCurrency(plan.stats.directCost, lang)],
          ['planning.wiz.markupTotal', `${formatNumber(pct)}% · ${compactCurrency(plan.stats.totalCost - plan.stats.directCost, lang)}`],
          ['planning.wiz.contractValue', compactCurrency(plan.stats.totalCost, lang)],
          ['planning.wiz.unpricedCount', formatNumber(plan.stats.unpriced.length)],
        ].map(([k, v]) => (
          <div key={k} className={s.figure}>
            <dt>{t(k)}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className={s.groups}>
        {groups.map((g, gi) => {
          const live = g.items.filter((it) => !dropped.has(it.key));
          if (!live.length) return null;
          const total = live.reduce((sum, it) => sum + it.qty * it.unitPrice, 0);
          return (
            <Group key={g.key} label={g.label} meta={compactCurrency(total, lang)} open={gi < 2}>
              <Table label={g.label} minWidth={700}>
                <thead>
                  <tr>
                    <th>{t('templates.colItem')}</th>
                    <th className="ui-num">{t('common.quantity')}</th>
                    <th className="ui-num">{t('planning.wiz.unitCost')}</th>
                    <th className="ui-num">{t('planning.wiz.unitPrice')}</th>
                    <th className="ui-num">{t('templates.colCost')}</th>
                  </tr>
                </thead>
                <tbody>
                  {live.map((item) => {
                    const name = itemLabel(item, workTypes, lang);
                    return (
                      <tr key={item.key} className={cx(!item.priced && s.warnRow)}>
                        <td>{name}</td>
                        <td className="ui-num">
                          {formatNumber(item.qty)} {item.unit}
                        </td>
                        <td className="ui-num">
                          <NumberInput
                            aria-label={t('planning.wiz.costOf', { name })}
                            size="sm"
                            className={s.cellInput}
                            value={state.costOverrides[item.key] ?? ''}
                            placeholder={formatNumber(rateCost(item))}
                            onChange={(e) => dispatch({ type: 'cost', key: item.key, value: e.target.value })}
                          />
                        </td>
                        <td className="ui-num">{formatNumber(item.unitPrice)}</td>
                        <td className="ui-num">{compactCurrency(item.qty * item.unitPrice, lang)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </Group>
          );
        })}
      </div>
    </Card>
  );
}
