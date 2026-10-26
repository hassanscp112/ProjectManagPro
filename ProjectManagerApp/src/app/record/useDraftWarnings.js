import { useMemo } from 'react';
import { formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { OUTLIER_FACTOR, draftWarnings } from '../../state/orderForm.js';
import { useProject } from '../../state/projectContext.js';
import { todayStr } from '../../utils/OrderEngine.js';
import { formatDay } from './orderMeta.js';

/** One warning from orderForm.draftWarnings → its sentence. */
const warningText = (t, w) => {
  const money = (n) => `${formatNumber(n)} ${t('orders.currencySuffix')}`;
  switch (w.code) {
    case 'duplicate':
      return t('record.warnDuplicate');
    case 'overLeft':
      return t(w.pending > 0 ? 'record.warnOverLeftPending' : 'record.warnOverLeft', {
        qty: formatNumber(w.qty),
        left: formatNumber(w.left),
        pending: formatNumber(w.pending),
        unit: w.unit || '',
      });
    case 'amountOutlier':
      return t('record.warnAmountOutlier', { amount: money(w.amount), median: money(w.median), factor: formatNumber(OUTLIER_FACTOR) });
    case 'futureDate':
      return t('record.warnFutureDate', { today: formatDay(w.today) });
    case 'beforeStart':
      return t('record.warnBeforeStart', { start: formatDay(w.start) });
    default:
      return w.code;
  }
};

/**
 * The open draft's warnings (things to check, never a block) as
 * [{ code, text }], plus `key`, which changes whenever they do — a
 * screen that asked "Save anyway?" asks again when the answer would differ.
 */
export function useDraftWarnings(draft) {
  const { t } = useI18n();
  const { orders, engineResult, projectStart } = useProject();
  const today = todayStr();
  const warnings = useMemo(
    () => draftWarnings(draft, { orders, tasks: engineResult.tasks, projectStart, today }),
    [draft, orders, engineResult.tasks, projectStart, today]
  );
  return useMemo(() => {
    const list = warnings.map((w) => ({ code: w.code, text: warningText(t, w) }));
    return { list, key: list.map((w) => w.text).join('\n') };
  }, [warnings, t]);
}
