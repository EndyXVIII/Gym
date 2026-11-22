import { Minus, Plus } from 'lucide-react';
import { cx } from './ui';

/** Small integer stepper with 48 px buttons. */
export function Stepper({ value, onChange, min = 0, max = 20, label, className }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string; className?: string }) {
  return (
    <div className={cx('flex items-center gap-1', className)} role="group" aria-label={label}>
      <button
        type="button"
        className="pressable flex h-12 w-12 items-center justify-center rounded-xl bg-raised disabled:opacity-40"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`${label}: meno uno`}
      >
        <Minus size={18} aria-hidden />
      </button>
      <output className="w-10 text-center text-[22px] font-semibold tnum" aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        className="pressable flex h-12 w-12 items-center justify-center rounded-xl bg-raised disabled:opacity-40"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`${label}: più uno`}
      >
        <Plus size={18} aria-hidden />
      </button>
    </div>
  );
}
