import { Check, Play, RotateCcw } from 'lucide-react';
import { useSettings } from '../../app/SettingsContext';
import { formatRest, plural, weekdayName, capitalize } from '../../lib/format';
import { dayPlanSummary, groupSlots, setsForWeek, targetRir } from '../../lib/program';
import type { Day, Session, Slot } from '../../lib/types';
import { Sheet } from '../../components/Sheet';
import { accentStyle, Button, cx } from '../../components/ui';

/** Preview of a day with its exercises for this week, and the button to start it. */
export function DaySheet({
  day,
  onClose,
  week,
  slots,
  done,
  inProgress,
  onStart,
  onOpenSession,
}: {
  day: Day | null;
  onClose: () => void;
  week: number;
  slots: Slot[];
  done: Session | undefined;
  inProgress: Session | undefined;
  onStart: (d: Day) => void;
  onOpenSession: (s: Session) => void;
}) {
  const settings = useSettings();
  if (!day) return null;
  const summary = dayPlanSummary(slots, week, settings.extraSets);
  const groups = groupSlots(slots);
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
        <p className="text-[14px] text-muted tnum">
          {capitalize(weekdayName(day.weekday))} · {plural(summary.exercises, 'esercizio', 'esercizi')} · {summary.sets} serie · ~{day.estimatedMinutes} min
        </p>
        <ol className="mt-3 flex flex-col gap-2">
          {groups.map((g) => (
            <li key={g[0].id} className={cx('rounded-2xl border border-line bg-raised', g.length > 1 && 'border-[color-mix(in_srgb,var(--accent)_35%,transparent)]')}>
              {g.map((s, i) => {
                const n = setsForWeek(s.sets, week, settings.extraSets);
                return (
                  <div key={s.id} className={cx('flex items-center gap-3 px-3 py-2.5', i > 0 && 'border-t border-line')}>
                    <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] px-1 text-[13px] font-bold text-accent-ink tnum">
                      {s.label}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cx('block truncate text-[15px] font-medium', n === 0 && 'text-muted')}>{s.name}</span>
                      <span className="block text-[13px] text-muted tnum">
                        {n === 0 ? 'dalla settimana 4' : `${n} × ${s.reps} · RIR ${targetRir(s.rir, s.kind, week)}`}
                        {n > 0 && s.restSeconds > 0 && ` · ${formatRest(s.restSeconds)}`}
                        {n > 0 && s.superset?.role === 'a' && ' · poi subito la b'}
                      </span>
                    </span>
                  </div>
                );
              })}
            </li>
          ))}
        </ol>
      </div>
    </Sheet>
  );
}
