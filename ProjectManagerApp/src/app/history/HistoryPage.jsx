import { Hammer } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n.js';
import { Card, EmptyState } from '../../ui/index.js';
import { Page } from '../Page.jsx';

/** Placeholder until H (history and accountability) builds this screen (plans/roadmap-plan.md). */
export default function HistoryPage() {
  const { t } = useI18n();
  return (
    <Page area="reports">
      <Card padding="md">
        <EmptyState icon={Hammer} title={t('history.title')} body={t('history.placeholder')} />
      </Card>
    </Page>
  );
}
