// App-wide dialogs still carried over from the old App.jsx. The delete-task
// confirmation was rebuilt in Phase 4 (app/DeleteTaskDialog.jsx); the
// identity picker is replaced with Settings in Phase 6.

import IdentityPicker from '../../components/registries/IdentityPicker';
import { useProject } from '../../state/projectContext.js';

/** "Who is using the app?" — opens on first launch and from the sidebar. */
export function LegacyIdentityDialog() {
  const { identityOpen, closeIdentity, onIdentitySaved } = useProject();
  return <IdentityPicker open={identityOpen} onClose={closeIdentity} onSaved={onIdentitySaved} />;
}
