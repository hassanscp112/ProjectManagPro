import { useI18n } from '../../i18n/useI18n.js';
import { useProject } from '../../state/projectContext.js';
import { resolveWhoLabel } from '../../utils/OrderEngine.js';
import { Trash2 } from 'lucide-react';
import { IconButton, ListRow, StatusBadge, cx } from '../../ui/index.js';
import { OrderPhotosButton } from './OrderPhotos.jsx';
import { TYPE_ICONS, formatDay, formatTime, orderFigure, orderSubject, typeLabel } from './orderMeta.js';
import { ApproveButton, CertificateBadge } from './OrderRuleBadges.jsx';
import s from './Record.module.css';

/**
 * One order as a list row: type icon, "type · subject", who and when
 * (plus "In certificate No. N" when an issued certificate holds it), then
 * the figure, a camera button when it has photos, and either an Approve
 * button (pending formal orders; or why this user may not) or its status.
 * onApprove omitted → status only; onDelete adds a delete button.
 */
export default function OrderRow({ order, onApprove, onDelete, showDate = true, flush = true }) {
  const { t, lang } = useI18n();
  const { registries } = useProject();
  const Icon = TYPE_ICONS[order.type];
  const pending = order.tier === 'formal' && order.status === 'recorded';
  const subject = orderSubject(order);
  const who = resolveWhoLabel(order.who, registries);
  const when = showDate ? `${formatDay(order.date)} · ${formatTime(order.recordedAt)}` : formatTime(order.recordedAt);
  return (
    <ListRow
      flush={flush}
      leading={
        <span className={cx(s.orderIcon, order.family === 'value' ? s.valueIcon : s.expenseIcon)}>
          {Icon && <Icon size={18} aria-hidden="true" />}
        </span>
      }
      title={subject ? `${typeLabel(order.type)} · ${subject}` : typeLabel(order.type)}
      subtitle={
        <>
          {[who !== '—' ? who : null, when].filter(Boolean).join(' · ')}
          <CertificateBadge order={order} className={s.rowCert} />
        </>
      }
      trailing={
        <>
          <span className={s.figure}>{orderFigure(order, lang)}</span>
          <OrderPhotosButton order={order} />
          {pending && onApprove ? (
            <ApproveButton order={order} onApprove={onApprove} />
          ) : pending ? (
            <StatusBadge tone="warning">{t('common.pending')}</StatusBadge>
          ) : null}
          {onDelete && <IconButton icon={Trash2} label={t('orders.deleteOrder')} size="sm" onClick={() => onDelete(order)} />}
        </>
      }
    />
  );
}
