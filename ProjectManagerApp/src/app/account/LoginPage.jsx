import { Building2, HardHat, LogIn, RefreshCw, Server, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useI18n } from '../../i18n/useI18n.js';
import { createOrganization, refreshAccount, signIn, signUp } from '../../sync/account.js';
import { isServerConfigured } from '../../sync/serverConfig.js';
import { chooseLocalMode, isSignedIn, loadSession } from '../../sync/session.js';
import { Button, Card, Field, Input, Segmented, cx } from '../../ui/index.js';
import s from './Account.module.css';
import ServerForm from './ServerForm.jsx';
import { useServerConfig } from './useAccount.js';

/** Where to go after signing in: the page that sent us here, else the projects. */
const safeNext = (next) => (next && next.startsWith('/') && !next.startsWith('/login') && !next.startsWith('//') ? next : '/projects');

/** After signing in: into the app, or set up / wait for the organization. */
const stepAfter = (session) => (session.org ? 'done' : session.hasOrg === false ? 'setup' : 'wait');

/**
 * #/login — sign in or create an account on the server set for this
 * device (address editable here, since no project is open yet), set up the
 * company on a new server, or keep using the app without an account.
 */
export default function LoginPage() {
  const { t, lang, setLang, languages } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const config = useServerConfig();
  const configured = isServerConfigured(config);
  const [mode, setMode] = useState(() => {
    const session = loadSession();
    return isSignedIn(session) ? stepAfter(session) : 'signin';
  });
  const [showServer, setShowServer] = useState(!configured);
  const [form, setForm] = useState({ name: '', email: loadSession().user?.email || '', password: '', org: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    document.title = `${t(mode === 'signup' ? 'account.signupTitle' : 'account.loginTitle')} · ${t('projects.appName')}`;
  }, [t, mode]);

  useEffect(() => {
    if (mode === 'done') navigate(next, { replace: true });
  }, [mode, navigate, next]);

  const run = async (fn) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      if (mode === 'signup') {
        const result = await signUp(form);
        if (!result.ok) return setError(result.code);
        if (result.confirm) {
          setMode('signin');
          setNotice(t('account.confirmSent'));
          return;
        }
        setMode(stepAfter(result.session));
        return;
      }
      const result = await signIn(form);
      if (!result.ok) return setError(result.code);
      setMode(stepAfter(result.session));
    });
  };

  const setup = (e) => {
    e.preventDefault();
    run(async () => {
      const result = await createOrganization(form.org);
      if (!result.ok) return setError(result.code);
      setMode(stepAfter(loadSession()));
    });
  };

  const checkAgain = () =>
    run(async () => {
      const result = await refreshAccount();
      if (!result.ok) return setError(result.code);
      setMode(stepAfter(result.session));
    });

  const useLocal = () => {
    chooseLocalMode();
    navigate(next, { replace: true });
  };

  const field = (key) => ({ value: form[key], onChange: (e) => setForm({ ...form, [key]: e.target.value }) });
  const errorBox = error ? (
    <p className={s.error} role="alert">
      {t(`account.err.${error}`)}
    </p>
  ) : null;

  return (
    <main id="main" className={cx('ui-root', s.loginPage)}>
      <div className={s.loginColumn}>
        <div className={s.brand}>
          <span className={s.brandMark} aria-hidden="true">
            <HardHat size={24} />
          </span>
          <h1 className={s.brandTitle}>{t('projects.appName')}</h1>
        </div>

        {(mode === 'signin' || mode === 'signup') && (
          <Card padding="md" title={t(mode === 'signup' ? 'account.signupTitle' : 'account.loginTitle')} titleAs="h2">
            <form className={s.form} onSubmit={submit}>
              <p className={s.lead}>{t('account.loginLead')}</p>
              {notice && (
                <p className={s.ok} role="status">
                  {notice}
                </p>
              )}
              {mode === 'signup' && (
                <Field label={t('account.name')}>
                  <Input autoComplete="name" placeholder={t('account.namePh')} required {...field('name')} />
                </Field>
              )}
              <Field label={t('account.email')}>
                <Input type="email" dir="ltr" autoComplete="username" inputMode="email" required data-autofocus {...field('email')} />
              </Field>
              <Field label={t('account.password')} hint={mode === 'signup' ? t('account.passwordHint') : undefined}>
                <Input type="password" dir="ltr" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={mode === 'signup' ? 8 : undefined} {...field('password')} />
              </Field>
              {errorBox}
              <Button type="submit" variant="primary" size="lg" block icon={mode === 'signup' ? UserPlus : LogIn} disabled={busy || !configured}>
                {busy ? t('account.working') : t(mode === 'signup' ? 'account.signUp' : 'account.signIn')}
              </Button>
              <Button
                variant="ghost"
                className={s.linkButton}
                onClick={() => {
                  setMode(mode === 'signup' ? 'signin' : 'signup');
                  setError('');
                }}
              >
                {t(mode === 'signup' ? 'account.toSignIn' : 'account.toSignUp')}
              </Button>
            </form>
          </Card>
        )}

        {mode === 'setup' && (
          <Card padding="md" title={t('account.setupTitle')} titleAs="h2">
            <form className={s.form} onSubmit={setup}>
              <p className={s.lead}>{t('account.setupLead')}</p>
              <Field label={t('account.orgName')}>
                <Input required data-autofocus {...field('org')} />
              </Field>
              {errorBox}
              <Button type="submit" variant="primary" size="lg" block icon={Building2} disabled={busy || !form.org.trim()}>
                {busy ? t('account.working') : t('account.setupCreate')}
              </Button>
            </form>
          </Card>
        )}

        {mode === 'wait' && (
          <Card padding="md" title={t('account.waitTitle')} titleAs="h2">
            <div className={s.form}>
              <p className={s.lead}>{t('account.waitLead', { email: loadSession().user?.email || '' })}</p>
              {errorBox}
              <Button variant="primary" block icon={RefreshCw} onClick={checkAgain} disabled={busy}>
                {busy ? t('account.working') : t('account.checkAgain')}
              </Button>
              <Button variant="ghost" className={s.linkButton} onClick={() => navigate(next, { replace: true })}>
                {t('account.continueLocal')}
              </Button>
            </div>
          </Card>
        )}

        <Card padding="md" title={t('account.serverTitle')} titleAs="h2">
          {showServer ? (
            <ServerForm onSaved={() => setShowServer(false)} />
          ) : (
            <div className={s.serverLine}>
              <span className={s.serverHost} dir="ltr">
                {config.url}
              </span>
              <Button size="sm" icon={Server} onClick={() => setShowServer(true)}>
                {t('account.serverChange')}
              </Button>
            </div>
          )}
        </Card>

        {(mode === 'signin' || mode === 'signup') && (
          <Button variant="ghost" className={s.linkButton} onClick={useLocal}>
            {t('account.useLocal')}
          </Button>
        )}

        <div className={s.languages}>
          <Segmented label={t('account.language')} value={lang} onChange={setLang} options={languages.map((l) => ({ value: l.code, label: l.label }))} />
        </div>
      </div>
    </main>
  );
}
