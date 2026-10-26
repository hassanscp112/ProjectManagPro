import { RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useI18n } from '../../i18n/useI18n.js';
import { latestOrder, ordersOnDay, pendingOrders, repeatOrderDraft } from '../../state/orderForm.js';
import { useProject } from '../../state/projectContext.js';
import { todayStr } from '../../utils/OrderEngine.js';
import { Button, Card, StatusBadge, usePhone, useToast } from '../../ui/index.js';
import { Page } from '../Page.jsx';
import OrderForm from './OrderForm.jsx';
import OrderRow from './OrderRow.jsx';
import OrderTypeCards from './OrderTypeCards.jsx';
import PhoneRecordFlow from './PhoneRecordFlow.jsx';
import { formatDay, savedMessage } from './orderMeta.js';
import { useOrderActions } from './useApproval.jsx';
import { draftFromNavigation, useOrderEntry } from './useOrderEntry.js';
import s from './Record.module.css';

const ASIDE_LIMIT = 5;

/** /record — the one place site reality is entered. Phone gets a full-screen flow. */
export default function RecordNewPage() {
  const phone = usePhone();
  return phone ? <PhoneRecordFlow /> : <DesktopRecord />;
}

function DesktopRecord() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { orders, tasks, pendingApprovals } = useProject();
  const [prefill] = useState(() => draftFromNavigation(location.state, { orders, tasks }));
  const entry = useOrderEntry(prefill);

  // Drop the one-shot request so Back / refresh don't reopen the form.
  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);
  const actions = useOrderActions();
  const { draft, spec, missing, showErrors, saving, photosBusy } = entry;
  const last = latestOrder(orders);
  const pending = pendingOrders(orders);
  const today = todayStr();
  const todays = ordersOnDay(orders, today);

  const saveAnd = async (next) => {
    const order = await entry.save();
    if (!order) return;
    toast({ title: savedMessage(t, order) });
    if (next === 'same') entry.start(order.type);
    else entry.clear();
  };

  return (
    <Page area="record" tabCounts={{ '/record/pending': pendingApprovals }}>
      <div className={s.split}>
        <Card
          className={s.main}
          title={t('record.whatToRecord')}
          actions={
            last && (
              <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => entry.startFrom(repeatOrderDraft(last))}>
                {t('record.repeatLast')}
              </Button>
            )
          }
        >
          <OrderTypeCards value={draft?.type} onSelect={(type) => (draft?.type === type ? entry.clear() : entry.start(type))} />

          {draft && spec && (
            <form
              className={s.groups}
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                saveAnd('same');
              }}
            >
              <div className={s.divider} />
              <div className={s.formHead}>
                <h3 className={s.formTitle}>{spec.label}</h3>
                <StatusBadge tone={spec.tier === 'formal' ? 'warning' : 'success'}>
                  {spec.tier === 'formal' ? t('record.tierFormal') : t('record.tierQuick')}
                </StatusBadge>
              </div>
              <OrderForm entry={entry} />
              {showErrors && missing.length > 0 && (
                <p role="alert" className={s.empty}>
                  {t('orders.fillRequired', { fields: missing.map((f) => f.label).join(t('orders.listSep')) })}
                </p>
              )}
              <div className={s.formFoot}>
                <span className={s.hint}>{t('record.enterHint')}</span>
                <Button variant="ghost" onClick={entry.clear}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={() => saveAnd('close')} disabled={saving || photosBusy}>
                  {t('record.save')}
                </Button>
                <Button variant="primary" type="submit" disabled={saving || photosBusy} aria-busy={saving || undefined}>
                  {saving ? t('record.saving') : photosBusy ? t('record.photosPreparing') : t('record.saveNext')}
                </Button>
              </div>
            </form>
          )}
        </Card>

        <aside className={s.aside} aria-label={t('record.today')}>
          <Card
            padding="md"
            title={t('record.tabPending')}
            actions={pending.length > 0 && <StatusBadge tone="warning">{pending.length}</StatusBadge>}
          >
            {pending.length === 0 ? (
              <p className={s.empty}>{t('record.pendingEmptyTitle')}</p>
            ) : (
              <div className={s.list}>
                {pending.slice(0, ASIDE_LIMIT).map((o) => (
                  <OrderRow key={o.id} order={o} onApprove={actions.approve} />
                ))}
                {pending.length > ASIDE_LIMIT && (
                  <a className={s.listMore} href="#/record/pending">
                    {t('record.showAll')}
                  </a>
                )}
              </div>
            )}
          </Card>

          <Card padding="md" title={t('record.today')} subtitle={formatDay(today)}>
            {todays.length === 0 ? (
              <p className={s.empty}>{t('record.todayEmpty')}</p>
            ) : (
              <div className={s.list}>
                {todays.slice(0, 8).map((o) => (
                  <OrderRow key={o.id} order={o} onApprove={actions.approve} showDate={false} />
                ))}
                <a className={s.listMore} href="#/record/log">
                  {t('record.tabLog')}
                </a>
              </div>
            )}
          </Card>
        </aside>
      </div>
      {actions.dialogs}
    </Page>
  );
}
