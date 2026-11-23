import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation } from 'wouter';
import { BookOpen, Check, ChevronLeft, MoreHorizontal, PieChart, StickyNote, Trash2, Undo2 } from 'lucide-react';
import { useSettings } from '../../app/SettingsContext';
import { useKeyboardInset, useNow, useWakeLock } from '../../lib/hooks';
import { DEFAULT_LOAD_STEP, isWorkingDone, setsForWeek } from '../../lib/program';
import { loadSessionView, type SessionView } from '../../lib/queries';
import { allWorkingDone, buildRows } from '../../lib/sessionRows';
import { discardSession, finishSession, setSubstitution, updateSessionNote } from '../../lib/sessionOps';
import { action, undoStore } from '../../lib/repo';
import { restTimer } from '../../lib/timer';
import { createExercise } from '../../lib/libraryOps';
import { capitalize, formatDateLong, formatDuration } from '../../lib/format';
import type { Slot } from '../../lib/types';
import { accentStyle, Button, cx, EmptyState, IconButton, IconTile, inputClass, ScreenSkeleton } from '../../components/ui';
import { ActionSheet, ConfirmSheet, Sheet } from '../../components/Sheet';
import { ExercisePicker } from '../../components/ExercisePicker';
import { ExerciseDetailSheet } from '../../components/ExerciseDetailSheet';
import { ExerciseMedia } from '../../components/ExerciseMedia';
import { MediaControls } from '../../components/MediaControls';
import { SyncDot } from '../../components/SyncDot';
import { toast } from '../../components/Toast';
import { RulesSheet } from '../today/RulesSheet';
import { ExerciseCard } from './ExerciseCard';
import { RestTimerBar } from './RestTimerBar';
import { FinishSheet } from './FinishSheet';

export default function SessionScreen({ id }: { id: string }) {
  const view = useLiveQuery(() => loadSessionView(id), [id]);
  const [, navigate] = useLocation();
  if (view === undefined) return <ScreenSkeleton />;
  if (view === null) {
    return (
      <div className="px-4 pt-safe">
        <div className="pt-16">
          <EmptyState
            title="Allenamento non trovato"
            text="Forse è stato eliminato, o non è ancora arrivato da un altro dispositivo."
            action={<Button onClick={() => navigate('/')}>Torna a Oggi</Button>}
          />
        </div>
      </div>
    );
  }
  return <SessionBody view={view} />;
}

function SessionBody({ view }: { view: SessionView }) {
  const settings = useSettings();
  const [, navigate] = useLocation();
  const { session, day, slots } = view;
  const finished = !!session.finishedAt;
  const week = session.week;

  useWakeLock(!finished);
  const keyboard = useKeyboardInset();
  const now = useNow(30_000);
  const undoEntry = useSyncExternalStore(undoStore.subscribe, undoStore.getSnapshot, undoStore.getSnapshot);

  const [finishOpen, setFinishOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [detailsFor, setDetailsFor] = useState<{ slot: Slot | null; key: string } | null>(null);
  const [substituteFor, setSubstituteFor] = useState<Slot | null>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const pendingScroll = useRef<string | null>(null);

  // Start every session with a clean undo history.
  useEffect(() => undoStore.clear(), [session.id]);

  const visibleSlots = useMemo(
    () => slots.filter((s) => setsForWeek(s.sets, week, settings.extraSets) > 0 || (view.logsBySlot.get(s.id)?.length ?? 0) > 0),
    [slots, week, settings.extraSets, view.logsBySlot],
  );

  const keyFor = useCallback((s: Slot) => session.substitutions[s.id] ?? s.exerciseKey, [session.substitutions]);
  const loadStepFor = (key: string) => view.exercises.get(key)?.loadStepKg ?? settings.defaultLoadStepKg ?? DEFAULT_LOAD_STEP;

  const isComplete = useCallback(
    (s: Slot) => {
      if (session.skipped.includes(s.id)) return true;
      const rows = buildRows(view.logsBySlot.get(s.id) ?? [], setsForWeek(s.sets, week, settings.extraSets), view.last.get(keyFor(s)) ?? null, s.repsMin);
      return allWorkingDone(rows);
    },
    [session.skipped, view.logsBySlot, view.last, week, settings.extraSets, keyFor],
  );

  const currentId = useMemo(() => (finished ? null : (visibleSlots.find((s) => !isComplete(s))?.id ?? null)), [finished, visibleSlots, isComplete]);

  // After the last set of an exercise, bring the next one into view (once the finished one has folded up).
  useEffect(() => {
    const from = pendingScroll.current;
    if (from === null) return;
    pendingScroll.current = null;
    const i = visibleSlots.findIndex((s) => s.id === from);
    if (i < 0 || !isComplete(visibleSlots[i])) return;
    const next = visibleSlots.find((s, j) => j > i && !isComplete(s));
    if (!next) return;
    window.setTimeout(() => cardRefs.current.get(next.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 950);
  }, [view, visibleSlots, isComplete]);

  const onChecked = useCallback((slotId: string) => {
    pendingScroll.current = slotId;
  }, []);

  const allLogs = useMemo(() => [...[...view.logsBySlot.values()].flat(), ...[...view.orphanLogs.values()].flat()], [view.logsBySlot, view.orphanLogs]);
  const doneSets = allLogs.filter(isWorkingDone).length;
  const minutes = session.startedAt ? (finished ? Date.parse(session.finishedAt!) : now) - Date.parse(session.startedAt) : 0;

  // Progress of the whole workout: sets done / sets planned.
  const planned = useMemo(() => {
    let total = 0;
    for (const s of visibleSlots) {
      if (session.skipped.includes(s.id)) continue;
      const done = (view.logsBySlot.get(s.id) ?? []).filter(isWorkingDone).length;
      total += Math.max(done, setsForWeek(s.sets, week, settings.extraSets));
    }
    for (const logs of view.orphanLogs.values()) total += logs.filter(isWorkingDone).length;
    return total;
  }, [visibleSlots, session.skipped, view.logsBySlot, view.orphanLogs, week, settings.extraSets]);
  const progress = planned > 0 ? Math.min(1, doneSets / planned) : 0;
  const allDone = !finished && doneSets > 0 && visibleSlots.every(isComplete);

  const finish = async (note: string) => {
    await finishSession(session.id, note);
    restTimer.stop();
    setFinishOpen(false);
    undoStore.clear();
    toast.show('Allenamento salvato. Bravo!', { tone: 'success' });
    navigate('/');
  };

  const discard = async () => {
    await discardSession(session.id);
    restTimer.stop();
    setFinishOpen(false);
    toast.show('Allenamento eliminato', { actionLabel: 'Annulla', onAction: () => void undoStore.undoLast() });
    navigate('/');
  };

  const undo = async () => {
    const e = await undoStore.undoLast();
    if (e) toast.show(`Annullato: ${e.label.toLowerCase()}`);
  };

  const pickSubstitute = async (exerciseKey: string) => {
    const slot = substituteFor;
    setSubstituteFor(null);
    if (!slot) return;
    if (exerciseKey === slot.exerciseKey) await setSubstitution(session.id, slot.id, null);
    else await setSubstitution(session.id, slot.id, exerciseKey);
  };

  const createSubstitute = async (name: string) => {
    const slot = substituteFor;
    setSubstituteFor(null);
    if (!slot) return;
    const template = view.exercises.get(slot.exerciseKey) ?? null;
    const ex = await action('Nuovo esercizio', (w) => createExercise(w, name, template));
    await setSubstitution(session.id, slot.id, ex.key);
  };

  const footerHeight = finished ? 88 : 96;

  return (
    <div style={accentStyle(day?.type)} className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-[var(--glass)] pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150">
        <div className="flex min-h-14 items-center gap-1 px-1">
          <IconButton label="Torna a Oggi" onClick={() => navigate('/')}>
            <ChevronLeft size={26} aria-hidden />
          </IconButton>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[18px] font-extrabold">{day?.title ?? 'Allenamento'}</h1>
            <p className="truncate text-[13px] text-muted tnum">
              Settimana {week}
              {week === 7 ? ' · Scarico' : ''} · {finished ? capitalize(formatDateLong(session.date)) : `${formatDuration(minutes)} · ${doneSets} serie`}
            </p>
          </div>
          <SyncDot className="px-2" />
          <IconButton label={undoEntry ? `Annulla: ${undoEntry.label}` : 'Niente da annullare'} disabled={!undoEntry} onClick={() => void undo()}>
            <Undo2 size={22} aria-hidden />
          </IconButton>
          <IconButton label="Menu allenamento" onClick={() => setMenuOpen(true)}>
            <MoreHorizontal size={24} aria-hidden />
          </IconButton>
        </div>
        <div
          className="h-1.5 bg-[color-mix(in_srgb,var(--text)_8%,transparent)]"
          role="progressbar"
          aria-label="Avanzamento dell’allenamento"
          aria-valuemin={0}
          aria-valuemax={planned}
          aria-valuenow={Math.min(doneSets, planned)}
          aria-valuetext={`${doneSets} serie su ${planned}`}
        >
          <div className="grad-accent h-full rounded-r-full transition-[width] duration-500 ease-out" style={{ width: `${progress * 100}%` }} />
        </div>
      </header>

      {finished && (
        <div className="card-surface mx-3 mt-3 flex items-center gap-3 rounded-[22px] p-3">
          <IconTile tone="green" size={44}>
            <Check size={22} strokeWidth={3.4} />
          </IconTile>
          <p className="min-w-0 flex-1 text-[14px] text-muted">
            <span className="block text-[16px] font-extrabold text-ink">Allenamento completato</span>
            Puoi correggere le serie: ogni modifica si salva da sola.
          </p>
          <Button variant="secondary" size="sm" icon={<PieChart size={16} aria-hidden />} onClick={() => setSummaryOpen(true)}>
            Riepilogo
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-3.5 px-3 pt-3" style={{ paddingBottom: footerHeight + 160 + keyboard }}>
        {visibleSlots.map((s) => {
          const key = keyFor(s);
          const substituted = key !== s.exerciseKey;
          return (
            <div
              key={s.id}
              ref={(el) => {
                if (el) cardRefs.current.set(s.id, el);
                else cardRefs.current.delete(s.id);
              }}
              className="scroll-mt-24"
            >
              <ExerciseCard
                session={session}
                slot={s}
                exercise={view.exercises.get(key)}
                exerciseKey={key}
                logs={view.logsBySlot.get(s.id) ?? emptyLogs}
                last={view.last.get(key) ?? null}
                week={week}
                planned={setsForWeek(s.sets, week, settings.extraSets)}
                restSeconds={s.restSeconds}
                skipped={session.skipped.includes(s.id)}
                substitutedFrom={substituted ? s.name : null}
                prs={view.prs}
                loadStep={loadStepFor(key)}
                isCurrent={s.id === currentId}
                media={<ExerciseMedia exercise={view.exercises.get(key)} name={substituted ? (view.exercises.get(key)?.name ?? key) : s.name} className="mx-auto" />}
                onChecked={onChecked}
                onDetails={() => setDetailsFor({ slot: s, key })}
                onSubstitute={() => setSubstituteFor(s)}
                onClearSubstitution={() => void setSubstitution(session.id, s.id, null)}
              />
            </div>
          );
        })}

        {[...view.orphanLogs.entries()].map(([key, logs]) => (
          <ExerciseCard
            key={`orphan:${key}`}
            session={session}
            slot={null}
            exercise={view.exercises.get(key)}
            exerciseKey={key}
            logs={logs}
            last={view.last.get(key) ?? null}
            week={week}
            planned={0}
            restSeconds={0}
            skipped={false}
            substitutedFrom={null}
            prs={view.prs}
            loadStep={loadStepFor(key)}
            isCurrent={false}
            media={<ExerciseMedia exercise={view.exercises.get(key)} name={view.exercises.get(key)?.name ?? key} />}
            onDetails={() => setDetailsFor({ slot: null, key })}
            onSubstitute={() => undefined}
            onClearSubstitution={() => undefined}
          />
        ))}

        {visibleSlots.length === 0 && view.orphanLogs.size === 0 && <EmptyState title="Nessun esercizio questa settimana" text="Aggiungi esercizi al giorno in Programma." />}
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[520px] px-3 pt-2 pb-[max(env(safe-area-inset-bottom),12px)]"
        style={{ transform: keyboard ? `translateY(-${keyboard}px)` : undefined }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 -top-8 bg-[linear-gradient(to_bottom,transparent,var(--bg)_55%)]" />
        <div className="relative flex flex-col gap-2">
          <RestTimerBar sessionId={session.id} />
          {!keyboard &&
            (finished ? (
              <Button variant="secondary" size="lg" block onClick={() => navigate('/storico')}>
                Chiudi
              </Button>
            ) : (
              <Button variant={allDone ? 'success' : 'primary'} size="lg" block className={cx(allDone && 'sheen')} onClick={() => setFinishOpen(true)}>
                Termina allenamento
              </Button>
            ))}
        </div>
      </div>

      <FinishSheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        session={session}
        day={day}
        logs={allLogs}
        prs={view.prs}
        exercises={view.exercises}
        onFinish={(note) => void finish(note)}
        onDiscard={() => void discard()}
      />
      <FinishSheet open={summaryOpen} onClose={() => setSummaryOpen(false)} mode="review" session={session} day={day} logs={allLogs} prs={view.prs} exercises={view.exercises} />

      <ActionSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={day?.title ?? 'Allenamento'}
        actions={[
          { label: 'Riepilogo e muscoli', icon: <PieChart size={20} />, onSelect: () => setSummaryOpen(true), description: 'Mappa dei muscoli di questo allenamento e della settimana' },
          { label: 'Nota dell’allenamento', icon: <StickyNote size={20} />, onSelect: () => setNoteOpen(true) },
          { label: 'Regole del programma', icon: <BookOpen size={20} />, onSelect: () => setRulesOpen(true) },
          { label: 'Elimina allenamento', icon: <Trash2 size={20} />, tone: 'danger', onSelect: () => setConfirmDiscard(true) },
        ]}
      />
      <ConfirmSheet
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="Eliminare l’allenamento?"
        text="Le serie di questa sessione spariscono dallo storico. Puoi annullare subito dopo."
        confirmLabel="Elimina"
        danger
        onConfirm={() => void discard()}
      />
      <NoteSheet open={noteOpen} onClose={() => setNoteOpen(false)} initial={session.note} onSave={(n) => void updateSessionNote(session.id, n)} />
      <RulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} week={week} />
      <ExerciseDetailSheet
        open={!!detailsFor}
        onClose={() => setDetailsFor(null)}
        exercise={detailsFor ? view.exercises.get(detailsFor.key) : undefined}
        slot={detailsFor?.slot ?? null}
        loadStep={detailsFor ? loadStepFor(detailsFor.key) : DEFAULT_LOAD_STEP}
      >
        {detailsFor && view.exercises.get(detailsFor.key) && (
          <div className="mt-5">
            <MediaControls exercise={view.exercises.get(detailsFor.key)!} />
          </div>
        )}
      </ExerciseDetailSheet>
      <ExercisePicker
        open={!!substituteFor}
        onClose={() => setSubstituteFor(null)}
        title="Sostituisci per oggi"
        hint={substituteFor ? `Solo per questa sessione: le serie vanno all’esercizio scelto, ${substituteFor.name} resta nel programma.` : undefined}
        currentKey={substituteFor ? keyFor(substituteFor) : undefined}
        onPick={(k) => void pickSubstitute(k)}
        onCreate={(n) => void createSubstitute(n)}
      />
    </div>
  );
}

const emptyLogs: never[] = [];

function NoteSheet({ open, onClose, initial, onSave }: { open: boolean; onClose: () => void; initial: string; onSave: (n: string) => void }) {
  const [text, setText] = useState(initial);
  useEffect(() => {
    if (open) setText(initial);
  }, [open, initial]);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Nota dell’allenamento"
      footer={
        <Button
          variant="primary"
          size="lg"
          block
          onClick={() => {
            onSave(text);
            onClose();
          }}
        >
          Salva nota
        </Button>
      }
    >
      <label className="block">
        <span className="sr-only">Nota</span>
        <textarea className={cx(inputClass, 'min-h-32 py-3')} value={text} onChange={(e) => setText(e.target.value)} placeholder="Sensazioni, macchine occupate, dolori…" />
      </label>
    </Sheet>
  );
}
