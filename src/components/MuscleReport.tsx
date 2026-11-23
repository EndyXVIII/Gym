import { useState } from 'react';
import { ArrowDown, ArrowUp, Equal } from 'lucide-react';
import { muscleLabel } from '../lib/muscles';
import { formatSerie, heatLevel, heatLevels, rankedMuscles, regionValue, untrainedMuscles, type MuscleCredits } from '../lib/muscleStats';
import type { MuscleKey } from '../lib/types';
import { HeatLegend, MuscleMap } from './MuscleMap';
import { cx } from './ui';

/** Change against the week before, always with an arrow and a sign (never colour alone). */
function Delta({ now, before }: { now: number; before: number | undefined }) {
  if (before === undefined) return null;
  const d = Math.round((now - before) * 2) / 2;
  if (d === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-muted" aria-label="come la settimana prima">
        <Equal size={12} aria-hidden /> 0
      </span>
    );
  }
  const up = d > 0;
  return (
    <span className={cx('inline-flex items-center gap-0.5 text-[12px] font-semibold tnum', up ? 'text-success-ink' : 'text-muted')} aria-label={`${up ? 'più' : 'meno'} di ${formatSerie(Math.abs(d))} rispetto alla settimana prima`}>
      {up ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />}
      {up ? '+' : '−'}
      {formatSerie(Math.abs(d))}
    </span>
  );
}

/** The table view of the map: every trained muscle with its serie, as bars on one scale. */
export function MuscleBars({
  credits,
  prev,
  fullAt,
  selected,
  onSelect,
}: {
  credits: MuscleCredits;
  prev?: MuscleCredits | null;
  fullAt: number;
  selected?: MuscleKey | null;
  onSelect?: (m: MuscleKey | null) => void;
}) {
  const ranked = rankedMuscles(credits);
  return (
    <ul className="flex flex-col gap-1" aria-label="Serie per muscolo">
      {ranked.map(({ muscle, value }) => {
        const level = Math.max(1, heatLevel(regionValue(credits, muscle), fullAt));
        const on = selected === muscle;
        return (
          <li key={muscle}>
            <button
              type="button"
              onClick={() => onSelect?.(on ? null : muscle)}
              aria-pressed={on}
              className={cx('pressable flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left', on ? 'bg-raised ring-1 ring-[var(--border)]' : 'hover:bg-raised')}
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[15px] font-semibold text-ink">{muscleLabel(muscle)}</span>
                  <span className="flex shrink-0 items-center gap-1.5 tnum">
                    <span className="text-[16px] font-extrabold text-ink">{formatSerie(value)}</span>
                    {prev !== undefined && prev !== null && <Delta now={value} before={prev[muscle] ?? 0} />}
                  </span>
                </span>
                <span className="relative mt-1.5 block h-2.5 overflow-hidden rounded-full bg-raised" aria-hidden>
                  <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(5, Math.min(100, (value / fullAt) * 100))}%`, background: `var(--heat-${level})` }} />
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Map + legend + ranked list + untrained muscles. Tap a muscle on the map (or in the list)
 * to read its number.
 */
export function MuscleReport({
  credits,
  prev,
  fullAt,
  emptyText = 'Ancora nessuna serie.',
  unit = 'serie',
}: {
  credits: MuscleCredits;
  prev?: MuscleCredits | null;
  fullAt: number;
  emptyText?: string;
  unit?: string;
}) {
  const [selected, setSelected] = useState<MuscleKey | null>(null);
  const heat = heatLevels(credits, fullAt);
  const ranked = rankedMuscles(credits);
  const rest = untrainedMuscles(credits);
  const sel = selected ? regionValue(credits, selected) : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="mx-auto h-[250px] w-full max-w-[340px]">
        <MuscleMap heat={heat} selected={selected} onSelect={setSelected} />
      </div>
      <p className="min-h-6 text-center text-[14px] text-muted" aria-live="polite">
        {selected ? (
          <>
            <span className="font-bold text-ink">{muscleLabel(selected)}</span> · <span className="font-bold text-ink tnum">{formatSerie(sel)}</span> {unit}
            {prev !== undefined && prev !== null && (
              <>
                {' '}
                · <Delta now={sel} before={regionValue(prev, selected)} />
              </>
            )}
          </>
        ) : ranked.length ? (
          'Tocca un muscolo per vedere le serie'
        ) : (
          emptyText
        )}
      </p>
      <HeatLegend fullAt={fullAt} unit={unit} />
      {ranked.length > 0 && <MuscleBars credits={credits} prev={prev} fullAt={fullAt} selected={selected} onSelect={setSelected} />}
      {ranked.length > 0 && rest.length > 0 && (
        <div>
          <p className="eyebrow mb-1.5 px-1 text-muted">Non allenati</p>
          <ul className="flex flex-wrap gap-1.5">
            {rest.map((m) => (
              <li key={m} className="rounded-full bg-raised px-2.5 py-1 text-[12px] font-medium text-muted">
                {muscleLabel(m)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Small version for the home screen: the map and the top three muscles. */
export function MuscleMini({ credits, fullAt }: { credits: MuscleCredits; fullAt: number }) {
  const heat = heatLevels(credits, fullAt);
  const top = rankedMuscles(credits).slice(0, 3);
  return (
    <div className="flex items-center gap-3">
      <div className="h-[132px] w-[136px] shrink-0">
        <MuscleMap heat={heat} label="Mappa dei muscoli allenati questa settimana" />
      </div>
      <ul className="flex min-w-0 flex-1 flex-col gap-2">
        {top.map(({ muscle, value }) => (
          <li key={muscle} className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-[4px]" style={{ background: `var(--heat-${Math.max(1, heatLevel(regionValue(credits, muscle), fullAt))})` }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{muscleLabel(muscle)}</span>
            <span className="text-[14px] font-bold tnum">{formatSerie(value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
