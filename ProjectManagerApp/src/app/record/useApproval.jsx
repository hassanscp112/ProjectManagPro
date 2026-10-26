import { useState } from 'react';
import { useI18n } from '../../i18n/useI18n.js';
import { approvalBlock, orderLock } from '../../state/orderForm.js';
import { useProject } from '../../state/projectContext.js';
import { deleteFiles } from '../../utils/FileDB.js';
import { approveOrder, deleteOrder } from '../../utils/OrderEngine.js';
import { Button, ConfirmDialog, Dialog, Field, Input, useToast } from '../../ui/index.js';
import { useActor } from '../useCan.js';
import { formatDay, typeLabel } from './orderMeta.js';
import { BLOCK_REASON, certificateHref, certificateLabel } from './orderRuleText.js';
import { useOrderCertificates } from './useOrderCertificates.js';
import s from './Record.module.css';

/**
 * Approve and delete for orders: approving uses the current user's name,
 * or asks for an approver name when nobody is set; deleting always asks
 * first and also deletes the order's photos. Refused, with the reason:
 * approving one's own order or without the right (permissions), and
 * deleting or approving again an order in an issued payment certificate
 * (it is frozen). Render `dialogs`.
 */
export function useOrderActions() {
  const { t } = useI18n();
  const toast = useToast();
  const { identity, registries } = useProject();
  const actor = useActor();
  const certificates = useOrderCertificates();
  const [approveTarget, setApproveTarget] = useState(null);
  const [approverName, setApproverName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [locked, setLocked] = useState(null); // { refs, action: 'delete' | 'approve' }

  const approve = (order) => {
    const refs = orderLock(order, certificates);
    const block = approvalBlock(order, actor, { certified: Boolean(refs) });
    if (block === 'certified') {
      setLocked({ refs, action: 'approve' });
      return;
    }
    if (block) {
      toast({ title: t('record.notApproved'), description: t(`${BLOCK_REASON[block]}Body`), tone: 'info' });
      return;
    }
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

  const requestDelete = (order) => {
    const refs = orderLock(order, certificates);
    if (refs) setLocked({ refs, action: 'delete' });
    else setDeleteTarget(order);
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
      <Dialog
        open={Boolean(locked)}
        onOpenChange={(open) => !open && setLocked(null)}
        title={t('record.lockedTitle')}
        description={locked ? t(locked.action === 'delete' ? 'record.lockedDelete' : 'record.lockedApprove') : ''}
        footer={<Button onClick={() => setLocked(null)}>{t('common.close')}</Button>}
      >
        <p className={s.lockedIn}>{t('record.lockedIn')}</p>
        <ul className={s.lockedList}>
          {locked?.refs.map((ref) => (
            <li key={ref.id}>
              <a href={certificateHref(ref)} onClick={() => setLocked(null)}>
                {certificateLabel(t, ref, registries)}
              </a>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );

  return { approve, requestDelete, dialogs };
}
