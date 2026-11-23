import { Check, Clock3, Play, RotateCcw } from 'lucide-react';
import { useSettings } from '../../app/SettingsContext';
import { formatRest, plural, weekdayName, capitalize } from '../../lib/format';
import { dayPlanSummary, setsForWeek, targetRir } from '../../lib/program';
import type { Day, Exercise, Session, Slot } from '../../lib/types';
import { Sheet } from '../../components/Sheet';
import { ExerciseThumb } from '../../components/ExerciseThumb';
import { accentStyle, Button, cx } from '../../components/ui';

/** Preview of a day with its exercises for this week, and the button to start it. */
export function DaySheet({
  day,
  onClose,
  week,
  slots,
  exercises,
  done,
  inProgress,
  onStart,
  onOpenSession,
}: {
  day: Day | null;
  onClose: () => void;
  week: number;
  slots: Slot[];
  exercises: Map<string, Exercise> | undefined;
  done: Session | undefined;
  inProgress: Session | undefined;
  onStart: (d: Day) => void;
  onOpenSession: (s: Session) => void;
}) {
  const settings = useSettings();
  if (!day) return null;
  const summary = dayPlanSummary(slots, week, settings.extraSets);
  const ordered = [...slots].sort((a, b) => a.position - b.position);
  return (
    <Sheet
      open={!!day}
      onClose={onClose}
      title={day.title}
      footer={
        <div style={accentStyle(day.type)} className="flex flex-col gap-2">
          {inProgress ? (
            <Button variant="primary" size="lg" block icon={<RotateCcw size={20} aria-hidden />} onClick={() => onOpenSession(inProgress)}>
              Riprendi
            </Button>
          ) : (
            <Button variant="primary" size="lg" block icon={<Play size={20} fill="currentColor" aria-hidden />} onClick={() => onStart(day)}>
              Inizia {day.title}
            </Button>
          )}
          {done && !inProgress && (
            <Button variant="ghost" block icon={<Check size={18} aria-hidden />} onClick={() => onOpenSession(done)}>
              Rivedi la sessione di questa settimana
            </Button>
          )}
        </div>
      }
    >
      <div style={accentStyle(day.type)}>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-muted tnum">
          <span>{capitalize(weekdayName(day.weekday))}</span>
          <span>{plural(summary.exercises, 'esercizio', 'esercizi')}</span>
          <span>{summary.sets} serie</span>
          <span className="inline-flex items-center gap-1">
            <Clock3 size={14} aria-hidden /> ~{day.estimatedMinutes} min
          </span>
        </p>
        <ol className="mt-3 flex flex-col gap-2">
          {ordered.map((s) => {
            const n = setsForWeek(s.sets, week, settings.extraSets);
            return (
              <li key={s.id} className="card-surface flex items-center gap-3 rounded-[20px] p-2.5">
                <span className="relative">
                  <ExerciseThumb exercise={exercises?.get(s.exerciseKey)} size={52} />
                  <span className="grad-accent absolute -top-1.5 -left-1.5 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12px] font-extrabold text-on-accent tnum">{s.label}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cx('block truncate text-[15px] font-bold', n === 0 && 'text-muted')}>{s.name}</span>
                  <span className="block text-[13px] text-muted tnum">
                    {n === 0 ? 'dalla settimana 4' : `${n} × ${s.reps} · RIR ${targetRir(s.rir, s.kind, week)}`}
                    {n > 0 && s.restSeconds > 0 && ` · ${formatRest(s.restSeconds)}`}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </Sheet>
  );
}
