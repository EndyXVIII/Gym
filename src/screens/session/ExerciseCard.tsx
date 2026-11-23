import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeftRight, Check, ChevronDown, CopyCheck, Flame, History, Info, MoreHorizontal, Plus, Repeat2, RotateCcw, SkipForward, Target, Timer, Trash2, TrendingUp, Undo2 } from 'lucide-react';
import { formatDateShort, formatRest, formatSet, roundToStep } from '../../lib/format';
import { muscleGroup, muscleLabel } from '../../lib/muscles';
import { performanceLabel, prefillFor, progressionHint, targetRir, topSet, type Performance } from '../../lib/program';
import { allWorkingDone, appendIndex, buildRows, warmupIndex, type SetRowModel } from '../../lib/sessionRows';
import { addRow, deleteRow, fillRows, saveRow, setDone, setSkipped, setWarmup, type RowTarget, type RowValues } from '../../lib/sessionOps';
import { restTimer } from '../../lib/timer';
import { undoStore } from '../../lib/repo';
import type { Exercise, Session, SetLog, Slot } from '../../lib/types';
import { ActionSheet, type SheetAction } from '../../components/Sheet';
import { Button, Card, Chip, cx, IconButton, IconTile } from '../../components/ui';
import { toast } from '../../components/Toast';
import { SET_GRID, SetRow } from './SetRow';

export interface ExerciseCardProps {
  session: Session;
  /** null = sets logged in this session for an exercise that is not in the day's program. */
  slot: Slot | null;
  exercise: Exercise | undefined;
  exerciseKey: string;
  logs: SetLog[];
  last: Performance | null;
  week: number;
  planned: number;
  /** Rest started when a set is checked (0 = none). */
  restSeconds: number;
  skipped: boolean;
  /** Display name of the slot when the exercise is replaced for today. */
  substitutedFrom: string | null;
  prs: Set<string>;
  loadStep: number;
  /** The next exercise to do: highlighted. */
  isCurrent: boolean;
  media?: ReactNode;
  onChecked?: (slotId: string) => void;
  onDetails: () => void;
  onSubstitute: () => void;
  onClearSubstitution: () => void;
}

export const ExerciseCard = memo(function ExerciseCard(p: ExerciseCardProps) {
  const { session, slot, exercise, exerciseKey, logs, last, week, planned, restSeconds, skipped, substitutedFrom, prs, loadStep, isCurrent } = p;
  const [menuOpen, setMenuOpen] = useState(false);
  const [rowMenu, setRowMenu] = useState<SetRowModel | null>(null);

  const repsMin = slot?.repsMin ?? 8;
  const repsMax = slot?.repsMax ?? 12;
  const rows = useMemo(() => buildRows(logs, skipped ? 0 : planned, last, repsMin), [logs, skipped, planned, last, repsMin]);
  const name = substitutedFrom ? (exercise?.name ?? exerciseKey) : (slot?.name ?? exercise?.name ?? exerciseKey);
  const hint = progressionHint(last, { min: repsMin, max: repsMax }, loadStep, week);
  const lastLabel = last ? performanceLabel(last) : null;
  const complete = allWorkingDone(rows);
  const slotId = slot?.id ?? null;

  // A finished exercise folds up to one line (after a moment, so the last tick is seen); tap to open it again.
  const [open, setOpen] = useState(false);
  const [settled, setSettled] = useState(complete);
  useEffect(() => {
    if (!complete) {
      setSettled(false);
      setOpen(false);
      return;
    }
    const t = window.setTimeout(() => setSettled(true), 700);
    return () => window.clearTimeout(t);
  }, [complete]);
  const collapsed = settled && !open;

  const target = useCallback(
    (row: Pick<SetRowModel, 'setIndex' | 'log' | 'isWarmup'>): RowTarget => ({
      sessionId: session.id,
      slotId,
      exerciseKey,
      setIndex: row.setIndex,
      logId: row.log?.id ?? null,
      isWarmup: row.isWarmup,
    }),
    [session.id, slotId, exerciseKey],
  );

  const onSave = useCallback((row: SetRowModel, v: RowValues) => void saveRow(target(row), v), [target]);

  const onToggle = useCallback(
    (row: SetRowModel, v: RowValues) => {
      const done = !row.done;
      let started = false;
      if (done && restSeconds > 0 && !session.finishedAt) {
        restTimer.start(restSeconds, session.id, name);
        started = true;
      }
      void setDone(target(row), v, done, () => {
        if (started) restTimer.stop();
      }).then(() => {
        if (done && slotId) p.onChecked?.(slotId);
      });
    },
    [restSeconds, session.id, session.finishedAt, name, target, slotId, p],
  );

  const unchecked = rows.filter((r) => !r.done && !r.isWarmup);
  const doneRows = rows.filter((r) => r.done && !r.isWarmup);
  const best = topSet(doneRows.map((r) => ({ weightKg: r.weightKg, reps: r.reps })));

  const applyLast = () => {
    if (!last) return;
    void fillRows(
      unchecked.map((r) => ({ target: target(r), values: prefillFor(last, (r.workingNumber ?? 1) - 1) })),
      'Valori dell’ultima volta',
    );
  };

  const copyLastToAll = () => {
    const top = last ? topSet(last.sets) : null;
    if (!top) return;
    void fillRows(
      unchecked.map((r) => ({ target: target(r), values: { weightKg: top.weightKg, reps: top.reps } })),
      'Ultima volta su tutte le serie',
    );
    toast.show(`${formatSet(top.weightKg, top.reps)} su tutte le serie`, { actionLabel: 'Annulla', onAction: undoLast });
  };

  const applyHint = () => {
    if (hint.kind === 'first') return;
    void fillRows(
      unchecked.map((r) => ({ target: target(r), values: { weightKg: hint.weightKg, reps: hint.reps } })),
      'Obiettivo applicato',
    );
  };

  const addSet = () => {
    const prev = rows.filter((r) => !r.isWarmup).at(-1);
    void addRow(
      { sessionId: session.id, slotId, exerciseKey, setIndex: appendIndex(rows), logId: null },
      { weightKg: prev?.weightKg ?? null, reps: prev?.reps ?? repsMin },
    );
  };

  const addWarmup = () => {
    const first = rows.find((r) => !r.isWarmup);
    const w = first?.weightKg ? roundToStep(first.weightKg * 0.5, loadStep) : null;
    void addRow(
      { sessionId: session.id, slotId, exerciseKey, setIndex: warmupIndex(rows), logId: null, isWarmup: true },
      { weightKg: w, reps: 10 },
      'Riscaldamento aggiunto',
    );
  };

  const skip = (value: boolean) => {
    if (!slotId) return;
    void setSkipped(session.id, slotId, value);
    if (value) toast.show(`${name}: saltato`, { actionLabel: 'Annulla', onAction: undoLast });
  };

  if (skipped && slot) {
    return (
      <Card className="flex items-center gap-3 p-3">
        <NumberTile label={slot.label} state="skipped" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-muted line-through">{name}</p>
          <p className="text-[13px] text-muted">Saltato oggi</p>
        </div>
        <Button variant="secondary" size="sm" icon={<RotateCcw size={16} aria-hidden />} onClick={() => skip(false)}>
          Ripristina
        </Button>
      </Card>
    );
  }

  const menu: SheetAction[] = [
    { label: 'Aggiungi riscaldamento', icon: <Flame size={20} />, onSelect: addWarmup, description: 'Non conta nelle serie e nei totali' },
    { label: 'Copia ultima volta su tutte le serie', icon: <CopyCheck size={20} />, onSelect: copyLastToAll, disabled: !last },
    ...(slot
      ? [
          substitutedFrom
            ? { label: 'Annulla sostituzione', icon: <Undo2 size={20} />, onSelect: p.onClearSubstitution, description: `Torna a ${slot.name}` }
            : { label: 'Sostituisci per oggi', icon: <ArrowLeftRight size={20} />, onSelect: p.onSubstitute, description: 'Il programma resta com’è' },
          { label: 'Salta', icon: <SkipForward size={20} />, onSelect: () => skip(true), description: 'Salta questo esercizio oggi' },
        ]
      : []),
    { label: 'Dettagli esercizio', icon: <Info size={20} />, onSelect: p.onDetails },
  ];

  const rowActions: SheetAction[] = rowMenu
    ? [
        {
          label: rowMenu.isWarmup ? 'Segna come serie di lavoro' : 'Segna come riscaldamento',
          icon: <Flame size={20} />,
          description: 'I riscaldamenti non contano nei totali',
          onSelect: () => void setWarmup(target(rowMenu), { weightKg: rowMenu.weightKg, reps: rowMenu.reps }, !rowMenu.isWarmup),
        },
        {
          label: 'Elimina serie',
          icon: <Trash2 size={20} />,
          tone: 'danger',
          disabled: !rowMenu.log,
          description: rowMenu.log ? undefined : 'Una serie prevista non fatta non viene salvata',
          onSelect: () => {
            if (!rowMenu.log) return;
            void deleteRow(rowMenu.log.id);
            toast.show('Serie eliminata', { actionLabel: 'Annulla', onAction: undoLast });
          },
        },
      ]
    : [];

  const toggleLabel = `${collapsed ? 'Mostra' : 'Nascondi'} le serie: ${name}`;

  return (
    <Card
      as="article"
      aria-label={name}
      aria-current={isCurrent ? 'step' : undefined}
      className={cx(
        'scroll-mt-32 overflow-hidden transition-all duration-300',
        isCurrent && !complete && 'border-[color-mix(in_srgb,var(--accent)_70%,var(--border))] shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent)_45%,transparent),0_18px_40px_-20px_var(--accent)]',
        complete && 'border-[color-mix(in_srgb,var(--success)_40%,var(--border))]',
      )}
    >
      <div className="flex items-start gap-3 p-3">
        <NumberTile label={slot?.label ?? '+'} state={complete ? 'done' : slot ? (isCurrent ? 'current' : 'todo') : 'extra'} />
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="text-[17px] leading-snug font-bold">
            {complete ? (
              <button type="button" aria-expanded={!collapsed} onClick={() => setOpen((o) => !o)} className="pressable w-full text-left" aria-label={toggleLabel}>
                {name}
              </button>
            ) : (
              name
            )}
          </h2>
          {collapsed && best ? (
            <p className="mt-0.5 text-[13px] font-semibold text-success-ink tnum">
              {doneRows.length} serie · {best.weightKg === null ? `${best.reps ?? '—'} rip.` : formatSet(best.weightKg, best.reps)}
            </p>
          ) : (
            <>
              {substitutedFrom && <p className="mt-0.5 text-[13px] text-muted">Sostituisce per oggi: {substitutedFrom}</p>}
              {!slot && <p className="mt-0.5 text-[13px] text-muted">Fuori programma</p>}
              {isCurrent && !complete && !substitutedFrom && slot && <p className="eyebrow mt-0.5 text-accent-ink">Ora tocca a te</p>}
            </>
          )}
        </div>
        {collapsed ? (
          <IconButton label={toggleLabel} size={48} className="-mr-1 shrink-0 text-muted" onClick={() => setOpen(true)}>
            <ChevronDown size={22} aria-hidden />
          </IconButton>
        ) : (
          <>
            <IconButton label={`Dettagli: ${name}`} size={48} className="-mr-1 shrink-0 text-muted" onClick={p.onDetails}>
              <Info size={21} aria-hidden />
            </IconButton>
            <IconButton label={`Altre azioni: ${name}`} size={48} className="-mr-2 shrink-0 text-muted" onClick={() => setMenuOpen(true)}>
              <MoreHorizontal size={22} aria-hidden />
            </IconButton>
          </>
        )}
      </div>

      <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: collapsed ? '0fr' : '1fr' }} inert={collapsed}>
        <div className="min-h-0 overflow-hidden">
          {p.media && <div className="px-3">{p.media}</div>}

          {slot && (
            <div className="mt-3 flex flex-wrap gap-1.5 px-3">
              <Chip icon={<Repeat2 size={14} aria-hidden />}>
                {planned} × {slot.reps}
              </Chip>
              <Chip icon={<Target size={14} aria-hidden />}>RIR {targetRir(slot.rir, slot.kind, week)}</Chip>
              {slot.restSeconds > 0 && <Chip icon={<Timer size={14} aria-hidden />}>Recupero {formatRest(slot.restSeconds)}</Chip>}
              {slot.singleArm && <Chip tone="warning">un braccio alla volta</Chip>}
            </div>
          )}

          {exercise && (exercise.primary.length > 0 || exercise.secondary.length > 0) && (
            <ul className="mt-2 flex flex-wrap gap-1.5 px-3" aria-label="Muscoli">
              {exercise.primary.map((m) => (
                <li key={m}>
                  <Chip tone={muscleGroup(m)}>{muscleLabel(m)}</Chip>
                </li>
              ))}
              {exercise.secondary.map((m) => (
                <li key={m}>
                  <Chip tone="muted">{muscleLabel(m)}</Chip>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex flex-col gap-1.5 px-3">
            {lastLabel && last ? (
              <button
                type="button"
                onClick={applyLast}
                className="pressable flex min-h-14 w-full items-center gap-3 rounded-[20px] bg-raised px-3 text-left"
                aria-label={`Ultima volta: ${formatSet(lastLabel.weightKg, lastLabel.reps)}. Tocca per inserire questi valori`}
              >
                <IconTile tone="slate" size={34}>
                  <History size={17} />
                </IconTile>
                <span className="min-w-0 flex-1 text-[15px]">
                  Ultima volta: <span className="font-extrabold tnum">{formatSet(lastLabel.weightKg, lastLabel.reps)}</span>
                  {last.sets.length > 1 && <span className="text-muted tnum"> · {last.sets.length} serie</span>}
                </span>
                <span className="shrink-0 text-[13px] text-muted">{formatDateShort(last.session.date)}</span>
              </button>
            ) : (
              <p className="flex min-h-10 items-center gap-2.5 px-1 text-[14px] text-muted">
                <History size={18} aria-hidden /> Nessuno storico: prima volta.
              </p>
            )}
            {hint.kind !== 'first' ? (
              <button
                type="button"
                onClick={applyHint}
                className="pressable grad-accent-soft flex min-h-12 w-full items-center gap-2.5 rounded-[18px] px-3 text-left"
                aria-label={`${hint.text}. Tocca per applicarlo alle serie non fatte`}
              >
                <TrendingUp size={18} className="shrink-0 text-accent-ink" aria-hidden />
                <span className="text-[14px] font-semibold text-accent-ink">{hint.text}</span>
              </button>
            ) : (
              <p className="px-1 text-[14px] text-muted">{hint.text}</p>
            )}
          </div>

          <div className="mt-3 px-1.5 pb-1">
            {rows.length > 0 && (
              <div className={cx(SET_GRID, 'px-0.5 pb-1 text-[12px] font-bold tracking-wide text-muted uppercase')} aria-hidden>
                <span className="text-center">Serie</span>
                <span className="col-span-3 text-center">Peso (kg)</span>
                <span className="text-center">Rip.</span>
                <span />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              {rows.map((r) => (
                <SetRow key={r.key} row={r} step={loadStep} isPr={!!r.log && prs.has(r.log.id)} onSave={onSave} onToggle={onToggle} onMenu={setRowMenu} exerciseName={name} />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 pt-1 pb-3">
            <Button variant="ghost" size="md" icon={<Plus size={18} aria-hidden />} onClick={addSet} className="text-accent-ink">
              Aggiungi serie
            </Button>
          </div>
        </div>
      </div>

      <ActionSheet open={menuOpen} onClose={() => setMenuOpen(false)} title={name} actions={menu} />
      <ActionSheet
        open={!!rowMenu}
        onClose={() => setRowMenu(null)}
        title={rowMenu ? (rowMenu.isWarmup ? 'Riscaldamento' : `Serie ${rowMenu.workingNumber}`) : ''}
        actions={rowActions}
      />
    </Card>
  );
});

function NumberTile({ label, state }: { label: string; state: 'done' | 'current' | 'todo' | 'extra' | 'skipped' }) {
  if (state === 'done') {
    return (
      <IconTile tone="green" size={40}>
        <Check size={22} strokeWidth={3.4} />
        <span className="sr-only">Esercizio completato</span>
      </IconTile>
    );
  }
  if (state === 'current') {
    return (
      <span className="grad-accent glow-accent flex h-10 min-w-10 shrink-0 items-center justify-center rounded-[14px] px-1 text-[17px] font-extrabold text-on-accent tnum" aria-hidden>
        {label}
      </span>
    );
  }
  return (
    <span
      className={cx(
        'flex h-10 min-w-10 shrink-0 items-center justify-center rounded-[14px] px-1 text-[17px] font-extrabold tnum',
        state === 'todo' ? 'bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] text-accent-ink' : 'bg-raised text-muted',
      )}
      aria-hidden
    >
      {label}
    </span>
  );
}

function undoLast() {
  void undoStore.undoLast();
}
