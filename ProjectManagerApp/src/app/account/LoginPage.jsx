import { Hammer } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n.js';
import { Card, EmptyState } from '../../ui/index.js';

/** Placeholder until F (accounts and sync) builds sign-in (plans/roadmap-plan.md). */
export default function LoginPage() {
  const { t } = useI18n();
  return (
    <main id="main" style={{ maxInlineSize: '28rem', marginInline: 'auto', padding: 'var(--ui-space-5) var(--ui-space-4)' }}>
      <Card padding="md" title={t('account.loginTitle')} titleAs="h1">
        <EmptyState icon={Hammer} title={t('account.loginTitle')} body={t('account.placeholder')} />
      </Card>
    </main>
  );
}
