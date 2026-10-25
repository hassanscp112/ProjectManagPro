import { Lock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { compactCurrency, formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { useProject } from '../../state/projectContext.js';
import { baselineComparison } from '../../state/scheduleModel.js';
import { Button, EmptyState, StatCard, StatusBadge, Table, cx } from '../../ui/index.js';
import { ltr } from '../bidi.js';
import { formatDay } from '../record/orderMeta.js';
import { Page } from '../Page.jsx';
import { SignOffDialog } from './LifecycleDialogs.jsx';
import s from './Baseline.module.css';

// '+26.5 مليون د.ع': only the signed number is isolated, so the sign stays
// on the number and the words keep the reading direction.
const signedMoney = (n, lang) => {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return compactCurrency(Math.abs(n), lang).replace(/\d[\d.,]*/, (m) => ltr(`${sign}${m}`));
};

/**
 * /schedule/baseline — contract quantities and prices frozen at sign-off
 * against today's, per item and in total (variation orders show up here).
 */
export default function BaselinePage() {
  const { t, lang } = useI18n();
  const { engineResult, projectMeta } = useProject();
  const [onlyChanged, setOnlyChanged] = useState(true);
  const [signOffOpen, setSignOffOpen] = useState(false);
  const baseline = projectMeta.baseline;
  const comparison = useMemo(() => baselineComparison(engineResult.tasks, baseline), [engineResult.tasks, baseline]);

  if (!comparison) {
    return (
      <Page area="schedule">
        <EmptyState
          icon={Lock}
          title={t('schedule.baselineEmptyTitle')}
          body={t('schedule.baselineEmptyBody')}
          action={
            <Button variant="primary" onClick={() => setSignOffOpen(true)}>
              {t('schedule.signOff')}
            </Button>
          }
        />
        <SignOffDialog open={signOffOpen} onOpenChange={setSignOffOpen} />
      </Page>
    );
  }

  const { rows, totals } = comparison;
  const shown = onlyChanged ? rows.filter((r) => r.changed) : rows;
  const deltaTone = totals.deltaValue > 0 ? 'danger' : totals.deltaValue < 0 ? 'success' : undefined;

  return (
    <Page area="schedule">
      <p className={s.signed}>
        {baseline.signedBy
          ? t('schedule.baselineSigned', { date: formatDay((baseline.signedAt || '').slice(0, 10)), name: baseline.signedBy })
          : t('schedule.baselineSignedNoName', { date: formatDay((baseline.signedAt || '').slice(0, 10)) })}
      </p>
      <div className={s.stats}>
        <StatCard compact label={t('schedule.baselineValue')} value={compactCurrency(totals.baseValue, lang)} />
        <StatCard compact label={t('schedule.currentValue')} value={compactCurrency(totals.value, lang)} />
        <StatCard compact label={t('schedule.difference')} value={signedMoney(totals.deltaValue, lang)} tone={deltaTone} />
        <StatCard compact label={t('schedule.changedItems')} value={totals.changed} />
      </div>

      <div className={s.toolbar}>
        <Button size="sm" variant={onlyChanged ? 'outline' : 'secondary'} aria-pressed={onlyChanged} onClick={() => setOnlyChanged(!onlyChanged)}>
          {t('schedule.onlyChanged')}
        </Button>
      </div>

      {shown.length === 0 ? (
        <EmptyState title={t('schedule.noChanges')} />
      ) : (
        <Table minWidth={820} label={t('schedule.tabBaseline')}>
          <thead>
            <tr>
              <th>{t('gantt.colItem')}</th>
              <th className={s.num}>{t('schedule.colBaseQty')}</th>
              <th className={s.num}>{t('schedule.colQty')}</th>
              <th>{t('common.unit')}</th>
              <th className={s.num}>{t('schedule.colBasePrice')}</th>
              <th className={s.num}>{t('schedule.colPrice')}</th>
              <th className={s.num}>{t('schedule.colDelta')}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const qtyChanged = !r.isNew && r.baseQty !== r.qty;
              const priceChanged = !r.isNew && r.basePrice !== r.price;
              return (
                <tr key={r.task.id} className={cx(r.changed && s.changed)}>
                  <td>
                    <Link to={`/schedule/task/${encodeURIComponent(r.task.id)}`} className={s.item}>
                      <span className={cx(s.wbs, 'ui-ltr')}>{r.task.wbs}</span>
                      <span className={s.name}>{r.task.name}</span>
                    </Link>
                    {r.isNew && <StatusBadge tone="accent">{t('schedule.newItem')}</StatusBadge>}
                  </td>
                  <td className={s.num}>{r.isNew ? '—' : formatNumber(r.baseQty)}</td>
                  <td className={cx(s.num, qtyChanged && s.diff)}>{formatNumber(r.qty)}</td>
                  <td>{r.task.unit || ''}</td>
                  <td className={s.num}>{r.isNew ? '—' : compactCurrency(r.basePrice, lang)}</td>
                  <td className={cx(s.num, priceChanged && s.diff)}>{compactCurrency(r.price, lang)}</td>
                  <td className={cx(s.num, r.deltaValue > 0 && s.up, r.deltaValue < 0 && s.down)}>
                    {r.deltaValue === 0 ? '—' : signedMoney(r.deltaValue, lang)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Page>
  );
}
