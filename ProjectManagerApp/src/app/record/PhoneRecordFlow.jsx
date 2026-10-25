import { ArrowLeft, Check, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/useI18n.js';
import { latestOrder, repeatOrderDraft } from '../../state/orderForm.js';
import { useProject } from '../../state/projectContext.js';
import { Button, IconButton, StatusBadge, cx, useToast } from '../../ui/index.js';
import { Page } from '../Page.jsx';
import { useShell } from '../shellContext.js';
import OrderForm from './OrderForm.jsx';
import OrderTypeCards from './OrderTypeCards.jsx';
import { orderFigure, orderSubject, savedMessage, typeLabel } from './orderMeta.js';
import { useOrderEntry } from './useOrderEntry.js';
import s from './Record.module.css';

/**
 * Phone: pick a type → fill the form (full screen, bottom bar hidden,
 * save button always reachable) → done, with one tap to record the
 * next one of the same type.
 */
export default function PhoneRecordFlow() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { orders, pendingApprovals } = useProject();
  const { setImmersive } = useShell();
  const entry = useOrderEntry();
  const [step, setStep] = useState('type');
  const [saved, setSaved] = useState(null);
  const last = latestOrder(orders);

  useEffect(() => {
    setImmersive(step !== 'type');
    return () => setImmersive(false);
  }, [step, setImmersive]);

  const open = (draftOrType) => {
    if (typeof draftOrType === 'string') entry.start(draftOrType);
    else entry.startFrom(draftOrType);
    setStep('form');
  };

  const backToTypes = () => {
    entry.clear();
    setStep('type');
  };

  if (step === 'type') {
    return (
      <Page area="record" tabCounts={{ '/record/pending': pendingApprovals }}>
        {last && (
          <button type="button" className={s.repeat} onClick={() => open(repeatOrderDraft(last))}>
            <span className={s.repeatIcon}>
              <RotateCcw size={20} aria-hidden="true" />
            </span>
            <span className={s.repeatText}>
              <span className={s.repeatTitle}>{t('record.repeatLast')}</span>
              <span className={s.repeatSub}>{[typeLabel(last.type), orderSubject(last)].filter(Boolean).join(' · ')}</span>
            </span>
          </button>
        )}
        <OrderTypeCards onSelect={open} compactExpenses />
      </Page>
    );
  }

  if (step === 'done' && saved) {
    const approved = saved.status === 'approved';
    return (
      <Page area="record" bare>
        <div className={s.done}>
          <span className={s.doneIcon}>
            <Check size={36} strokeWidth={2.4} aria-hidden="true" />
          </span>
          <h1 className={s.doneTitle}>{t('record.doneTitle')}</h1>
          <span>
            {typeLabel(saved.type)} · {orderFigure(saved, lang)}
          </span>
          <StatusBadge tone={approved ? 'success' : 'warning'} size="md">
            {approved ? t('record.doneApproved') : t('record.doneRecorded')}
          </StatusBadge>
        </div>
        <div className={s.doneActions}>
          <Button variant="primary" size="lg" block onClick={() => open(saved.type)}>
            {t('record.againSameType')}
          </Button>
          <Button size="lg" block onClick={backToTypes}>
            {t('record.otherType')}
          </Button>
          <Button as="a" variant="ghost" block href="#/">
            {t('record.backHome')}
          </Button>
        </div>
      </Page>
    );
  }

  const { spec } = entry;
  return (
    <Page area="record" bare>
      <form
        className={cx(s.groups, s.phoneForm)}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const order = entry.save();
          if (!order) return;
          toast({ title: savedMessage(t, order) });
          setSaved(order);
          setStep('done');
        }}
      >
        <div className={s.phoneHeader}>
          <IconButton icon={ArrowLeft} label={t('common.back')} onClick={backToTypes} className="ui-flip-rtl" />
          <div className={s.phoneTitles}>
            <h1 className={s.phoneTitle}>{spec?.label}</h1>
            {spec && (
              <StatusBadge tone={spec.tier === 'formal' ? 'warning' : 'success'}>
                {spec.tier === 'formal' ? t('record.tierFormal') : t('record.tierQuick')}
              </StatusBadge>
            )}
          </div>
        </div>
        <OrderForm entry={entry} size="lg" />
        <div className={s.saveBar}>
          <Button variant="primary" size="lg" block type="submit">
            {t('record.save')}
          </Button>
        </div>
      </form>
    </Page>
  );
}
