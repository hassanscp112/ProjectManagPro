import { CloudUpload, LogIn, LogOut, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '../../i18n/useI18n.js';
import { signOut } from '../../sync/account.js';
import { discardFailed, retryFailed, syncNow } from '../../sync/runtime.js';
import { isServerConfigured } from '../../sync/serverConfig.js';
import { isSignedIn } from '../../sync/session.js';
import { canUpload, localOnlyProjects, uploadDeviceData } from '../../sync/upload.js';
import { Button, Card, ConfirmDialog, StatusBadge, useToast } from '../../ui/index.js';
import { Page } from '../Page.jsx';
import ServerForm from '../account/ServerForm.jsx';
import { useServerConfig, useSession, useSyncStatus } from '../account/useAccount.js';
import a from '../account/Account.module.css';
import s from './Settings.module.css';

const STATE_TONE = { off: 'neutral', idle: 'success', syncing: 'accent', offline: 'warning', signedOut: 'warning', error: 'danger' };

const formatTime = (iso, lang) => {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-IQ' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
};

function AccountCard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const session = useSession();
  const config = useServerConfig();
  const status = useSyncStatus();
  const [confirm, setConfirm] = useState(false);
  if (!isServerConfigured(config)) return null;
  if (!isSignedIn(session, config)) {
    return (
      <Card title={t('account.title')} titleAs="h2" padding="md">
        <div className={s.rows}>
          <p className={s.muted}>{t('account.localLead')}</p>
          <div>
            <Button variant="primary" icon={LogIn} onClick={() => navigate('/login?next=/settings/server')}>
              {t('account.signInToServer')}
            </Button>
          </div>
        </div>
      </Card>
    );
  }
  return (
    <Card title={t('account.title')} titleAs="h2" padding="md">
      <div className={s.rows}>
        <dl className={a.facts}>
          <dt>{t('account.signedInAs')}</dt>
          <dd>
            {session.user.name} <span className={a.mono}>({session.user.email})</span>
          </dd>
          {session.org && (
            <>
              <dt>{t('account.org')}</dt>
              <dd>{session.org.name}</dd>
              <dt>{t('account.orgRole')}</dt>
              <dd>{t(`account.role.${session.org.role}`)}</dd>
            </>
          )}
        </dl>
        {session.needsSignIn && <p className={s.muted}>{t('account.signInAgainLead')}</p>}
        <div className={s.buttons}>
          {session.needsSignIn && (
            <Button variant="primary" icon={LogIn} onClick={() => navigate('/login?next=/settings/server')}>
              {t('account.signInAgain')}
            </Button>
          )}
          <Button icon={LogOut} onClick={() => setConfirm(true)}>
            {t('account.signOut')}
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t('account.signOutTitle')}
        message={t('account.signOutBody', { n: status.pending })}
        confirmLabel={t('account.signOut')}
        onConfirm={() => signOut().then(() => navigate('/login'))}
      />
    </Card>
  );
}

function SyncCard() {
  const { t, lang } = useI18n();
  const session = useSession();
  const config = useServerConfig();
  const status = useSyncStatus();
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  if (!isSignedIn(session, config)) return null;
  const state = session.needsSignIn ? 'signedOut' : status.state;
  const now = async () => {
    setBusy(true);
    await syncNow();
    setBusy(false);
  };
  return (
    <Card title={t('account.syncTitle')} titleAs="h2" padding="md">
      <div className={s.rows}>
        <div className={s.row}>
          <StatusBadge tone={STATE_TONE[state] || 'neutral'} icon="dot" size="md">
            {t(`account.sync.${state}`)}
          </StatusBadge>
          <span className={s.muted}>{status.lastSyncAt ? t('account.syncLast', { time: formatTime(status.lastSyncAt, lang) }) : t('account.syncNever')}</span>
        </div>
        {status.pending > 0 && <p className={s.muted}>{t('account.syncPending', { n: status.pending })}</p>}
        {state === 'error' && status.error && (
          <p className={a.error} dir="ltr">
            {status.error}
          </p>
        )}
        {status.failed > 0 && (
          <>
            <p className={a.error}>{t('account.syncFailed', { n: status.failed })}</p>
            <div className={s.buttons}>
              <Button size="sm" icon={RotateCcw} onClick={retryFailed}>
                {t('account.syncRetry')}
              </Button>
              <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setConfirmDiscard(true)}>
                {t('account.syncDiscard')}
              </Button>
            </div>
          </>
        )}
        <div>
          <Button icon={RefreshCw} onClick={now} disabled={busy}>
            {busy ? t('account.sync.syncing') : t('account.syncNow')}
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title={t('account.syncDiscardTitle')}
        message={t('account.syncDiscardBody')}
        confirmLabel={t('account.syncDiscard')}
        tone="danger"
        onConfirm={discardFailed}
      />
    </Card>
  );
}

function UploadCard() {
  const { t } = useI18n();
  const toast = useToast();
  const session = useSession();
  const config = useServerConfig();
  const [confirm, setConfirm] = useState(false);
  const [step, setStep] = useState('');
  const [error, setError] = useState('');
  if (!isSignedIn(session, config)) return null;
  const count = localOnlyProjects().length;
  const allowed = canUpload(session);
  const start = async () => {
    setError('');
    const result = await uploadDeviceData({ onStep: setStep });
    setStep('');
    if (!result.ok) {
      setError(result.code || 'uploadFailed');
      return;
    }
    toast({ title: t('account.uploadDone', { n: result.projects, pending: result.pending }) });
  };
  return (
    <Card title={t('account.uploadTitle')} titleAs="h2" padding="md">
      <div className={s.rows}>
        <p className={s.muted}>{t('account.uploadLead')}</p>
        <p className={s.label}>{count > 0 ? t('account.uploadCount', { n: count }) : t('account.uploadNone')}</p>
        {!allowed.ok && allowed.code === 'notAllowed' && <p className={s.muted}>{t('account.uploadNeedsRight')}</p>}
        {step && (
          <p className={a.steps} role="status">
            {t(`account.upload.${step}`)}
          </p>
        )}
        {error && (
          <p className={a.error} role="alert">
            {t(`account.err.${error}`)}
          </p>
        )}
        <div>
          <Button variant="primary" icon={CloudUpload} disabled={!allowed.ok || Boolean(step)} onClick={() => setConfirm(true)}>
            {t('account.uploadStart')}
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t('account.uploadConfirmTitle')}
        message={t('account.uploadConfirmBody', { n: count })}
        confirmLabel={t('account.uploadStart')}
        onConfirm={start}
      />
    </Card>
  );
}

/**
 * /settings/server — which server this device uses (device setting), the
 * signed-in account, sync status, and the first upload of this device's
 * data.
 */
export default function ServerPage() {
  const { t } = useI18n();
  const config = useServerConfig();
  return (
    <Page area="settings">
      <div className={s.grid}>
        <Card title={t('account.serverTitle')} titleAs="h2" padding="md">
          <div className={s.rows}>
            <p className={s.muted}>{isServerConfigured(config) ? t('account.serverLead') : t('account.serverNone')}</p>
            <ServerForm />
          </div>
        </Card>
        <AccountCard />
        <SyncCard />
        <UploadCard />
      </div>
    </Page>
  );
}
