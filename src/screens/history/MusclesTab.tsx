import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation } from 'wouter';
import { CalendarDays, Dumbbell } from 'lucide-react';
import { useSettings } from '../../app/SettingsContext';
import { useToday } from '../../lib/hooks';
import { loadWeekMuscles } from '../../lib/muscleQueries';
import { FULL_AT_SESSION, FULL_AT_WEEK } from '../../lib/muscleStats';
import { BLOCK_WEEKS, isoWeekday, weekInfo } from '../../lib/program';
import { capitalize, formatDateShort, formatDateWithYear, WEEKDAYS_SHORT_IT } from '../../lib/format';
import { accentStyle, Button, Card, cx, EmptyState, Skeleton } from '../../components/ui';
import { MuscleReport } from '../../components/MuscleReport';

/** Which muscles each week hit, on the body map: pick a week (1-7) and, if you like, one workout of it. */
export function MusclesTab() {
  const settings = useSettings();
  const today = useToday();
  const [, navigate] = useLocation();
  const current = weekInfo(settings, today).week;
  const [block, setBlock] = useState<string | null>(null);
  const [week, setWeek] = useState(current);
  const [only, setOnly] = useState<string | null>(null);
  const data = useLiveQuery(() => loadWeekMuscles(block, week), [block, week, settings.blockStartDate]);

  if (!data) {
    return (
      <div className="flex flex-col gap-3 px-4">
        <Skeleton className="h-14" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const isCurrentBlock = data.blockStart === settings.blockStartDate;
  const picked = only ? data.sessions.find((s) => s.session.id === only) : undefined;
  const credits = picked ? picked.credits : data.credits;
  const sets = picked ? picked.sets : data.sets;

  return (
    <div className="flex flex-col gap-4 px-4">
      {data.blocks.length > 1 && (
        <label className="flex items-center gap-3">
          <CalendarDays size={18} className="text-muted" aria-hidden />
          <span className="text-[14px] text-muted">Blocco</span>
          <select
            className="min-h-12 flex-1 rounded-2xl border border-line bg-raised px-3 text-[16px]"
            value={data.blockStart}
            onChange={(e) => {
              setBlock(e.target.value);
              setOnly(null);
            }}
          >
            {data.blocks.map((b) => (
              <option key={b} value={b}>
                dal {formatDateWithYear(b)}
                {b === settings.blockStartDate ? ' (attuale)' : ''}
              </option>
            ))}
          </select>
        </label>
      )}

      <div role="radiogroup" aria-label="Settimana" className="grid grid-cols-6 gap-1.5">
        {Array.from({ length: BLOCK_WEEKS }, (_, i) => i + 1).map((n) => {
          const on = n === week;
          const has = data.weeksWithData.includes(n);
          const now = isCurrentBlock && n === current;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`Settimana ${n}${has ? '' : ', nessun allenamento'}${now ? ', questa settimana' : ''}`}
              onClick={() => {
                setWeek(n);
                setOnly(null);
              }}
              className={cx(
                'pressable relative flex h-14 flex-col items-center justify-center rounded-2xl border text-[16px] font-extrabold tnum',
                on ? 'border-transparent bg-[linear-gradient(135deg,var(--pink),var(--pink-2))] text-on-accent shadow-[0_10px_22px_-10px_var(--pink)]' : now ? 'card-surface border-[color-mix(in_srgb,var(--pink)_60%,var(--border))]' : 'card-surface',
                !on && !has && 'text-muted',
              )}
            >
              {n}
              <span className={cx('mt-0.5 h-1.5 w-1.5 rounded-full', has ? (on ? 'bg-on-accent' : 'bg-[var(--heat-3)]') : 'bg-transparent')} aria-hidden />
            </button>
          );
        })}
      </div>

      <div>
        <h2 className="text-[22px] font-extrabold tnum">Settimana {week}</h2>
        <p className="text-[14px] text-muted tnum">
          {formatDateShort(data.from)} – {formatDateShort(data.to)} · {data.sessions.length === 1 ? '1 allenamento' : `${data.sessions.length} allenamenti`} · {data.sets} serie
        </p>
      </div>

      {data.sessions.length === 0 ? (
        <EmptyState
          tone="pink"
          icon={<Dumbbell size={26} />}
          title="Nessun allenamento in questa settimana"
          text={week > current && isCurrentBlock ? 'Questa settimana non è ancora arrivata.' : 'Quando ti alleni, qui vedi i muscoli colpiti sulla mappa.'}
          action={
            isCurrentBlock && week === current ? (
              <Button variant="primary" onClick={() => navigate('/')}>
                Vai a Oggi
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {data.sessions.length > 1 && (
            <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label="Quale allenamento">
              <FilterPill on={!only} onClick={() => setOnly(null)}>
                Tutta la settimana
              </FilterPill>
              {data.sessions.map(({ session, day }) => (
                <span key={session.id} style={accentStyle(day?.type)} className="contents">
                  <FilterPill on={only === session.id} onClick={() => setOnly(session.id)}>
                    {capitalize(WEEKDAYS_SHORT_IT[isoWeekday(session.date) - 1])} · {day?.title ?? 'Allenamento'}
                  </FilterPill>
                </span>
              ))}
            </div>
          )}
          <Card className="p-4">
            <MuscleReport
              key={`${data.blockStart}:${week}:${only ?? 'all'}`}
              credits={credits}
              prev={picked ? undefined : data.prev}
              fullAt={picked ? FULL_AT_SESSION : FULL_AT_WEEK}
              emptyText="Nessuna serie."
            />
            {!picked && data.prev && <p className="mt-3 text-[12px] text-muted">Le frecce confrontano con la settimana {week - 1}.</p>}
            <p className="mt-1 text-[12px] text-muted tnum">{sets} serie in totale.</p>
          </Card>
        </>
      )}
    </div>
  );
}

function FilterPill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cx('pressable min-h-12 shrink-0 rounded-full border px-4 text-[14px] font-bold whitespace-nowrap', on ? 'grad-accent border-transparent text-on-accent' : 'card-surface text-muted')}
    >
      {children}
    </button>
  );
}
