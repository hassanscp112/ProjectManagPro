import * as RadixToast from '@radix-ui/react-toast';
import { Check, Info, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import { cx } from './cx.js';
import { ToastContext } from './toastContext.js';
import s from './Overlay.module.css';

const ICONS = { success: Check, danger: X, info: Info };
const TONE_CLASS = { success: s.toastSuccess, danger: s.toastDanger };

let nextId = 1;

/**
 * Short confirmations ("Order saved") that disappear on their own.
 * Wrap the app once; call useToast() anywhere below.
 */
export function ToastProvider({ children }) {
  const { t } = useI18n();
  const [toasts, setToasts] = useState([]);

  const toast = useCallback(({ title, description, tone = 'success', duration = 4000 }) => {
    const id = nextId++;
    setToasts((list) => [...list, { id, title, description, tone, duration }]);
  }, []);

  const remove = (id) => setToasts((list) => list.filter((x) => x.id !== id));

  return (
    <ToastContext.Provider value={toast}>
      <RadixToast.Provider swipeDirection="down" label={t('ui.dismiss')}>
        {children}
        {toasts.map((x) => {
          const Icon = ICONS[x.tone] || Info;
          return (
            <RadixToast.Root
              key={x.id}
              duration={x.duration}
              onOpenChange={(open) => !open && remove(x.id)}
              className={cx('ui-portal', s.toast, TONE_CLASS[x.tone])}
            >
              <Icon size={18} aria-hidden="true" className={s.toastIcon} />
              <div className={s.toastText}>
                <RadixToast.Title className={s.toastTitle}>{x.title}</RadixToast.Title>
                {x.description && (
                  <RadixToast.Description className={s.toastDescription}>{x.description}</RadixToast.Description>
                )}
              </div>
              <RadixToast.Close className={s.toastClose} aria-label={t('ui.dismiss')}>
                <X size={16} aria-hidden="true" />
              </RadixToast.Close>
            </RadixToast.Root>
          );
        })}
        <RadixToast.Viewport className={cx('ui-portal', s.toastViewport)} />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}
