import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation } from 'wouter';
import { ChevronRight, Search } from 'lucide-react';
import { loadExerciseIndex } from '../../lib/exerciseHistory';
import { ALL_MUSCLES, muscleLabel, muscleMatches } from '../../lib/muscles';
import { displayReps } from '../../lib/program';
import { formatDateShort, formatKg } from '../../lib/format';
import type { MuscleKey } from '../../lib/types';
import { accentStyle, Badge, cx, EmptyState, inputClass, Skeleton } from '../../components/ui';
import { Sparkline } from '../../components/Sparkline';

/** History by exercise: search, filter by muscle, best set, sparkline, PR badge. */
export function ExerciseList() {
  const index = useLiveQuery(loadExerciseIndex, []);
  const [, navigate] = useLocation();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<MuscleKey | null>(null);

  const list = useMemo(() => {
    if (!index) return [];
    const query = q.trim().toLowerCase();
    return index.filter((e) => {
      if (query && !e.exercise.name.toLowerCase().includes(query)) return false;
      if (muscle && !muscleMatches(muscle, e.exercise.primary) && !muscleMatches(muscle, e.exercise.secondary)) return false;
      return true;
    });
  }, [index, q, muscle]);

  const usedMuscles = useMemo(() => {
    const set = new Set<MuscleKey>();
    for (const e of index ?? []) for (const m of [...e.exercise.primary, ...e.exercise.secondary]) set.add(m);
    return ALL_MUSCLES.filter((m) => set.has(m));
  }, [index]);

  if (!index) return <div className="flex flex-col gap-2 px-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>;

  return (
    <div>
      <div className="px-4">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" aria-hidden />
          <input type="search" aria-label="Cerca un esercizio" placeholder="Cerca un esercizio" className={cx(inputClass, 'pl-11')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="scrollbar-none mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1" role="group" aria-label="Filtra per muscolo">
        <FilterChip on={muscle === null} onClick={() => setMuscle(null)}>
          Tutti
        </FilterChip>
        {usedMuscles.map((m) => (
          <FilterChip key={m} on={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)}>
            {muscleLabel(m)}
          </FilterChip>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="mt-4 px-4">
          <EmptyState title="Nessun esercizio trovato" text="Prova un altro nome o togli il filtro." />
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-2 px-4">
          {list.map((e) => (
            <li key={e.exercise.id} style={accentStyle(e.days[0]?.type)}>
              <button
                type="button"
                onClick={() => navigate(`/storico/esercizio/${encodeURIComponent(e.exercise.key)}`)}
                className="pressable flex min-h-[68px] w-full items-center gap-3 rounded-[18px] border border-line bg-surface px-3 py-2 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[16px] font-semibold">{e.exercise.name}</span>
                    {e.recentPr && <Badge>PR</Badge>}
                  </span>
                  <span className="block truncate text-[13px] text-muted tnum">
                    {e.best ? (
                      <>
                        Migliore <span className="font-semibold text-ink">{formatKg(e.best.weightKg)} kg × {displayReps(e.best)}</span>
                      </>
                    ) : (
                      'Ancora nessuna serie'
                    )}
                    {e.lastDate && ` · ${formatDateShort(e.lastDate)}`}
                    {e.days.length === 0 && ' · fuori programma'}
                  </span>
                </span>
                <Sparkline values={e.trend} label={`Andamento del carico migliore: ${e.trend.map((v) => formatKg(v)).join(', ')} kg`} />
                <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx('pressable min-h-12 shrink-0 rounded-full border px-4 text-[14px] whitespace-nowrap', on ? 'border-transparent bg-ink font-semibold text-bg' : 'border-line bg-surface text-muted')}
    >
      {children}
    </button>
  );
}
