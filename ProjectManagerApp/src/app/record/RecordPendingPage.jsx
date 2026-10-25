import { Inbox } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n.js';
import { pendingOrders } from '../../state/orderForm.js';
import { useProject } from '../../state/projectContext.js';
import { Card, EmptyState } from '../../ui/index.js';
import { Page } from '../Page.jsx';
import OrderRow from './OrderRow.jsx';
import { useOrderActions } from './useApproval.jsx';
import s from './Record.module.css';

/** /record/pending — formal orders waiting for someone to approve them. */
export default function RecordPendingPage() {
  const { t } = useI18n();
  const { orders, pendingApprovals } = useProject();
  const actions = useOrderActions();
  const pending = pendingOrders(orders);
  return (
    <Page area="record" tabCounts={{ '/record/pending': pendingApprovals }}>
      <Card title={t('record.tabPending')} subtitle={t('orders.logCount', { count: pending.length })}>
        {pending.length === 0 ? (
          <EmptyState icon={Inbox} title={t('record.pendingEmptyTitle')} body={t('record.pendingEmptyBody')} />
        ) : (
          <div className={s.list}>
            {pending.map((o) => (
              <OrderRow key={o.id} order={o} onApprove={actions.approve} onDelete={actions.requestDelete} />
            ))}
          </div>
        )}
      </Card>
      {actions.dialogs}
    </Page>
  );
}
