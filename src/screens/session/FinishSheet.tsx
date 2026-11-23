import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Clock3, Dumbbell, Layers, Trophy } from 'lucide-react';
import { formatDuration, formatSet, formatVolume } from '../../lib/format';
import { loadWeekMuscles } from '../../lib/muscleQueries';
import { creditsFor, FULL_AT_SESSION, FULL_AT_WEEK } from '../../lib/muscleStats';
import { isWorkingDone, volumeKg } from '../../lib/program';
import type { Day, Exercise, Session, SetLog } from '../../lib/types';
import { Sheet } from '../../components/Sheet';
import { MuscleReport } from '../../components/MuscleReport';
import { Confetti } from '../../components/Confetti';
import { accentStyle, Badge, Button, Card, cx, IconTile, inputClass, Segmented, type Tone } from '../../components/ui';

/**
 * The summary of a workout: totals, the muscles it hit on the body map (this workout or the
 * whole week so far), new records and a note. `mode="finish"` saves; `mode="review"` just shows.
 */
export function FinishSheet({
  open,
  onClose,
  session,
  day,
  logs,
  prs,
  exercises,
  mode = 'finish',
  onFinish,
  onDiscard,
}: {
  open: boolean;
  onClose: () => void;
  session: Session;
  day: Day | null;
  logs: SetLog[];
  prs: Set<string>;
  exercises: Map<string, Exercise>;
  mode?: 'finish' | 'review';
  onFinish?: (note: string) => void;
  onDiscard?: () => void;
}) {
  const [note, setNote] = useState(session.note);
  const [scope, setScope] = useState<'session' | 'week'>('session');
  useEffect(() => {
    if (open) {
      setNote(session.note);
      setScope('session');
    }
  }, [open, session.note]);

  const working = logs.filter(isWorkingDone);
  const volume = volumeKg(logs);
  const prLogs = working.filter((l) => prs.has(l.id));
  const end = session.finishedAt ? Date.parse(session.finishedAt) : Date.now();
  const duration = session.startedAt ? end - Date.parse(session.startedAt) : 0;
  const finish = mode === 'finish';

  const sessionCredits = useMemo(() => creditsFor(logs, exercises), [logs, exercises]);
  const week = useLiveQuery(() => (open ? loadWeekMuscles(session.blockStart, session.week) : undefined), [open, session.blockStart, session.week]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={finish ? 'Termina allenamento' : 'Riepilogo'}
      footer={
        finish ? (
          <div className="flex flex-col gap-2">
            <Button variant="success" size="lg" block onClick={() => onFinish?.(note)} disabled={working.length === 0}>
              Salva allenamento
            </Button>
            {working.length === 0 ? (
              <Button variant="danger" block onClick={onDiscard}>
                Nessuna serie: elimina l’allenamento
              </Button>
            ) : (
              <Button variant="ghost" block onClick={onClose}>
                Continua ad allenarti
              </Button>
            )}
          </div>
        ) : (
          <Button variant="secondary" size="lg" block onClick={onClose}>
            Chiudi
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4 pb-1" style={accentStyle(day?.type)}>
        <section className="hero relative rounded-[28px] px-5 py-6 text-center">
          {finish && working.length > 0 && <Confetti />}
          <IconTile tone="amber" size={64} round className="mx-auto">
            <Trophy size={30} />
          </IconTile>
          <p className="mt-3 text-[28px] leading-tight font-extrabold">{finish ? (working.length > 0 ? 'Ottimo lavoro!' : 'Nessuna serie fatta') : 'Com’è andata'}</p>
          <p className="mt-1 text-[14px] text-muted">
            {day?.title ?? 'Allenamento'} · settimana {session.week}
            {session.week === 7 ? ' (scarico)' : ''}
          </p>
        </section>

        <dl className="grid grid-cols-3 gap-2">
          <Stat tone="blue" icon={<Layers size={18} />} label="Serie fatte" value={String(working.length)} />
          <Stat tone="amber" icon={<Dumbbell size={18} />} label="Volume (kg)" value={formatVolume(volume)} />
          <Stat tone="green" icon={<Clock3 size={18} />} label="Durata" value={formatDuration(duration)} />
        </dl>

        <Card className="p-4">
          <h3 className="mb-3 text-[18px] font-extrabold">Muscoli allenati</h3>
          <Segmented
            label="Mappa dei muscoli"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'session', label: 'Questo allenamento' },
              { value: 'week', label: 'Settimana' },
            ]}
          />
          {scope === 'week' && week && (
            <p className="mt-3 text-[13px] text-muted tnum">
              Settimana {week.week}: {week.sessions.length === 1 ? '1 allenamento' : `${week.sessions.length} allenamenti`}, {week.sets} serie
              {week.prev ? ' · le frecce confrontano con la settimana prima' : ''}
            </p>
          )}
          <div className="mt-3">
            {scope === 'session' ? (
              <MuscleReport credits={sessionCredits} fullAt={FULL_AT_SESSION} emptyText="Nessuna serie fatta: la mappa si colora man mano che le segni." />
            ) : (
              <MuscleReport credits={week?.credits ?? {}} prev={week?.prev} fullAt={FULL_AT_WEEK} emptyText="Ancora nessuna serie questa settimana." />
            )}
          </div>
        </Card>

        <Card className="p-4">
          <p className="mb-2 flex items-center gap-2 text-[18px] font-extrabold">
            <Trophy size={18} className="text-warm-ink" aria-hidden /> Nuovi record
          </p>
          {prLogs.length === 0 ? (
            <p className="text-[14px] text-muted">Nessun record oggi. Conta anche la costanza.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {prLogs.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 rounded-2xl bg-raised px-3 py-2.5">
                  <span className="min-w-0 truncate text-[15px]">{exercises.get(l.exerciseKey)?.name ?? l.exerciseKey}</span>
                  <span className="flex shrink-0 items-center gap-2 text-[15px] font-extrabold tnum">
                    {formatSet(l.weightKg, l.reps)} <Badge>PR</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {finish ? (
          <label className="block">
            <span className="mb-1.5 block px-1 text-[13px] font-semibold text-muted">Nota</span>
            <textarea className={cx(inputClass, 'min-h-24 py-3')} placeholder="Come è andata? (facoltativo)" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        ) : (
          session.note && (
            <Card className="p-4">
              <p className="mb-1 text-[13px] font-semibold text-muted">Nota</p>
              <p className="text-[15px]">{session.note}</p>
            </Card>
          )
        )}
      </div>
    </Sheet>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: Tone }) {
  return (
    <div className="card-surface rounded-[20px] px-3 py-3">
      <IconTile tone={tone} size={32} className="mb-2">
        {icon}
      </IconTile>
      <dt className="text-[12px] font-semibold text-muted">{label}</dt>
      <dd className="mt-0.5 text-[24px] leading-none font-extrabold tnum">{value}</dd>
    </div>
  );
}
