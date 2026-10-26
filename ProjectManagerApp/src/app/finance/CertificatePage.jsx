import { Hammer } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n.js';
import { Card, EmptyState } from '../../ui/index.js';
import { Page } from '../Page.jsx';

/** Placeholder until WS3 (payment certificates) builds this screen (plans/roadmap-plan.md). */
export default function CertificatePage() {
  const { t } = useI18n();
  return (
    <Page area="finance">
      <Card padding="md">
        <EmptyState icon={Hammer} title={t('certificates.tab')} body={t('certificates.placeholder')} />
      </Card>
    </Page>
  );
}
