import { Plus, RotateCcw } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { compactCurrency } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { attentionItems, indexTone, sectionProgress } from '../../state/homeModel.js';
import { latestOrder } from '../../state/orderForm.js';
import { useProject } from '../../state/projectContext.js';
import { todayStr } from '../../utils/OrderEngine.js';
import { Button, Card, ListRow, ProgressBar, StatCard, StatusBadge, cx, usePhone } from '../../ui/index.js';
import { Page } from '../Page.jsx';
import OrderRow from '../record/OrderRow.jsx';
import { formatDay, orderSubject, typeLabel } from '../record/orderMeta.js';
import { useOrderActions } from '../record/useApproval.jsx';
import { ltr } from '../bidi.js';
import SCurve from './SCurve.jsx';
import s from './Home.module.css';

const ATTENTION_LIMIT = 6;
const RECENT_LIMIT = 5;
const DOT = { overdue: s.dotOverdue, active: s.dotActive, upcoming: s.dotUpcoming };

const pct1 = (n) => `${(Number(n) || 0).toFixed(1)}%`;
const idx2 = (n) => (Number(n) || 0).toFixed(2);

/** / — where the project stands and what needs doing, at a glance. */
export default function HomePage() {
  const { t, lang } = useI18n();
  const phone = usePhone();
  const navigate = useNavigate();
  const { engineResult, orders } = useProject();
  const actions = useOrderActions();
  const today = todayStr();
  const evm = engineResult.evm;
  const hasEvm = Boolean(evm && evm.bac > 0);
  const money = (n) => (hasEvm ? compactCurrency(n, lang) : '—');

  const { counts, items } = useMemo(() => attentionItems(engineResult.tasks, today), [engineResult.tasks, today]);
  const sections = useMemo(() => sectionProgress(engineResult.perWbsEvm || []), [engineResult.perWbsEvm]);
  const recent = useMemo(
    () => [...orders].sort((a, b) => (b.recordedAt || '').localeCompare(a.recordedAt || '')).slice(0, RECENT_LIMIT),
    [orders]
  );
  const last = latestOrder(orders);

  const spiTone = indexTone(evm?.spi);
  const cpiTone = indexTone(evm?.cpi);
  const spiText = { success: t('dashboard.aheadOfSchedule'), warning: t('home.watch'), danger: t('dashboard.behindSchedule') }[spiTone];
  const deviation = Number(engineResult.projectDeviation) || 0;

  const itemSubtitle = ({ task, kind }) =>
    [
      task.isCritical ? t('home.critical') : null,
      kind === 'overdue'
        ? t('home.dueWas', { date: formatDay(task.endDate) })
        : kind === 'active'
          ? t('home.dueOn', { date: formatDay(task.endDate) })
          : t('home.startsOn', { date: formatDay(task.startDate) }),
      // Floor, not round: 99.99% must not read "100% done" on a task that isn't.
      t('home.pctDone', { pct: ltr(`${Math.floor((task.progress || 0) * 100)}%`) }),
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <Page area="home">
      <section className={s.kpis} aria-label={t('dashboard.evmTitle')}>
        <StatCard className={s.kpiFull} label={t('home.progressActual')} value={pct1(engineResult.projectTotalProgress)} footer={t('home.plannedOf', { value: ltr(pct1(engineResult.projectPlannedProgress)) })}>
          <ProgressBar value={engineResult.projectTotalProgress} marker={engineResult.projectPlannedProgress} label={t('home.progressActual')} />
        </StatCard>
        <StatCard
          compact={phone}
          label={t('home.spi')}
          value={hasEvm ? idx2(evm.spi) : '—'}
          tone={hasEvm ? spiTone : undefined}
          footer={t('home.deviation', { value: ltr(`${deviation > 0 ? '+' : ''}${deviation.toFixed(1)}`) })}
        >
          {hasEvm && <StatusBadge tone={spiTone}>{spiText}</StatusBadge>}
        </StatCard>
        <StatCard compact={phone} className={cx(s.kpiFull, s.kpiLast)} label={t('home.ev')} value={money(evm?.ev)} footer={t('home.ofBac', { bac: money(evm?.bac) })} />
        <StatCard compact={phone} label={t('home.cpi')} value={hasEvm ? idx2(evm.cpi) : '—'} tone={hasEvm ? cpiTone : undefined} footer={t('home.actualCost', { ac: money(evm?.ac) })}>
          {hasEvm && <StatusBadge tone={cpiTone}>{evm.cpi >= 1 ? t('dashboard.underBudget') : t('dashboard.overBudget')}</StatusBadge>}
        </StatCard>
      </section>

      {phone && last && (
        <button type="button" className={s.repeat} onClick={() => navigate('/record', { state: { repeatLast: true } })}>
          <span className={s.repeatIcon}>
            <RotateCcw size={20} aria-hidden="true" />
          </span>
          <span className={s.repeatText}>
            <span className={s.repeatTitle}>{t('record.repeatLast')}</span>
            <span className={s.repeatSub}>{[typeLabel(last.type), orderSubject(last)].filter(Boolean).join(' · ')}</span>
          </span>
        </button>
      )}

      <div className={s.row}>
        <Card className={s.narrow} title={t('home.attention')}>
          <div className={s.badgeRow} aria-label={t('home.statusCounts')}>
            <StatusBadge tone="danger" icon="dot">{t('home.countOverdue', { n: counts.overdue })}</StatusBadge>
            <StatusBadge tone="accent" icon="dot">{t('home.countActive', { n: counts.active })}</StatusBadge>
            <StatusBadge icon="dot">{t('home.countUpcoming', { n: counts.upcoming })}</StatusBadge>
            <StatusBadge tone="success">{t('home.countDone', { n: counts.completed })}</StatusBadge>
          </div>
          {items.length === 0 ? (
            <div>
              <p className={s.sectionName}>{t('home.allClear')}</p>
              <p className={s.muted}>{t('home.allClearBody')}</p>
            </div>
          ) : (
            <div className={s.list}>
              {items.slice(0, ATTENTION_LIMIT).map((item) => (
                <ListRow
                  key={item.task.id}
                  href={`#/schedule/task/${encodeURIComponent(item.task.id)}`}
                  leading={<span className={cx(s.dot, DOT[item.kind])} aria-hidden="true" />}
                  title={`${item.task.wbs || ''} ${item.task.name || ''}`.trim()}
                  subtitle={itemSubtitle(item)}
                />
              ))}
            </div>
          )}
          <a className={s.link} href="#/schedule">
            {items.length > ATTENTION_LIMIT ? t('home.moreInSchedule', { n: items.length - ATTENTION_LIMIT }) : t('home.openSchedule')}
          </a>
        </Card>

        <Card className={s.wide} title={t('dashboard.scurveTitle')} subtitle={t('dashboard.scurveSubtitle')}>
          <SCurve points={engineResult.sCurve} today={today} />
          {hasEvm && (
            <dl className={s.figures} aria-label={t('home.evmFigures')}>
              {[
                ['dashboard.evmBac', evm.bac],
                ['dashboard.evmPv', evm.pv],
                ['dashboard.evmEv', evm.ev],
                ['dashboard.evmAc', evm.ac],
                ['dashboard.evmEac', evm.eac],
                ['dashboard.evmVac', evm.vac],
              ].map(([key, value]) => (
                <div key={key} className={s.figure}>
                  <dt>{t(key)}</dt>
                  <dd>{compactCurrency(value, lang)}</dd>
                </div>
              ))}
            </dl>
          )}
        </Card>
      </div>

      <div className={s.row}>
        <Card className={s.half} title={t('home.sections')} subtitle={t('dashboard.wbsSubtitle')}>
          {sections.length === 0 ? (
            <p className={s.muted}>{t('dashboard.scurveEmpty')}</p>
          ) : (
            <div>
              {sections.map((row) => (
                <div key={row.wbs} className={s.section}>
                  <div className={s.sectionHead}>
                    <span className={s.sectionName}>
                      <span className="ui-ltr">{row.wbs}</span> · {row.name}
                    </span>
                    <span className={s.sectionPct}>{pct1(row.pct)}</span>
                  </div>
                  <ProgressBar value={row.pct} label={row.name} />
                  <div className={s.sectionMeta}>
                    <span>{t('home.sectionFigures', { ev: compactCurrency(row.ev, lang), bac: compactCurrency(row.bac, lang) })}</span>
                    <StatusBadge tone={indexTone(row.spi)} icon={false}>
                      SPI {idx2(row.spi)}
                    </StatusBadge>
                    <StatusBadge tone={indexTone(row.cpi)} icon={false}>
                      CPI {idx2(row.cpi)}
                    </StatusBadge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          className={s.half}
          title={t('home.recent')}
          actions={
            <Button as="a" href="#/record" size="sm" variant="ghost" icon={Plus}>
              {t('ui.recordOrder')}
            </Button>
          }
        >
          {recent.length === 0 ? (
            <p className={s.muted}>{t('home.recentEmpty')}</p>
          ) : (
            <div>
              {recent.map((o) => (
                <OrderRow key={o.id} order={o} onApprove={actions.approve} />
              ))}
            </div>
          )}
          <a className={s.link} href="#/record/log">
            {t('home.allOrders')}
          </a>
        </Card>
      </div>
      {actions.dialogs}
    </Page>
  );
}
