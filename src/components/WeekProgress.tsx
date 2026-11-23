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
          const deload = n === DELOAD_WEEK;
          return (
            <span
              key={n}
              className={cx(
                'h-3 rounded-full transition-all duration-300',
                done && (deload ? 'bg-[linear-gradient(90deg,var(--warm),var(--warm-2))]' : 'bg-[linear-gradient(90deg,var(--upper),var(--upper-2))]'),
                current &&
                  (deload
                    ? 'bg-[linear-gradient(90deg,var(--warm),var(--warm-2))] shadow-[0_0_0_3px_color-mix(in_srgb,var(--warm)_30%,transparent),0_6px_16px_-4px_var(--warm)]'
                    : 'bg-[linear-gradient(90deg,var(--upper),var(--upper-2))] shadow-[0_0_0_3px_color-mix(in_srgb,var(--upper)_30%,transparent),0_6px_16px_-4px_var(--upper)]'),
                !done && !current && (deload ? 'bg-[color-mix(in_srgb,var(--warm)_26%,var(--raised))]' : 'bg-raised'),
              )}
            />
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold text-muted tnum" aria-hidden>
        {Array.from({ length: BLOCK_WEEKS }, (_, i) => (
          <span key={i} className={cx(i + 1 === week && !completed && 'text-ink', i + 1 === DELOAD_WEEK && 'text-warm-ink')}>
            {i + 1 === DELOAD_WEEK ? 'Scarico' : i + 1}
          </span>
        ))}
      </div>
    </div>
  );
}
