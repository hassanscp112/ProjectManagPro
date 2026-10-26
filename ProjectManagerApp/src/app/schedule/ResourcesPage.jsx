import { Hammer } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n.js';
import { Card, EmptyState } from '../../ui/index.js';
import { Page } from '../Page.jsx';

/** Placeholder until P (planning) builds resources and leveling (plans/auto-planning-plan.md). */
export default function ResourcesPage() {
  const { t } = useI18n();
  return (
    <Page area="schedule">
      <Card padding="md">
        <EmptyState icon={Hammer} title={t('schedule.tabResources')} body={t('schedule.resourcesPlaceholder')} />
      </Card>
    </Page>
  );
}
