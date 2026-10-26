import { PlugZap, RotateCcw, Save } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../../i18n/useI18n.js';
import { signOut } from '../../sync/account.js';
import { probeServer } from '../../sync/client.js';
import { pendingChanges } from '../../sync/runtime.js';
import { envServerDefaults, loadServerConfig, resetServerConfig, saveServerConfig, validateServerConfig } from '../../sync/serverConfig.js';
import { loadSession } from '../../sync/session.js';
import { Button, ConfirmDialog, Field, Input, StatusBadge } from '../../ui/index.js';
import s from './Account.module.css';

/**
 * The server address + public key for this device ('pm-server'): test it,
 * save it (signs out first when an account on another server is signed
 * in), or go back to the app's default. onSaved() runs after a save.
 */
export default function ServerForm({ onSaved = () => {} }) {
  const { t } = useI18n();
  const saved = loadServerConfig();
  const [draft, setDraft] = useState({ url: saved.url, anonKey: saved.anonKey });
  const [result, setResult] = useState(null); // { ok, code? }
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // { pending }
  const defaults = envServerDefaults();
  const changed = draft.url.trim() !== saved.url || draft.anonKey.trim() !== saved.anonKey;

  const check = () => {
    const verdict = validateServerConfig(draft);
    setResult(verdict.ok ? null : verdict);
    return verdict.ok;
  };

  const test = async () => {
    if (!check()) return;
    setBusy(true);
    setResult(await probeServer({ url: draft.url.trim(), anonKey: draft.anonKey.trim() }));
    setBusy(false);
  };

  const store = async () => {
    setConfirm(null);
    setBusy(true);
    if (loadSession().mode === 'account') await signOut();
    saveServerConfig(draft);
    setBusy(false);
    setResult({ ok: true, saved: true });
    onSaved();
  };

  const save = async () => {
    if (!check()) return;
    const session = loadSession();
    if (session.mode === 'account' && session.user && draft.url.trim() !== saved.url) {
      const pending = (await pendingChanges()).length;
      setConfirm({ pending });
      return;
    }
    store();
  };

  const useDefault = async () => {
    if (loadSession().mode === 'account') await signOut();
    const next = resetServerConfig();
    setDraft({ url: next.url, anonKey: next.anonKey });
    setResult(null);
    onSaved();
  };

  return (
    <form
      className={s.form}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Field label={t('account.serverUrl')} error={result?.code === 'url' || result?.code === 'https' ? t(`account.err.${result.code}`) : undefined}>
        <Input
          type="url"
          inputMode="url"
          dir="ltr"
          autoComplete="url"
          spellCheck={false}
          placeholder={t('account.serverUrlPh')}
          value={draft.url}
          onChange={(e) => setDraft({ ...draft, url: e.target.value })}
        />
      </Field>
      <Field label={t('account.serverKey')} hint={t('account.serverKeyHint')} error={result?.code === 'key' ? t('account.err.key') : undefined}>
        <Input dir="ltr" autoComplete="off" spellCheck={false} value={draft.anonKey} onChange={(e) => setDraft({ ...draft, anonKey: e.target.value })} />
      </Field>
      {saved.source !== 'none' && !changed && (
        <StatusBadge tone="neutral" icon="dot">
          {t(saved.source === 'build' ? 'account.serverFromBuild' : 'account.serverFromDevice')}
        </StatusBadge>
      )}
      {result?.ok && (
        <p className={s.ok} role="status">
          {t(result.saved ? 'account.serverSaved' : 'account.serverOk')}
        </p>
      )}
      {result && !result.ok && !['url', 'https', 'key'].includes(result.code) && (
        <p className={s.error} role="alert">
          {t(`account.err.${result.code}`)}
        </p>
      )}
      <div className={s.serverLine}>
        <Button icon={PlugZap} onClick={test} disabled={busy}>
          {t('account.serverTest')}
        </Button>
        <Button type="submit" variant="primary" icon={Save} disabled={busy || !changed}>
          {t('account.serverSave')}
        </Button>
        {defaults.url && saved.source === 'device' && (
          <Button variant="ghost" icon={RotateCcw} onClick={useDefault} disabled={busy}>
            {t('account.serverDefault')}
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('account.serverChangeTitle')}
        message={`${t('account.serverChangeBody')}${confirm?.pending ? ` ${t('account.serverPendingBody', { n: confirm.pending })}` : ''}`}
        confirmLabel={t('account.serverSave')}
        onConfirm={store}
      />
    </form>
  );
}
