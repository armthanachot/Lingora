import { useEffect, useRef, type ReactNode } from 'react';

export function SettingsDialog({ children, className, labelledBy, busy, onClose, alert = false }: {
  children: ReactNode;
  className: string;
  labelledBy: string;
  busy: boolean;
  onClose: () => void;
  alert?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    element.querySelector<HTMLElement>('form input:not([type="hidden"]):not(:disabled), form select:not(:disabled), form textarea:not(:disabled), form button:not(:disabled)')?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className={'settings-modal ' + className}
      role={alert ? 'alertdialog' : 'dialog'}
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-busy={busy}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
        )).filter(control => control.getClientRects().length > 0 && control.tabIndex >= 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
