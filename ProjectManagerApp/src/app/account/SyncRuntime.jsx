import { useEffect, useRef } from 'react';
import { useI18n } from '../../i18n/useI18n.js';
import { onSyncEvent, startSync } from '../../sync/runtime.js';
import { SERVER_STORAGE_KEY } from '../../sync/serverConfig.js';
import { needsLogin, SESSION_STORAGE_KEY } from '../../sync/session.js';
import { useToast } from '../../ui/index.js';
import { onStoreChange } from '../../utils/storeEvents.js';

// Routes reachable without signing in.
const OPEN_PATHS = ['/login'];
const NOTICE_GAP_MS = 6000;

/**
 * Mounted once beside the router (App.jsx): starts sync in this tab, sends
 * every route to #/login while a server is set and nobody is signed in
 * (unless "use without an account" was chosen), and turns sync events
 * into short notices.
 */
export default function SyncRuntime({ router }) {
  const { t } = useI18n();
  const toast = useToast();
  const lastNotice = useRef({});

  useEffect(() => startSync(), []);

  useEffect(() => {
    // Only between navigations: navigating while one is loading would
    // notify this listener again before the location changed.
    const check = (state = router.state) => {
      if (state.navigation.state !== 'idle') return;
      const { pathname, search } = state.location;
      if (!needsLogin() || OPEN_PATHS.includes(pathname)) return;
      router.navigate(`/login?next=${encodeURIComponent(pathname + search)}`, { replace: true });
    };
    check();
    const offRouter = router.subscribe((state) => check(state));
    const offStore = onStoreChange((key) => (key === SESSION_STORAGE_KEY || key === SERVER_STORAGE_KEY) && check());
    return () => {
      offRouter();
      offStore();
    };
  }, [router]);

  useEffect(
    () =>
      onSyncEvent((event) => {
        const notices = {
          denied: () => ({ title: event.fromServer ? t('account.noticeDeniedServer', { n: event.count }) : t('account.noticeDenied'), tone: 'danger' }),
          overruled: () => ({ title: t('account.noticeOverruled', { n: event.count }), tone: 'info' }),
          ignored: () => ({ title: t('account.noticeIgnored'), tone: 'info' }),
          signedOut: () => ({ title: t('account.noticeSignedOut'), tone: 'info' }),
        };
        if (!notices[event.type]) return;
        const now = Date.now();
        if (now - (lastNotice.current[event.type] || 0) < NOTICE_GAP_MS) return;
        lastNotice.current[event.type] = now;
        toast(notices[event.type]());
      }),
    [t, toast]
  );

  return null;
}
