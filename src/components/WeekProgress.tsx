import { BLOCK_WEEKS, DELOAD_WEEK } from '../lib/program';
import { cx } from './ui';

/** 7-step progress bar for the block. Week 7 is marked "Scarico". */
export function WeekProgress({ week, completed }: { week: number; completed?: boolean }) {
  return (
    <div>
      <div
        className="grid grid-cols-7 gap-1.5"
        role="progressbar"
        aria-label="Avanzamento del blocco"
        aria-valuemin={1}
        aria-valuemax={BLOCK_WEEKS}
        aria-valuenow={week}
        aria-valuetext={`Settimana ${week} di ${BLOCK_WEEKS}`}
      >
        {Array.from({ length: BLOCK_WEEKS }, (_, i) => {
          const n = i + 1;
          const done = completed || n < week;
          const current = !completed && n === week;
          return (
            <span
              key={n}
              className={cx(
                'h-2 rounded-full transition-colors duration-200',
                done && 'bg-[var(--upper)]',
                current && 'bg-[var(--upper)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--upper)_28%,transparent)]',
                !done && !current && (n === DELOAD_WEEK ? 'bg-[color-mix(in_srgb,var(--warning)_30%,var(--raised))]' : 'bg-raised'),
              )}
            />
          );
        })}
      </div>
      <div className="mt-1.5 grid grid-cols-7 gap-1.5 text-center text-[11px] text-muted tnum" aria-hidden>
        {Array.from({ length: BLOCK_WEEKS }, (_, i) => (
          <span key={i} className={cx(i + 1 === week && !completed && 'font-semibold text-ink', i + 1 === DELOAD_WEEK && 'text-warning-ink')}>
            {i + 1 === DELOAD_WEEK ? 'Scarico' : i + 1}
          </span>
        ))}
      </div>
    </div>
  );
}
