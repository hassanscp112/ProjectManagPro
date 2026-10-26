import { LogIn, LogOut, Server, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '../i18n/useI18n.js';
import { useProject } from '../state/projectContext.js';
import { renameMe, signOut } from '../sync/account.js';
import { isServerConfigured } from '../sync/serverConfig.js';
import { isSignedIn } from '../sync/session.js';
import { loadIdentity, loadLocalIdentity, saveIdentity } from '../utils/Identity.js';
import { Button, Dialog, Field, Input, StatusBadge } from '../ui/index.js';
import { useServerConfig, useSession, useSyncStatus } from './account/useAccount.js';
import a from './account/Account.module.css';

const ROLE_KEYS = [
  'registries.roleSiteEngineer',
  'registries.roleSiteManager',
  'registries.roleEngineer',
  'registries.roleSurveyor',
  'registries.roleInspector',
  'registries.roleAccountant',
  'registries.roleStorekeeper',
];

const STATE_TONE = { off: 'neutral', idle: 'success', syncing: 'accent', offline: 'warning', signedOut: 'warning', error: 'danger' };

/** Without an account: the local name + job title that stamp this device's records. */
function LocalForm({ onClose, onSaved }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const config = useServerConfig();
  const [draft, setDraft] = useState(loadLocalIdentity);
  const canSave = draft.name.trim() !== '';
  const save = () => {
    if (!canSave) return;
    onSaved(saveIdentity(draft));
    onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('registries.idpTitle')}
      description={t('registries.idpText')}
      footer={
        <>
          {isServerConfigured(config) && (
            <Button
              icon={LogIn}
              onClick={() => {
                onClose();
                navigate('/login');
              }}
            >
              {t('account.signInToServer')}
            </Button>
          )}
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!canSave} onClick={save}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <Field label={t('common.name')}>
        <Input data-autofocus value={draft.name} placeholder={t('registries.idpNamePh')} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && save()} />
      </Field>
      <Field label={t('settings.role')} optional>
        <Input list="identity-roles" value={draft.role} placeholder={t('registries.idpRolePh')} onChange={(e) => setDraft({ ...draft, role: e.target.value })} />
      </Field>
      <datalist id="identity-roles">
        {ROLE_KEYS.map((k) => (
          <option key={k} value={t(k)} />
        ))}
      </datalist>
    </Dialog>
  );
}

/** Signed in: who, where, the role here, sync status; rename, sign out. */
function AccountView({ onClose, onSaved }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { project } = useProject();
  const session = useSession();
  const status = useSyncStatus();
  const [name, setName] = useState(session.user?.name || '');
  const [jobTitle, setJobTitle] = useState(() => loadLocalIdentity().role);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const role = project?.serverId ? session.projectRoles[project.serverId] : null;
  const state = session.needsSignIn ? 'signedOut' : status.state;
  const go = (path) => {
    onClose();
    navigate(path);
  };
  const save = async () => {
    setBusy(true);
    setError('');
    if (name.trim() !== (session.user?.name || '')) {
      const res = await renameMe(name);
      if (!res.ok) {
        setBusy(false);
        setError(res.code);
        return;
      }
    }
    saveIdentity({ name: loadLocalIdentity().name || name, role: jobTitle });
    setBusy(false);
    onSaved(loadIdentity());
    onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('account.title')}
      description={`${t('account.signedInAs')} ${session.user?.email || ''}`}
      footer={
        <>
          <Button
            icon={LogOut}
            onClick={async () => {
              await signOut();
              go('/login');
            }}
          >
            {t('account.signOut')}
          </Button>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={busy || !name.trim()} onClick={save}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <Field label={t('account.name')} error={error ? t(`account.err.${error}`) : undefined}>
        <Input data-autofocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
      </Field>
      <Field label={t('settings.role')} optional>
        <Input list="identity-roles" value={jobTitle} placeholder={t('registries.idpRolePh')} onChange={(e) => setJobTitle(e.target.value)} />
      </Field>
      <datalist id="identity-roles">
        {ROLE_KEYS.map((k) => (
          <option key={k} value={t(k)} />
        ))}
      </datalist>
      <dl className={a.facts}>
        {session.org && (
          <>
            <dt>{t('account.org')}</dt>
            <dd>{session.org.name}</dd>
          </>
        )}
        <dt>{t('account.roleHere')}</dt>
        <dd>{role ? t(`account.role.${role}`) : t('account.localOnlyProject')}</dd>
        <dt>{t('account.syncTitle')}</dt>
        <dd>
          <StatusBadge tone={STATE_TONE[state] || 'neutral'} icon="dot">
            {t(`account.sync.${state}`)}
          </StatusBadge>
          {status.pending > 0 && ` ${t('account.syncPending', { n: status.pending })}`}
        </dd>
      </dl>
      <div className={a.serverLine}>
        <Button size="sm" variant="ghost" icon={Server} onClick={() => go('/settings/server')}>
          {t('account.openServer')}
        </Button>
        <Button size="sm" variant="ghost" icon={Users} onClick={() => go('/settings/users')}>
          {t('account.openUsers')}
        </Button>
      </div>
    </Dialog>
  );
}

/**
 * "Who is using the app?" — the account when signed in (name, role here,
 * sync, sign out), else the local name + job title (opens on first launch
 * when nobody is known). From the sidebar user, the phone More tab and
 * Settings.
 */
export default function IdentityDialog() {
  const { identityOpen, closeIdentity, onIdentitySaved } = useProject();
  const session = useSession();
  const config = useServerConfig();
  if (!identityOpen) return null;
  return isSignedIn(session, config) ? (
    <AccountView onClose={closeIdentity} onSaved={onIdentitySaved} />
  ) : (
    <LocalForm onClose={closeIdentity} onSaved={onIdentitySaved} />
  );
}
