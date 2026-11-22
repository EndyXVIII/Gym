import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation } from 'wouter';
import { ChevronLeft, ChevronRight, Pencil, StickyNote } from 'lucide-react';
import { loadExerciseHistory } from '../../lib/exerciseHistory';
import { muscleLabel } from '../../lib/muscles';
import { displayReps, isWorkingDone, volumeKg } from '../../lib/program';
import { capitalize, formatDateLong, formatKg, formatVolume } from '../../lib/format';
import { accentStyle, Badge, Card, Chip, cx, EmptyState, IconButton, ScreenSkeleton } from '../../components/ui';
import { Sparkline } from '../../components/Sparkline';
import { ExerciseEditorSheet } from '../program/ExerciseEditorSheet';

/** Full log of one exercise, every day it was done, by block and week. */
export default function ExerciseHistoryScreen({ exerciseKey }: { exerciseKey: string }) {
  const data = useLiveQuery(() => loadExerciseHistory(exerciseKey), [exerciseKey]);
  const [, navigate] = useLocation();
  const [editOpen, setEditOpen] = useState(false);
  if (!data) return <ScreenSkeleton />;
  const { exercise, summary, entries, prs } = data;
  const type = summary?.days[0]?.type;

  return (
    <div style={accentStyle(type)}>
      <header className="sticky top-0 z-30 border-b border-line bg-[var(--tabbar)] pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="flex min-h-14 items-center gap-1 px-1">
          <IconButton label="Indietro" onClick={() => (history.length > 1 ? history.back() : navigate('/storico'))}>
            <ChevronLeft size={26} aria-hidden />
          </IconButton>
          <h1 className="min-w-0 flex-1 truncate text-[17px] font-bold">{exercise?.name ?? exerciseKey}</h1>
          {exercise && (
            <IconButton label="Modifica esercizio" onClick={() => setEditOpen(true)}>
              <Pencil size={20} aria-hidden />
            </IconButton>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-4 px-4 pt-4">
        <Card className="p-4">
          <div className="flex flex-wrap gap-1.5">
            {exercise?.primary.map((m) => (
              <Chip key={m} tone="accent">
                {muscleLabel(m)}
              </Chip>
            ))}
            {exercise?.secondary.map((m) => (
              <Chip key={m} tone="muted">
                {muscleLabel(m)}
              </Chip>
            ))}
          </div>
          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[13px] text-muted">Serie migliore</p>
              <p className="text-[28px] leading-tight font-bold tnum">{summary?.best ? `${formatKg(summary.best.weightKg)} kg × ${displayReps(summary.best)}` : '—'}</p>
              <p className="text-[13px] text-muted tnum">
                {summary?.sessions ?? 0} sessioni{summary?.days.length ? ` · ${summary.days.map((d) => d.title).join(', ')}` : ' · fuori programma'}
              </p>
            </div>
            <Sparkline values={summary?.trend ?? []} width={120} height={44} label="Andamento del carico migliore per sessione" />
          </div>
        </Card>

        {entries.length === 0 ? (
          <EmptyState title="Ancora nessuna serie" text="Quando lo fai, le serie compaiono qui, da qualsiasi giorno." />
        ) : (
          <ol className="flex flex-col gap-2">
            {entries.map(({ session, day, logs }, i) => {
              const newWeek = i === 0 || entries[i - 1].session.week !== session.week || entries[i - 1].session.blockStart !== session.blockStart;
              const working = logs.filter(isWorkingDone);
              return (
                <li key={session.id}>
                  {newWeek && (
                    <p className="mt-2 mb-2 px-1 text-[13px] font-semibold tracking-[0.06em] text-muted uppercase">
                      Settimana {session.week}
                      {session.week === 7 ? ' · scarico' : ''}
                    </p>
                  )}
                  <button type="button" onClick={() => navigate(`/sessione/${session.id}`)} className="pressable w-full rounded-[18px] border border-line bg-surface p-3 text-left" style={accentStyle(day?.type)}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[15px] font-semibold">
                        {capitalize(formatDateLong(session.date))}
                        <span className="ml-2 text-[13px] font-medium text-accent-ink">{day?.title ?? ''}</span>
                      </span>
                      <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
                    </span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {logs.map((l) => (
                        <span
                          key={l.id}
                          className={cx(
                            'inline-flex h-8 items-center gap-1 rounded-xl px-2.5 text-[14px] font-semibold tnum',
                            l.isWarmup ? 'bg-raised text-muted' : 'bg-[color-mix(in_srgb,var(--accent)_14%,var(--raised))]',
                          )}
                        >
                          {l.isWarmup && <span className="text-[11px] font-bold text-warning">R</span>}
                          {l.weightKg === null ? '—' : formatKg(l.weightKg)} × {displayReps(l)}
                          {prs.has(l.id) && <Badge className="ml-0.5">PR</Badge>}
                        </span>
                      ))}
                    </span>
                    {working.length > 1 && <span className="mt-2 block text-[12px] text-muted tnum">Volume {formatVolume(volumeKg(working))} kg</span>}
                    {logs.some((l) => l.isSummary || l.note) && (
                      <span className="mt-2 flex items-start gap-1.5 text-[12px] text-muted">
                        <StickyNote size={14} className="mt-px shrink-0" aria-hidden />
                        <span>
                          {logs.find((l) => l.isSummary)?.rawText && <>Settimana 1, scritto «{logs.find((l) => l.isSummary)!.rawText}». </>}
                          {logs.filter((l) => l.note).map((l) => (
                            <span key={l.id} lang="en">
                              {l.note}{' '}
                            </span>
                          ))}
                        </span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      <ExerciseEditorSheet open={editOpen} onClose={() => setEditOpen(false)} exercise={exercise} />
    </div>
  );
}
