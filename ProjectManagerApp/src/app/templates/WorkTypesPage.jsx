import { Hammer } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n.js';
import { Card, EmptyState } from '../../ui/index.js';
import { Page } from '../Page.jsx';

/** Placeholder until P (planning) builds the work-type library (plans/auto-planning-plan.md). */
export default function WorkTypesPage() {
  const { t } = useI18n();
  return (
    <Page area="work-types">
      <Card padding="md">
        <EmptyState icon={Hammer} title={t('templates.navWorkTypes')} body={t('templates.workTypesPlaceholder')} />
      </Card>
    </Page>
  );
}
