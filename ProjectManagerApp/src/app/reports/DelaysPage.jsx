import { Hammer } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n.js';
import { Card, EmptyState } from '../../ui/index.js';
import { Page } from '../Page.jsx';

/** Placeholder until WS4 (site diary and delays) builds this screen (plans/roadmap-plan.md). */
export default function DelaysPage() {
  const { t } = useI18n();
  return (
    <Page area="reports">
      <Card padding="md">
        <EmptyState icon={Hammer} title={t('diary.delaysTab')} body={t('diary.delaysPlaceholder')} />
      </Card>
    </Page>
  );
}
