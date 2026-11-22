import { memo, useEffect, useRef, useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { formatKg, parseReps, parseWeight, roundHalf, sanitizeRepsTyping, sanitizeWeightTyping } from '../../lib/format';
import type { SetRowModel } from '../../lib/sessionRows';
import type { RowValues } from '../../lib/sessionOps';
import { cx } from '../../components/ui';

export const SET_GRID = 'grid grid-cols-[36px_48px_minmax(0,1fr)_48px_56px_56px] items-center gap-1';

/**
 * One set: number, weight (− / +), reps, check.
 * Edits autosave on blur and after a short pause; checking saves at once.
 */
export const SetRow = memo(function SetRow({
  row,
  step,
  isPr,
  onSave,
  onToggle,
  onMenu,
  exerciseName,
}: {
  row: SetRowModel;
  step: number;
  isPr: boolean;
  onSave: (row: SetRowModel, v: RowValues) => void;
  onToggle: (row: SetRowModel, v: RowValues) => void;
  onMenu: (row: SetRowModel) => void;
  exerciseName: string;
}) {
  const [w, setW] = useState(formatKg(row.weightKg));
  const [r, setR] = useState(row.reps === null ? '' : String(row.reps));
  const focused = useRef<'w' | 'r' | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const repsInput = useRef<HTMLInputElement>(null);
  const [shake, setShake] = useState(false);
  const [popKey, setPopKey] = useState(0);

  // Follow the database when I'm not typing in the field.
  useEffect(() => {
    if (focused.current !== 'w') setW(formatKg(row.weightKg));
  }, [row.weightKg]);
  useEffect(() => {
    if (focused.current !== 'r') setR(row.reps === null ? '' : String(row.reps));
  }, [row.reps]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const values = (wText = w, rText = r): RowValues => ({ weightKg: parseWeight(wText), reps: parseReps(rText) });

  const commit = (wText = w, rText = r) => {
    window.clearTimeout(timer.current);
    const v = values(wText, rText);
    // A planned row stays virtual until I actually change it.
    if (v.weightKg !== row.weightKg || v.reps !== row.reps) onSave(row, v);
  };

  const scheduleCommit = (wText: string, rText: string) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => commit(wText, rText), 1200);
  };

  const onFocus = (e: React.FocusEvent<HTMLInputElement>, which: 'w' | 'r') => {
    focused.current = which;
    const el = e.currentTarget;
    requestAnimationFrame(() => el.setSelectionRange(0, el.value.length));
    // After the keyboard is up, keep the field visible above the rest timer.
    window.setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 320);
  };

  const onBlur = (which: 'w' | 'r') => {
    if (focused.current === which) focused.current = null;
    if (which === 'w') {
      const parsed = parseWeight(w);
      if (w.trim() !== '' && parsed === null) {
        setW(formatKg(row.weightKg)); // not a number: put the old value back
        return;
      }
      setW(formatKg(parsed));
    }
    commit();
  };

  const bump = (dir: 1 | -1) => {
    const base = parseWeight(w) ?? row.weightKg ?? 0;
    const next = Math.max(0, roundHalf(base + dir * step));
    const text = formatKg(next);
    setW(text);
    commit(text, r);
  };

  const toggle = () => {
    const v = values();
    if (!row.done && v.reps === null) {
      setShake(true);
      window.setTimeout(() => setShake(false), 400);
      repsInput.current?.focus();
      return;
    }
    if (!row.done) setPopKey((k) => k + 1);
    window.clearTimeout(timer.current);
    onToggle(row, v);
  };

  const number = row.isWarmup ? 'R' : String(row.workingNumber ?? '');
  const setName = row.isWarmup ? 'riscaldamento' : `serie ${row.workingNumber}`;
  // 28 px always; long values ("102,5") get tighter letter spacing to fit the column.
  const big = w.length >= 5 ? 'text-[28px] tracking-[-0.06em]' : 'text-[28px]';

  return (
    <div
      className={cx(
        SET_GRID,
        'rounded-2xl px-0.5 py-1 transition-colors duration-200',
        row.done && 'bg-[color-mix(in_srgb,var(--success)_12%,transparent)]',
        row.isWarmup && !row.done && 'bg-[color-mix(in_srgb,var(--warning)_7%,transparent)]',
      )}
    >
      <button
        type="button"
        onClick={() => onMenu(row)}
        aria-label={`${setName[0].toUpperCase()}${setName.slice(1)}: opzioni (riscaldamento, elimina)`}
        className={cx(
          'pressable relative flex h-12 items-center justify-center rounded-xl text-[17px] font-bold tnum before:absolute before:-inset-x-1.5 before:-inset-y-1',
          row.isWarmup ? 'text-warning-ink' : row.done ? 'text-success-ink' : 'text-muted',
        )}
      >
        {number}
      </button>

      <button
        type="button"
        onClick={() => bump(-1)}
        aria-label={`Togli ${formatKg(step)} kg, ${setName}`}
        className="pressable flex h-12 items-center justify-center rounded-xl bg-raised text-ink"
      >
        <Minus size={20} aria-hidden />
      </button>
      <input
        type="text"
        inputMode="decimal"
        enterKeyHint="next"
        autoComplete="off"
        aria-label={`Peso (kg), ${setName}, ${exerciseName}`}
        placeholder="kg"
        value={w}
        onFocus={(e) => onFocus(e, 'w')}
        onBlur={() => onBlur('w')}
        onChange={(e) => {
          const t = sanitizeWeightTyping(e.target.value);
          setW(t);
          scheduleCommit(t, r);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') repsInput.current?.focus();
        }}
        className={cx(
          'h-14 w-full min-w-0 rounded-xl border border-transparent bg-raised text-center font-semibold tnum outline-none placeholder:text-[18px] placeholder:font-normal placeholder:text-muted focus:border-[var(--focus)]',
          big,
        )}
      />
      <button
        type="button"
        onClick={() => bump(1)}
        aria-label={`Aggiungi ${formatKg(step)} kg, ${setName}`}
        className="pressable flex h-12 items-center justify-center rounded-xl bg-raised text-ink"
      >
        <Plus size={20} aria-hidden />
      </button>

      <input
        ref={repsInput}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        enterKeyHint="done"
        autoComplete="off"
        aria-label={`Ripetizioni, ${setName}, ${exerciseName}`}
        placeholder="rip"
        value={r}
        onFocus={(e) => onFocus(e, 'r')}
        onBlur={() => onBlur('r')}
        onChange={(e) => {
          const t = sanitizeRepsTyping(e.target.value);
          setR(t);
          scheduleCommit(w, t);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
        }}
        className={cx(
          'h-14 w-full min-w-0 rounded-xl border bg-raised text-center text-[28px] font-semibold tnum outline-none placeholder:text-[18px] placeholder:font-normal placeholder:text-muted focus:border-[var(--focus)]',
          shake ? 'border-danger' : 'border-transparent',
        )}
        style={shake ? { animation: 'pop 300ms ease-out' } : undefined}
      />

      <button
        type="button"
        onClick={toggle}
        aria-pressed={row.done}
        aria-label={row.done ? `${setName} fatta: tocca per riaprirla` : `Segna ${setName} come fatta`}
        className={cx(
          'pressable relative flex h-14 w-14 items-center justify-center rounded-2xl border-2',
          row.done ? 'border-transparent bg-success text-on-accent' : 'border-line bg-raised text-muted',
        )}
      >
        <span key={popKey} className={cx('flex', popKey > 0 && row.done && 'anim-pop rounded-full')}>
          <Check size={28} strokeWidth={row.done ? 3.2 : 2.4} aria-hidden />
        </span>
        {isPr && (
          <span className="absolute -top-2 -right-1 rounded-md bg-warning px-1 text-[10px] leading-4 font-extrabold text-[#1b1305]" aria-label="record personale">
            PR
          </span>
        )}
      </button>
    </div>
  );
});
