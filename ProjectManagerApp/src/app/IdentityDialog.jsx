import { useState } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import { useProject } from '../state/projectContext.js';
import { loadIdentity, saveIdentity } from '../utils/Identity.js';
import { Button, Dialog, Field, Input } from '../ui/index.js';

const ROLE_KEYS = [
  'registries.roleSiteEngineer',
  'registries.roleSiteManager',
  'registries.roleEngineer',
  'registries.roleSurveyor',
  'registries.roleInspector',
  'registries.roleAccountant',
  'registries.roleStorekeeper',
];

function IdentityForm({ onClose, onSaved }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(loadIdentity);
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

/**
 * "Who is using the app?" — opens on first launch (no name yet), from the
 * sidebar user and from Settings. Saved via utils/Identity ('pm-identity').
 */
export default function IdentityDialog() {
  const { identityOpen, closeIdentity, onIdentitySaved } = useProject();
  return identityOpen ? <IdentityForm onClose={closeIdentity} onSaved={onIdentitySaved} /> : null;
}
