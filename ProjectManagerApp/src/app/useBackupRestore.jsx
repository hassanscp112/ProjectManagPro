import { useRef, useState } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import { isSignedIn } from '../sync/session.js';
import { exportAppData, readBackupFile, restoreAppData, validateBackup } from '../utils/DataIO';
import { ConfirmDialog, useToast } from '../ui/index.js';

// Give the browser a moment to take the safety download before reloading.
const SAFETY_DOWNLOAD_SETTLE_MS = 800;

/**
 * Backup download + restore (validate → confirm → safety copy of the current
 * data → write → reload). Returns { backup, restore, element } — render element.
 * Signed in to a server, the confirm says the restored data goes to the
 * server as edits by this person (recorded in the history).
 */
export function useBackupRestore() {
  const { t } = useI18n();
  const toast = useToast();
  const fileRef = useRef(null);
  const pendingRef = useRef(null);
  const [info, setInfo] = useState(null);

  const errorText = (err, fallback) => (err?.code ? t(`app.backup.err.${err.code}`) : t(fallback));

  const backup = async () => {
    try {
      const { filesSkipped } = await exportAppData();
      toast({ title: t('schedule.backupSaved') });
      if (filesSkipped) toast({ title: t('app.backup.filesSkipped'), tone: 'danger' });
    } catch {
      toast({ title: t('app.backup.exportFail'), tone: 'danger' });
    }
  };

  const onFile = async (event) => {
    const file = event.target.files && event.target.files[0];
    if (event.target) event.target.value = ''; // the same file can be chosen again
    if (!file) return;
    try {
      const parsed = await readBackupFile(file);
      const result = validateBackup(parsed);
      if (!result.ok) {
        toast({ title: t(`app.backup.err.${result.code}`), tone: 'danger' });
        return;
      }
      pendingRef.current = parsed;
      setInfo({ ...result.stats, signedIn: isSignedIn() });
    } catch (err) {
      toast({ title: errorText(err, 'app.modal.readFail'), tone: 'danger' });
    }
  };

  const confirmRestore = async () => {
    // A copy of what is here now, so a wrong backup file can be undone.
    try {
      const { filesSkipped } = await exportAppData({ label: 'before-restore' });
      if (filesSkipped) throw new Error('files skipped');
    } catch {
      toast({ title: t('app.backup.safetyFail'), tone: 'danger' });
      return;
    }
    toast({ title: t('app.backup.safetySaved') });
    try {
      await restoreAppData(pendingRef.current);
    } catch (err) {
      toast({ title: errorText(err, 'app.modal.restoreFail'), tone: 'danger' });
      return;
    }
    setTimeout(() => window.location.reload(), SAFETY_DOWNLOAD_SETTLE_MS);
  };

  const element = (
    <>
      <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} hidden />
      <ConfirmDialog
        open={Boolean(info)}
        onOpenChange={(open) => !open && setInfo(null)}
        title={t('app.modal.restoreTitle')}
        message={
          info
            ? `${t('app.modal.restoreText', { keys: info.keys, kb: (info.bytes / 1024).toFixed(0) })} ${
                info.files === null ? t('app.modal.restoreFilesKept') : t('app.modal.restoreFiles', { n: info.files })
              }${info.signedIn ? ` ${t('history.restoreBackupWarning')}` : ''}`
            : ''
        }
        confirmLabel={t('app.modal.restoreAction')}
        tone="danger"
        onConfirm={confirmRestore}
      />
    </>
  );

  return { backup, restore: () => fileRef.current?.click(), element };
}
