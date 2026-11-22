import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation } from 'wouter';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import { db } from '../../lib/db';
import { loadCellLogs, type GridRow } from '../../lib/historyQueries';
import { dateInBlock, displayReps } from '../../lib/program';
import { ensureSessionFor } from '../../lib/sessionOps';
import { action, nowISO } from '../../lib/repo';
import { newId } from '../../lib/ids';
import { formatDateLong, formatKg, parseReps, parseWeight, sanitizeRepsTyping, sanitizeWeightTyping } from '../../lib/format';
import type { Day, Session, SetLog } from '../../lib/types';
import { Sheet } from '../../components/Sheet';
import { accentStyle, Button, IconButton } from '../../components/ui';
import { toast } from '../../components/Toast';
import { undoStore } from '../../lib/repo';

export interface CellTarget {
  day: Day;
  row: GridRow;
  week: number;
  blockStart: string;
  session: Session | null;
}

/** Edit the sets behind one cell of the grid. Changes go straight to the exercise history. */
export function CellEditorSheet({ target, onClose }: { target: CellTarget | null; onClose: () => void }) {
  const [, navigate] = useLocation();
  const [sessionId, setSessionId] = useState<string | null>(null);
  useEffect(() => setSessionId(target?.session?.id ?? null), [target]);
  const data = useLiveQuery(() => (target ? loadCellLogs(sessionId, target.row.exerciseKey) : undefined), [sessionId, target?.row.exerciseKey]);

  if (!target) return null;
  const { day, row, week, blockStart } = target;
  const date = target.session?.date ?? dateInBlock(blockStart, week, day.weekday ?? 1);
  const logs = data?.logs ?? [];

  const addSet = async () => {
    const id = sessionId ?? (await ensureSessionFor(day.key, week, blockStart, date));
    setSessionId(id);
    const session = await db.sessions.get(id);
    const prev = logs.at(-1);
    const base = Date.parse(session?.startedAt ?? `${date}T12:00:00.000Z`);
    const log: SetLog = {
      id: newId(),
      sessionId: id,
      slotId: row.slotId,
      exerciseKey: row.exerciseKey,
      setIndex: (prev?.setIndex ?? -1) + 1,
      weightKg: prev?.weightKg ?? null,
      reps: prev?.reps ?? null,
      isWarmup: false,
      isSummary: false,
      rawText: null,
      note: null,
      doneAt: new Date(base + (logs.length + 1) * 60_000).toISOString(),
      updatedAt: nowISO(),
      deletedAt: null,
    };
    await action('Serie aggiunta', (w) => w.put('setLogs', log));
  };

  return (
    <Sheet
      open={!!target}
      onClose={onClose}
      title={row.name}
      footer={
        <div style={accentStyle(day.type)} className="flex gap-2">
          <Button variant="secondary" size="lg" className="min-w-0 flex-1 px-3" icon={<Plus size={18} aria-hidden />} onClick={() => void addSet()}>
            Aggiungi serie
          </Button>
          {sessionId && (
            <Button
              variant="primary"
              size="lg"
              className="min-w-0 flex-1 px-3"
              icon={<ExternalLink size={18} aria-hidden />}
              onClick={() => {
                onClose();
                navigate(`/sessione/${sessionId}`);
              }}
            >
              Apri sessione
            </Button>
          )}
        </div>
      }
    >
      <p className="text-[14px] text-muted">
        {day.title} · settimana {week}
        {week === 7 ? ' (scarico)' : ''} · {formatDateLong(date)}
      </p>
      {logs.length === 0 ? (
        <p className="mt-6 mb-2 text-center text-[15px] text-muted">{target.session?.skipped.includes(row.slotId ?? '') ? 'Saltato quella settimana.' : 'Nessuna serie registrata.'}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          <li className="grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)_48px] gap-2 px-1 text-[13px] font-medium text-muted" aria-hidden>
            <span />
            <span className="text-center">Peso (kg)</span>
            <span className="text-center">Rip.</span>
            <span />
          </li>
          {logs.map((l, i) => (
            <CellRow key={l.id} log={l} index={i} />
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function CellRow({ log, index }: { log: SetLog; index: number }) {
  const [w, setW] = useState(formatKg(log.weightKg));
  const [r, setR] = useState(log.isSummary && log.rawText ? displayReps(log) : log.reps === null ? '' : String(log.reps));
  useEffect(() => setW(formatKg(log.weightKg)), [log.weightKg]);
  useEffect(() => setR(log.isSummary && log.rawText ? displayReps(log) : log.reps === null ? '' : String(log.reps)), [log.reps, log.rawText, log.isSummary]);

  const save = async () => {
    const weightKg = parseWeight(w);
    const reps = parseReps(r);
    const rawReps = log.isSummary ? displayReps(log) : null;
    if (weightKg === log.weightKg && (reps === log.reps || r === rawReps)) return;
    await action('Serie modificata', (wr) =>
      wr.patch<SetLog>('setLogs', log.id, {
        weightKg,
        reps,
        // A week 1 summary keeps its flag; the raw text follows the new numbers.
        rawText: log.isSummary ? `${weightKg === null ? '' : String(weightKg)}x${reps ?? ''}` : log.rawText,
      }),
    );
    toast.show('Serie aggiornata', { actionLabel: 'Annulla', onAction: () => void undoStore.undoLast() });
  };

  return (
    <li>
      <div className="grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)_48px] items-center gap-2">
        <span className="text-center text-[15px] font-bold text-muted tnum">{log.isWarmup ? 'R' : index + 1}</span>
        <input
          type="text"
          inputMode="decimal"
          aria-label={`Peso serie ${index + 1} (kg)`}
          className="h-14 w-full min-w-0 rounded-xl border border-transparent bg-raised text-center text-[24px] font-semibold tnum outline-none focus:border-[var(--focus)]"
          value={w}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setW(sanitizeWeightTyping(e.target.value))}
          onBlur={() => void save()}
        />
        <input
          type="text"
          inputMode="numeric"
          aria-label={`Ripetizioni serie ${index + 1}`}
          className="h-14 w-full min-w-0 rounded-xl border border-transparent bg-raised text-center text-[24px] font-semibold tnum outline-none focus:border-[var(--focus)]"
          value={r}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setR(log.isSummary ? e.target.value.replace(/[^\d/]/g, '').slice(0, 5) : sanitizeRepsTyping(e.target.value))}
          onBlur={() => void save()}
        />
        <IconButton
          label={`Elimina serie ${index + 1}`}
          className="text-danger-ink"
          onClick={() => {
            void action('Serie eliminata', (wr) => wr.remove('setLogs', log.id));
            toast.show('Serie eliminata', { actionLabel: 'Annulla', onAction: () => void undoStore.undoLast() });
          }}
        >
          <Trash2 size={20} aria-hidden />
        </IconButton>
      </div>
      {(log.isSummary || log.note) && (
        <p className="mt-1 pl-9 text-[12px] text-muted">
          {log.isSummary && log.rawText && <>Settimana 1, scritto «{log.rawText}»</>}
          {log.note && <span lang="en">{log.isSummary ? ' · ' : ''}{log.note}</span>}
        </p>
      )}
    </li>
  );
}
