// App-wide dialogs carried over unchanged from the old App.jsx (legacy
// markup and classes from App.css). Replaced by src/ui dialogs when the
// screens that open them are rebuilt (Phase 4).

import IdentityPicker from '../../components/registries/IdentityPicker';
import { useI18n } from '../../i18n/useI18n.js';
import { useProject } from '../../state/projectContext.js';

/** Delete-task confirmation, opened from the Gantt grid and task details. */
export function LegacyDeleteTaskDialog() {
  const { t } = useI18n();
  const { taskToDelete, deletePreview, cancelDeleteTask, confirmDeleteTask } = useProject();
  if (!taskToDelete) return null;
  return (
    <div className="modal-overlay" onClick={cancelDeleteTask}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon">!</div>
        <h3 className="modal-title">{t('app.modal.deleteTitle')}</h3>
        <p className="modal-text">
          {t('app.modal.deleteConfirm')} {deletePreview?.task?.wbs || t('app.modal.deleteThis')}؟
          {deletePreview?.count > 1 && ` ${t('app.modal.deleteLinkedPrefix')} ${deletePreview.count} ${t('app.modal.deleteLinkedSuffix')}`}
          {deletePreview?.dependencyCount > 0 &&
            ` ${t('app.modal.deleteDepsPrefix')} ${deletePreview.dependencyCount} ${t('app.modal.deleteDepsSuffix')}`}
        </p>
        <div className="modal-actions">
          <button className="apple-btn secondary" onClick={cancelDeleteTask}>
            {t('common.cancel')}
          </button>
          <button className="apple-btn destructive" onClick={confirmDeleteTask}>
            {t('app.modal.deleteAction')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** "Who is using the app?" — opens on first launch and from the sidebar. */
export function LegacyIdentityDialog() {
  const { identityOpen, closeIdentity, onIdentitySaved } = useProject();
  return <IdentityPicker open={identityOpen} onClose={closeIdentity} onSaved={onIdentitySaved} />;
}
