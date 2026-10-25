import { useState } from 'react';
import './IdentityPicker.css';
import { loadIdentity, saveIdentity } from '../../utils/Identity';
import { useI18n } from '../../i18n/useI18n.js';

const ROLE_SUGGESTION_KEYS = [
  'registries.roleSiteEngineer',
  'registries.roleSiteManager',
  'registries.roleEngineer',
  'registries.roleSurveyor',
  'registries.roleInspector',
  'registries.roleAccountant',
  'registries.roleStorekeeper',
];

/**
 * Inner form — mounts fresh every time the picker opens, so its draft is
 * always re-read from storage at mount (no reset effect needed).
 */
const IdentityPickerForm = ({ onClose, onSaved }) => {
  const { t } = useI18n();
  const [draft, setDraft] = useState(loadIdentity);

  const canSave = draft.name.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const saved = saveIdentity(draft);
    onSaved?.(saved);
    onClose?.();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content identity-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon">👤</div>
        <h3 className="modal-title">{t('registries.idpTitle')}</h3>
        <p className="modal-text">{t('registries.idpText')}</p>
        <input
          className="modal-input"
          placeholder={t('registries.idpNamePh')}
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          autoFocus
        />
        <input
          className="modal-input"
          placeholder={t('registries.idpRolePh')}
          value={draft.role}
          onChange={(e) => setDraft({ ...draft, role: e.target.value })}
          list="idp-role-suggestions"
        />
        <datalist id="idp-role-suggestions">
          {ROLE_SUGGESTION_KEYS.map((key) => (
            <option key={key} value={t(key)} />
          ))}
        </datalist>
        <div className="modal-actions">
          <button className="apple-btn secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button className="apple-btn primary" onClick={handleSave} disabled={!canSave}>
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * IdentityPicker — "who is using the app?" modal.
 * Reads/writes 'pm-identity' ({ name, role }) via utils/Identity.
 *
 * Props: { open, onClose, onSaved }
 *   open    → show/hide the modal
 *   onClose → called when dismissed (overlay click / إلغاء)
 *   onSaved → called with the saved { name, role } after حفظ
 */
const IdentityPicker = ({ open, onClose, onSaved }) => {
  if (!open) return null;
  return <IdentityPickerForm onClose={onClose} onSaved={onSaved} />;
};

export default IdentityPicker;
