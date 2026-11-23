import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cx, IconButton } from './ui';

let openCount = 0;

/** Bottom sheet (modal dialog). Closes with the X, the scrim, Escape, or a swipe down on the handle. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  className,
  labelledBy,
  initialFocus = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  labelledBy?: string;
  initialFocus?: boolean;
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const drag = useRef<{ y: number; dy: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement | null;
    openCount += 1;
    document.documentElement.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    if (initialFocus) {
      requestAnimationFrame(() => panel.current?.focus({ preventScroll: true }));
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      openCount -= 1;
      if (openCount <= 0) {
        openCount = 0;
        document.documentElement.style.overflow = '';
      }
      restoreTo.current?.focus?.({ preventScroll: true });
    };
  }, [open, onClose, initialFocus]);

  if (!open) return null;

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, dy: 0 };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !panel.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    panel.current.style.transform = `translateY(${drag.current.dy}px)`;
  };
  const onPointerUp = () => {
    if (!drag.current || !panel.current) return;
    const { dy } = drag.current;
    drag.current = null;
    panel.current.style.transform = '';
    if (dy > 90) onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="anim-fade absolute inset-0 bg-[var(--scrim)] backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? (title ? id : undefined)}
        tabIndex={-1}
        className={cx(
          'anim-sheet relative flex max-h-[min(88dvh,820px)] w-full max-w-[520px] min-w-0 flex-col rounded-t-[32px] border border-b-0 border-line bg-surface bg-[linear-gradient(180deg,color-mix(in_srgb,var(--accent)_10%,transparent),transparent_140px)] shadow-[var(--shadow)] outline-none',
          className,
        )}
      >
        <div
          className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-hidden
        >
          <span className="h-1.5 w-10 rounded-full bg-line" />
        </div>
        {title && (
          <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-2">
            <h2 id={id} className="min-w-0 truncate text-[20px] font-extrabold text-ink">
              {title}
            </h2>
            <IconButton label="Chiudi" onClick={onClose} size={48} className="-mr-2 text-muted">
              <X size={22} />
            </IconButton>
          </div>
        )}
        <div tabIndex={0} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 focus-visible:outline-offset-[-2px]">{children}</div>
        {footer && <div className="shrink-0 border-t border-line px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">{footer}</div>}
        {!footer && <div className="pb-[env(safe-area-inset-bottom)]" />}
      </div>
    </div>,
    document.body,
  );
}

export interface SheetAction {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  tone?: 'default' | 'danger';
  description?: string;
  disabled?: boolean;
}

/** A sheet with a list of actions. */
export function ActionSheet({ open, onClose, title, actions }: { open: boolean; onClose: () => void; title?: ReactNode; actions: SheetAction[] }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <ul className="flex flex-col gap-1">
        {actions.map((a) => (
          <li key={a.label}>
            <button
              type="button"
              disabled={a.disabled}
              onClick={() => {
                onClose();
                a.onSelect();
              }}
              className={cx(
                'pressable flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-left hover:bg-raised disabled:opacity-40',
                a.tone === 'danger' ? 'text-danger-ink' : 'text-ink',
              )}
            >
              {a.icon && <span className={cx('shrink-0', a.tone === 'danger' ? 'text-danger-ink' : 'text-muted')}>{a.icon}</span>}
              <span className="min-w-0">
                <span className="block text-[16px] font-medium">{a.label}</span>
                {a.description && <span className="block text-[13px] text-muted">{a.description}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/** Confirmation dialog in a sheet. */
export function ConfirmSheet({
  open,
  onClose,
  title,
  text,
  confirmLabel,
  onConfirm,
  danger,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  text?: string;
  confirmLabel: string;
  onConfirm: () => void;
  danger?: boolean;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {text && <p className="mb-4 text-[15px] text-muted">{text}</p>}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className={cx(
            'pressable min-h-14 rounded-2xl text-[17px] font-semibold',
            danger ? 'bg-danger text-[#1b0505]' : 'bg-accent text-on-accent',
          )}
          onClick={() => {
            onClose();
            onConfirm();
          }}
        >
          {confirmLabel}
        </button>
        <button type="button" className="pressable min-h-12 rounded-2xl text-[16px] font-medium text-ink hover:bg-raised" onClick={onClose}>
          Annulla
        </button>
      </div>
    </Sheet>
  );
}
