import { DirectionProvider } from '@radix-ui/react-direction';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useI18n } from '../i18n/useI18n.js';
import { ToastProvider } from './Toast.jsx';

/**
 * Everything the shared components need, once at the top of the tree:
 * reading direction for Radix (follows the language), tooltip timing,
 * and the toast queue. Must sit inside <I18nProvider>.
 */
export function UiProvider({ children }) {
  const { dir } = useI18n();
  return (
    <DirectionProvider dir={dir}>
      <Tooltip.Provider delayDuration={400}>
        <ToastProvider>{children}</ToastProvider>
      </Tooltip.Provider>
    </DirectionProvider>
  );
}
