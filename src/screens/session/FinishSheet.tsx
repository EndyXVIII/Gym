import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { formatDuration, formatSet, formatVolume } from '../../lib/format';
import { isWorkingDone, volumeKg } from '../../lib/program';
import type { Exercise, Session, SetLog } from '../../lib/types';
import { Sheet } from '../../components/Sheet';
import { Badge, Button, cx, inputClass } from '../../components/ui';

export function FinishSheet({
  open,
  onClose,
  session,
  logs,
  prs,
  exercises,
  onFinish,
  onDiscard,
}: {
  open: boolean;
  onClose: () => void;
  session: Session;
  logs: SetLog[];
  prs: Set<string>;
  exercises: Map<string, Exercise>;
  onFinish: (note: string) => void;
  onDiscard: () => void;
}) {
  const [note, setNote] = useState(session.note);
  useEffect(() => {
    if (open) setNote(session.note);
  }, [open, session.note]);

  const working = logs.filter(isWorkingDone);
  const volume = volumeKg(logs);
  const prLogs = working.filter((l) => prs.has(l.id));
  const minutes = session.startedAt ? Date.now() - Date.parse(session.startedAt) : 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Termina allenamento"
      footer={
        <div className="flex flex-col gap-2">
          <Button variant="primary" size="lg" block onClick={() => onFinish(note)} disabled={working.length === 0}>
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
      }
    >
      <dl className="grid grid-cols-3 gap-2">
        <Stat label="Serie fatte" value={String(working.length)} />
        <Stat label="Volume (kg)" value={formatVolume(volume)} />
        <Stat label="Durata" value={formatDuration(minutes)} />
      </dl>
      <div className="mt-4">
        <p className="mb-2 flex items-center gap-2 text-[15px] font-semibold">
          <Trophy size={18} className="text-warning" aria-hidden /> Nuovi record
        </p>
        {prLogs.length === 0 ? (
          <p className="text-[14px] text-muted">Nessun record oggi. Conta anche la costanza.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {prLogs.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 rounded-2xl bg-raised px-3 py-2.5">
                <span className="min-w-0 truncate text-[15px]">{exercises.get(l.exerciseKey)?.name ?? l.exerciseKey}</span>
                <span className="flex shrink-0 items-center gap-2 text-[15px] font-semibold tnum">
                  {formatSet(l.weightKg, l.reps)} <Badge>PR</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <label className="mt-4 block">
        <span className="mb-1.5 block px-1 text-[13px] font-medium text-muted">Nota</span>
        <textarea
          className={cx(inputClass, 'min-h-24 py-3')}
          placeholder="Come è andata? (facoltativo)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-raised px-3 py-3">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="mt-0.5 text-[22px] font-bold tnum">{value}</dd>
    </div>
  );
}
