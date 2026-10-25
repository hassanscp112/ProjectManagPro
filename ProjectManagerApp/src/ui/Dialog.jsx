import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useI18n } from '../i18n/useI18n.js';
import { Button, IconButton } from './Button.jsx';
import { cx } from './cx.js';
import s from './Overlay.module.css';

/** On open, focus the field marked data-autofocus (else Radix picks the first control). */
const focusMarkedField = (e) => {
  const target = e.currentTarget?.querySelector?.('[data-autofocus]');
  if (target) {
    e.preventDefault();
    target.focus();
  }
};

/** Shared header + body + footer used by Dialog and Drawer. */
function PanelChrome({ title, description, footer, children }) {
  const { t } = useI18n();
  return (
    <>
      <div className={s.head}>
        <div className={s.titles}>
          <RadixDialog.Title className={s.title}>{title}</RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className={s.description}>{description}</RadixDialog.Description>
          ) : (
            <RadixDialog.Description className="ui-visually-hidden">{title}</RadixDialog.Description>
          )}
        </div>
        <RadixDialog.Close asChild>
          <IconButton icon={X} label={t('ui.close')} size="sm" tooltip={false} />
        </RadixDialog.Close>
      </div>
      <div className={s.body}>{children}</div>
      {footer && <div className={s.footer}>{footer}</div>}
    </>
  );
}

/**
 * Centered modal dialog. Controlled: pass `open` + `onOpenChange`.
 * Focus is trapped inside; Esc and the close button dismiss it. Put
 * data-autofocus on the field that should take focus when it opens.
 */
export function Dialog({ open, onOpenChange, title, description, footer, size = 'md', children }) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={cx('ui-portal', s.overlay)} />
        <RadixDialog.Content
          className={cx('ui-portal', s.panel, s.dialog, size === 'lg' && s.dialogLg)}
          onOpenAutoFocus={focusMarkedField}
        >
          <PanelChrome title={title} description={description} footer={footer}>
            {children}
          </PanelChrome>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/**
 * Confirmation step for irreversible actions (replaces window.confirm).
 * tone="danger" makes the confirm button red.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = 'primary',
  onConfirm,
}) {
  const { t } = useI18n();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={message}
      footer={
        <>
          <RadixDialog.Close asChild>
            <Button variant="secondary">{cancelLabel || t('ui.cancel')}</Button>
          </RadixDialog.Close>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm?.();
              onOpenChange?.(false);
            }}
          >
            {confirmLabel || t('ui.confirm')}
          </Button>
        </>
      }
    />
  );
}

/**
 * Side panel (desktop, slides in from the reading end) that becomes a
 * bottom sheet on phones. Used for task details and quick edits.
 */
export function Drawer({ open, onOpenChange, title, description, footer, wide = false, children }) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={cx('ui-portal', s.overlay)} />
        <RadixDialog.Content className={cx('ui-portal', s.panel, wide ? s.drawerWide : s.drawer)} onOpenAutoFocus={focusMarkedField}>
          <span className={s.handle} aria-hidden="true" />
          <PanelChrome title={title} description={description} footer={footer}>
            {children}
          </PanelChrome>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
