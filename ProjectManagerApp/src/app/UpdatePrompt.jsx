import { RefreshCw, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useI18n } from '../i18n/useI18n.js';
import { Button, IconButton, cx, useToast } from '../ui/index.js';
import s from './UpdatePrompt.module.css';

// Phones keep the app open for days, so look for a new version every hour.
const UPDATE_CHECK_MS = 60 * 60 * 1000;

const checkForUpdates = (registration) => {
  if (navigator.onLine) registration.update().catch(() => {});
};

/**
 * The installed app's service worker (vite-plugin-pwa, builds only; in dev
 * the hook is a stub). A new version waits until the user taps Reload —
 * never on its own, because reloading would lose a half-filled order. The
 * first install says once that the app now works offline.
 */
export default function UpdatePrompt() {
  const { t } = useI18n();
  const toast = useToast();
  const announced = useRef(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => checkForUpdates(registration), UPDATE_CHECK_MS);
    },
  });

  useEffect(() => {
    if (!offlineReady || announced.current) return;
    announced.current = true;
    toast({ title: t('app.update.offlineReady') });
  }, [offlineReady, toast, t]);

  if (!needRefresh) return null;
  return (
    <div className={cx('ui-no-print', s.banner)} role="status">
      <RefreshCw size={18} aria-hidden="true" className={s.icon} />
      <span className={s.text}>{t('app.update.ready')}</span>
      <Button size="sm" variant="primary" onClick={() => updateServiceWorker(true)}>
        {t('app.update.reload')}
      </Button>
      <IconButton icon={X} label={t('app.update.later')} size="sm" onClick={() => setNeedRefresh(false)} />
    </div>
  );
}
