import { useEffect, useMemo, useState } from 'react';
import { formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { delaysInMonth } from '../../state/diaryModel.js';
import { DELAYS_STORAGE_KEY, loadDelays } from '../../utils/Delays.js';
import { todayStr } from '../../utils/OrderEngine.js';
import { onStoreChange } from '../../utils/storeEvents.js';
import { formatDay } from '../record/orderMeta.js';
import { SheetSection } from './ReportSheet.jsx';
import d from './Diary.module.css';
import s from './Reports.module.css';

/**
 * "Delays this month" in the monthly report: the delay events that touch
 * the month, the part inside it, and the month's delay days (a day under
 * two events counts once). Read-only; the register is #/reports/delays.
 */
export function MonthDelaysSection({ month }) {
  const { t } = useI18n();
  const [state, setState] = useState(loadDelays);
  useEffect(() => onStoreChange((key) => key === DELAYS_STORAGE_KEY && setState(loadDelays())), []);
  const r = useMemo(() => delaysInMonth(state.events, month, todayStr()), [state.events, month]);

  return (
    <SheetSection title={t('diary.monthDelaysTitle')}>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>{t('diary.colEvent')}</th>
              <th>{t('diary.colPeriod')}</th>
              <th className={s.num}>{t('diary.colDaysInMonth')}</th>
              <th>{t('diary.excusableLabel')}</th>
              <th>{t('common.status')}</th>
              <th className={s.num}>{t('diary.colClaim')}</th>
            </tr>
          </thead>
          <tbody>
            {r.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className={s.empty}>
                  {t('diary.monthDelaysEmpty')}
                </td>
              </tr>
            ) : (
              r.rows.map(({ event: e, span, days }) => (
                <tr key={e.id}>
                  <td>
                    <span className={d.eventTitle}>{e.title}</span>
                    <span className={d.eventMeta}>{t(`diary.cause.${e.cause}`)}</span>
                  </td>
                  <td className={s.num}>{`${formatDay(span.start)} – ${formatDay(span.end)}${e.end ? '' : ` (${t('diary.ongoing')})`}`}</td>
                  <td className={s.num}>{formatNumber(days)}</td>
                  <td>{e.excusable ? t('diary.excusable') : t('diary.notExcusable')}</td>
                  <td>{t(`diary.status.${e.status}`)}</td>
                  <td className={s.num}>{`${formatNumber(e.daysClaimed)} / ${e.status === 'granted' ? formatNumber(e.daysGranted) : '—'}`}</td>
                </tr>
              ))
            )}
          </tbody>
          {r.rows.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={2}>{t('diary.totalDays')}</td>
                <td className={s.num}>{formatNumber(r.days)}</td>
                <td>{`${t('diary.excusableDays')}: ${formatNumber(r.excusableDays)}`}</td>
                <td />
                <td className={s.num}>{`${formatNumber(r.claimed)} / ${formatNumber(r.granted)}`}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </SheetSection>
  );
}
