import { useRef, useState } from 'react';
import { useI18n } from '../../i18n/useI18n.js';
import { exportAppData, readBackupFile, restoreAppData, validateBackup } from '../../utils/DataIO';
import { ConfirmDialog, useToast } from '../../ui/index.js';

/**
 * Backup download + restore (validate → confirm → write → reload), same
 * flow as before. Returns { backup, restore, element } — render element.
 */
export function useBackupRestore() {
  const { t } = useI18n();
  const toast = useToast();
  const fileRef = useRef(null);
  const pendingRef = useRef(null);
  const [info, setInfo] = useState(null);

  const backup = () => {
    exportAppData();
    toast({ title: t('schedule.backupSaved') });
  };

  const onFile = async (event) => {
    const file = event.target.files && event.target.files[0];
    if (event.target) event.target.value = ''; // the same file can be chosen again
    if (!file) return;
    try {
      const parsed = await readBackupFile(file);
      const result = validateBackup(parsed);
      if (!result.ok) {
        toast({ title: result.reason, tone: 'danger' });
        return;
      }
      pendingRef.current = parsed;
      setInfo(result.stats);
    } catch (err) {
      toast({ title: err.message || t('app.modal.readFail'), tone: 'danger' });
    }
  };

  const element = (
    <>
      <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} hidden />
      <ConfirmDialog
        open={Boolean(info)}
        onOpenChange={(open) => !open && setInfo(null)}
        title={t('app.modal.restoreTitle')}
        message={info ? t('app.modal.restoreText', { keys: info.keys, kb: (info.bytes / 1024).toFixed(0) }) : ''}
        confirmLabel={t('app.modal.restoreAction')}
        tone="danger"
        onConfirm={() => {
          try {
            restoreAppData(pendingRef.current);
            window.location.reload();
          } catch (err) {
            toast({ title: err.message || t('app.modal.restoreFail'), tone: 'danger' });
          }
        }}
      />
    </>
  );

  return { backup, restore: () => fileRef.current?.click(), element };
}
