import { useI18n } from '../../i18n/useI18n.js';
import { StatusBadge } from '../../ui/index.js';

/** Draft / Issued pill. */
export function CertificateStatus({ status, size }) {
  const { t } = useI18n();
  return status === 'issued' ? (
    <StatusBadge tone="success" size={size}>
      {t('certificates.statusIssued')}
    </StatusBadge>
  ) : (
    <StatusBadge tone="warning" icon="dot" size={size}>
      {t('certificates.statusDraft')}
    </StatusBadge>
  );
}
