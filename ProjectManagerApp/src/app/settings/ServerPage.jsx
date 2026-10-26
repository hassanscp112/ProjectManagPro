import { Hammer } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n.js';
import { Card, EmptyState } from '../../ui/index.js';
import { Page } from '../Page.jsx';

/** Placeholder until F (accounts and sync) builds this screen (plans/roadmap-plan.md). */
export default function ServerPage() {
  const { t } = useI18n();
  return (
    <Page area="settings">
      <Card padding="md">
        <EmptyState icon={Hammer} title={t('account.tabServer')} body={t('account.placeholder')} />
      </Card>
    </Page>
  );
}
