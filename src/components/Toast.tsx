import { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { cx } from './ui';

export interface ToastMessage {
  id: number;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'default' | 'success' | 'error';
  duration?: number;
}

let current: ToastMessage | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export const toast = {
  show(text: string, opts: Omit<ToastMessage, 'id' | 'text'> = {}) {
    current = { id: ++seq, text, ...opts };
    emit();
    return current.id;
  },
  hide(id?: number) {
    if (id === undefined || current?.id === id) {
      current = null;
      emit();
    }
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  get: () => current,
};

/** One toast at a time, above the bottom bar (`bottom` = height of whatever sits under it). */
export function ToastHost({ bottom = 88 }: { bottom?: number }) {
  const t = useSyncExternalStore(toast.subscribe, toast.get, () => null);
  useEffect(() => {
    if (!t) return;
    const id = window.setTimeout(() => toast.hide(t.id), t.duration ?? (t.onAction ? 5000 : 2600));
    return () => window.clearTimeout(id);
  }, [t]);
  if (!t) return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4" style={{ bottom: `calc(${bottom}px + env(safe-area-inset-bottom))` }}>
      <div
        key={t.id}
        role="status"
        aria-live="polite"
        className={cx(
          'anim-slide-up pointer-events-auto flex min-h-12 w-full max-w-[488px] items-center gap-3 rounded-2xl border px-4 py-2 shadow-[var(--shadow)]',
          t.tone === 'error' ? 'border-[color-mix(in_srgb,var(--danger)_45%,transparent)] bg-raised' : 'border-line bg-raised',
        )}
      >
        <p className={cx('min-w-0 flex-1 text-[15px]', t.tone === 'error' ? 'text-danger' : 'text-ink')}>{t.text}</p>
        {t.actionLabel && t.onAction && (
          <button
            type="button"
            className="pressable -mr-2 min-h-11 shrink-0 rounded-xl px-3 text-[15px] font-semibold text-accent-ink"
            onClick={() => {
              toast.hide(t.id);
              t.onAction?.();
            }}
          >
            {t.actionLabel}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
