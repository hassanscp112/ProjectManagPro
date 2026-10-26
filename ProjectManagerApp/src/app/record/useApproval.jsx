import { useState } from 'react';
import { useI18n } from '../../i18n/useI18n.js';
import { useProject } from '../../state/projectContext.js';
import { deleteFiles } from '../../utils/FileDB.js';
import { approveOrder, deleteOrder } from '../../utils/OrderEngine.js';
import { Button, ConfirmDialog, Dialog, Field, Input, useToast } from '../../ui/index.js';
import { formatDay, typeLabel } from './orderMeta.js';

/**
 * Approve and delete for orders, with the same rules as before:
 * approving uses the current user's name, or asks for an approver name
 * when nobody is set; deleting always asks first and also deletes the
 * order's photos. Render `dialogs`.
 */
export function useOrderActions() {
  const { t } = useI18n();
  const toast = useToast();
  const { identity } = useProject();
  const [approveTarget, setApproveTarget] = useState(null);
  const [approverName, setApproverName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const approve = (order) => {
    if (identity?.name) {
      approveOrder(order.id, identity.name);
      toast({ title: t('record.approved') });
    } else {
      setApproverName('');
      setApproveTarget(order);
    }
  };

  const confirmApprove = () => {
    if (!approveTarget) return;
    approveOrder(approveTarget.id, approverName);
    setApproveTarget(null);
    toast({ title: t('record.approved') });
  };

  const dialogs = (
    <>
      <Dialog
        open={Boolean(approveTarget)}
        onOpenChange={(open) => !open && setApproveTarget(null)}
        title={t('orders.approveOrder')}
        description={
          approveTarget ? t('orders.approveText', { type: typeLabel(approveTarget.type), date: formatDay(approveTarget.date) }) : ''
        }
        footer={
          <>
            <Button onClick={() => setApproveTarget(null)}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={confirmApprove}>
              {t('common.approve')}
            </Button>
          </>
        }
      >
        <Field label={t('record.approverLabel')}>
          <Input
            data-autofocus
            value={approverName}
            placeholder={t('orders.approverPlaceholder')}
            onChange={(e) => setApproverName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && confirmApprove()}
          />
        </Field>
      </Dialog>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('orders.deleteConfirmTitle')}
        message={
          deleteTarget
            ? [
                t('orders.deleteConfirmText', {
                  type: typeLabel(deleteTarget.type),
                  date: formatDay(deleteTarget.date),
                  taskRef: deleteTarget.taskName ? ` (${deleteTarget.taskWbs} ${deleteTarget.taskName})` : '',
                }),
                deleteTarget.evidence?.length ? t('orders.deleteConfirmPhotos', { n: deleteTarget.evidence.length }) : '',
              ]
                .filter(Boolean)
                .join(' ')
            : ''
        }
        confirmLabel={t('orders.deleteOrder')}
        tone="danger"
        onConfirm={() => {
          deleteOrder(deleteTarget.id);
          // Its photos go too; a failure only leaves files behind in "Order photos".
          if (deleteTarget.evidence?.length) deleteFiles(deleteTarget.evidence).catch(() => {});
          toast({ title: t('record.deleted') });
        }}
      />
    </>
  );

  return { approve, requestDelete: setDeleteTarget, dialogs };
}
