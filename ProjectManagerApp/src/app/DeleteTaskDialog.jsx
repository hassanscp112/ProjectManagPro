import { useI18n } from '../i18n/useI18n.js';
import { useProject } from '../state/projectContext.js';
import { ConfirmDialog } from '../ui/index.js';

/**
 * Delete-task confirmation (opened by requestDeleteTask from the Gantt, the
 * task panel or task details). Says how many sub-items go with it and how
 * many dependencies get cleared. Stacks above an open side panel.
 */
export default function DeleteTaskDialog() {
  const { t, lang } = useI18n();
  const { taskToDelete, deletePreview, cancelDeleteTask, confirmDeleteTask } = useProject();
  const questionMark = lang === 'ar' ? '؟' : '?';
  const message = deletePreview
    ? [
        `${t('app.modal.deleteConfirm')} ${deletePreview.task?.wbs || t('app.modal.deleteThis')}${questionMark}`,
        deletePreview.count > 1 ? `${t('app.modal.deleteLinkedPrefix')} ${deletePreview.count} ${t('app.modal.deleteLinkedSuffix')}` : '',
        deletePreview.dependencyCount > 0 ? `${t('app.modal.deleteDepsPrefix')} ${deletePreview.dependencyCount} ${t('app.modal.deleteDepsSuffix')}` : '',
      ]
        .filter(Boolean)
        .join(' ')
    : '';
  return (
    <ConfirmDialog
      open={Boolean(taskToDelete)}
      onOpenChange={(open) => !open && cancelDeleteTask()}
      title={t('app.modal.deleteTitle')}
      message={message}
      confirmLabel={t('app.modal.deleteAction')}
      tone="danger"
      onConfirm={confirmDeleteTask}
    />
  );
}
