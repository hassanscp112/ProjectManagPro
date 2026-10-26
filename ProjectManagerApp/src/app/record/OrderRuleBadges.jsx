import { Lock } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n.js';
import { approvalBlock, orderLock } from '../../state/orderForm.js';
import { useProject } from '../../state/projectContext.js';
import { Button, StatusBadge, cx, usePhone } from '../../ui/index.js';
import { useActor } from '../useCan.js';
import { BLOCK_REASON, certificateHref, certificateLabel } from './orderRuleText.js';
import { useOrderCertificates } from './useOrderCertificates.js';
import s from './Record.module.css';

/**
 * Approve for one pending formal order — or, when this user may not
 * approve it (orderForm.approvalBlock), "Pending" and why: they recorded
 * it, their role, an issued certificate. On phones the reason is the
 * badge. badge={false}: the reason only (the log has a status column).
 */
export function ApproveButton({ order, onApprove, icon, badge = true }) {
  const { t } = useI18n();
  const phone = usePhone();
  const actor = useActor();
  const block = approvalBlock(order, actor, { certified: Boolean(orderLock(order, useOrderCertificates())) });
  if (!block) {
    return (
      <Button size="sm" variant="outline" icon={icon} onClick={() => onApprove(order)}>
        {t('common.approve')}
      </Button>
    );
  }
  const reason = t(BLOCK_REASON[block]);
  if (badge && phone) {
    return (
      <StatusBadge tone="warning" title={`${t('common.pending')} — ${reason}`}>
        {reason}
      </StatusBadge>
    );
  }
  return (
    <span className={s.blocked}>
      {badge && <StatusBadge tone="warning">{t('common.pending')}</StatusBadge>}
      <span className={s.blockReason}>{reason}</span>
    </span>
  );
}

/**
 * "In certificate No. N", linking to the certificate, for an order in an
 * issued payment certificate (nothing otherwise). Phones show "Cert. N";
 * the tooltip lists every certificate holding it.
 */
export function CertificateBadge({ order, className }) {
  const { t } = useI18n();
  const phone = usePhone();
  const { registries } = useProject();
  const refs = orderLock(order, useOrderCertificates());
  if (!refs) return null;
  const [first] = refs;
  const full = t(first.kind === 'employer' ? 'record.inCertificateMain' : 'record.inCertificate', { number: first.number });
  return (
    <a
      className={cx(s.certLink, className)}
      href={certificateHref(first)}
      title={refs.map((ref) => certificateLabel(t, ref, registries)).join(t('orders.listSep'))}
      aria-label={full}
    >
      <Lock size={12} aria-hidden="true" />
      {phone ? t('record.inCertificateShort', { number: first.number }) : full}
      {refs.length > 1 && (
        <span aria-hidden="true" className="ui-ltr">
          +{refs.length - 1}
        </span>
      )}
    </a>
  );
}
