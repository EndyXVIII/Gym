import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation } from 'wouter';
import { BookOpen, ChevronLeft, Link2, MoreHorizontal, StickyNote, Trash2, Undo2 } from 'lucide-react';
import { useSettings } from '../../app/SettingsContext';
import { useKeyboardInset, useNow, useWakeLock } from '../../lib/hooks';
import { DEFAULT_LOAD_STEP, groupSlots, setsForWeek } from '../../lib/program';
import { loadSessionView, type SessionView } from '../../lib/queries';
import { allWorkingDone, buildRows } from '../../lib/sessionRows';
import { discardSession, finishSession, setSubstitution, updateSessionNote } from '../../lib/sessionOps';
import { action, undoStore } from '../../lib/repo';
import { restTimer } from '../../lib/timer';
import { createExercise } from '../../lib/libraryOps';
import { capitalize, formatDateLong, formatDuration } from '../../lib/format';
import type { Slot } from '../../lib/types';
import { accentStyle, Button, cx, EmptyState, IconButton, inputClass, ScreenSkeleton } from '../../components/ui';
import { ActionSheet, ConfirmSheet, Sheet } from '../../components/Sheet';
import { ExercisePicker } from '../../components/ExercisePicker';
import { ExerciseDetailSheet } from '../../components/ExerciseDetailSheet';
import { SyncDot } from '../../components/SyncDot';
import { toast } from '../../components/Toast';
import { RulesSheet } from '../today/RulesSheet';
import { ExerciseCard } from './ExerciseCard';
import { ExerciseMedia } from '../../components/ExerciseMedia';
import { MediaControls } from '../../components/MediaControls';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [detailsFor, setDetailsFor] = useState<{ slot: Slot | null; key: string } | null>(null);
  const [substituteFor, setSubstituteFor] = useState<Slot | null>(null);
  const groupRefs = useRef(new Map<number, HTMLDivElement>());
  const pendingScroll = useRef<number | null>(null);

  // Start every session with a clean undo history.
  useEffect(() => undoStore.clear(), [session.id]);

  const visibleSlots = useMemo(
    () => slots.filter((s) => setsForWeek(s.sets, week, settings.extraSets) > 0 || (view.logsBySlot.get(s.id)?.length ?? 0) > 0),
    [slots, week, settings.extraSets, view.logsBySlot],
  );
  const groups = useMemo(() => groupSlots(visibleSlots), [visibleSlots]);

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

  // After the last set of an exercise (or of both halves of a superset), bring the next one into view.
  useEffect(() => {
    const from = pendingScroll.current;
    if (from === null) return;
    pendingScroll.current = null;
    if (!groups[from]?.every(isComplete)) return;
    const next = groups.findIndex((g, i) => i > from && !g.every(isComplete));
    if (next < 0) return;
    window.setTimeout(() => groupRefs.current.get(next)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
  }, [view, groups, isComplete]);

  const onChecked = useCallback(
    (slotId: string) => {
      pendingScroll.current = groups.findIndex((g) => g.some((s) => s.id === slotId));
    },
    [groups],
  );

  const restFor = (s: Slot): number => {
    if (s.superset?.role === 'a') {
      // "a" starts no timer, unless its "b" is skipped or hidden this week.
      const partner = slots.find((x) => x.superset?.group === s.superset?.group && x.id !== s.id);
      const partnerOff = !partner || session.skipped.includes(partner.id) || setsForWeek(partner.sets, week, settings.extraSets) === 0;
      return partnerOff ? (partner?.restSeconds ?? 60) : 0;
    }
    return s.restSeconds;
  };

  const allLogs = useMemo(() => [...[...view.logsBySlot.values()].flat(), ...[...view.orphanLogs.values()].flat()], [view.logsBySlot, view.orphanLogs]);
  const doneSets = allLogs.filter((l) => l.doneAt && !l.isWarmup).length;
  const minutes = session.startedAt ? (finished ? Date.parse(session.finishedAt!) : now) - Date.parse(session.startedAt) : 0;

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
      <header className="sticky top-0 z-30 border-b border-line bg-[var(--tabbar)] pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150">
        <div className="flex min-h-14 items-center gap-1 px-1">
          <IconButton label="Torna a Oggi" onClick={() => navigate('/')}>
            <ChevronLeft size={26} aria-hidden />
          </IconButton>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-bold">{day?.title ?? 'Allenamento'}</h1>
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
      </header>

      {finished && (
        <p className="mx-3 mt-3 rounded-2xl bg-raised px-4 py-3 text-[14px] text-muted">
          Allenamento completato. Puoi correggere le serie: ogni modifica si salva da sola.
        </p>
      )}

      <div className="flex flex-col gap-4 px-3 pt-3" style={{ paddingBottom: footerHeight + 160 + keyboard }}>
        {groups.map((g, gi) => (
          <div
            key={g[0].id}
            ref={(el) => {
              if (el) groupRefs.current.set(gi, el);
              else groupRefs.current.delete(gi);
            }}
            className={cx('scroll-mt-24', g.length > 1 && 'relative')}
          >
            {g.length > 1 && <span aria-hidden className="absolute top-8 bottom-8 left-[-6px] w-[3px] rounded-full bg-[color-mix(in_srgb,var(--accent)_55%,transparent)]" />}
            {g.map((s, i) => {
              const key = keyFor(s);
              const substituted = key !== s.exerciseKey;
              return (
                <Fragment key={s.id}>
                  {i > 0 && (
                    <div className="flex items-center gap-2 py-2 pl-3 text-[13px] font-semibold text-accent-ink" aria-label="Superserie: poi subito la b">
                      <Link2 size={16} aria-hidden /> poi subito la b
                    </div>
                  )}
                  <ExerciseCard
                    session={session}
                    slot={s}
                    exercise={view.exercises.get(key)}
                    exerciseKey={key}
                    logs={view.logsBySlot.get(s.id) ?? emptyLogs}
                    last={view.last.get(key) ?? null}
                    week={week}
                    planned={setsForWeek(s.sets, week, settings.extraSets)}
                    restSeconds={restFor(s)}
                    skipped={session.skipped.includes(s.id)}
                    substitutedFrom={substituted ? s.name : null}
                    prs={view.prs}
                    loadStep={loadStepFor(key)}
                    media={<ExerciseMedia exercise={view.exercises.get(key)} name={substituted ? (view.exercises.get(key)?.name ?? key) : s.name} className="mx-auto" />}
                    onChecked={onChecked}
                    onDetails={() => setDetailsFor({ slot: s, key })}
                    onSubstitute={() => setSubstituteFor(s)}
                    onClearSubstitution={() => void setSubstitution(session.id, s.id, null)}
                  />
                </Fragment>
              );
            })}
          </div>
        ))}

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
            media={<ExerciseMedia exercise={view.exercises.get(key)} name={view.exercises.get(key)?.name ?? key} />}
            onDetails={() => setDetailsFor({ slot: null, key })}
            onSubstitute={() => undefined}
            onClearSubstitution={() => undefined}
          />
        ))}

        {groups.length === 0 && view.orphanLogs.size === 0 && (
          <EmptyState title="Nessun esercizio questa settimana" text="Aggiungi esercizi al giorno in Programma." />
        )}
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[520px] px-3 pt-2 pb-[max(env(safe-area-inset-bottom),12px)]"
        style={{ transform: keyboard ? `translateY(-${keyboard}px)` : undefined }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 -top-6 bg-[linear-gradient(to_bottom,transparent,var(--bg)_40%)]" />
        <div className="relative flex flex-col gap-2">
          <RestTimerBar sessionId={session.id} />
          {!keyboard &&
            (finished ? (
              <Button variant="secondary" size="lg" block onClick={() => navigate('/storico')}>
                Chiudi
              </Button>
            ) : (
              <Button variant="primary" size="lg" block onClick={() => setFinishOpen(true)}>
                Termina allenamento
              </Button>
            ))}
        </div>
      </div>

      <FinishSheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        session={session}
        logs={allLogs}
        prs={view.prs}
        exercises={view.exercises}
        onFinish={(note) => void finish(note)}
        onDiscard={() => void discard()}
      />

      <ActionSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={day?.title ?? 'Allenamento'}
        actions={[
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
