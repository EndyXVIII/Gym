import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation } from 'wouter';
import { ArrowLeftRight, History, Link2, Pencil, Trash2, Unlink } from 'lucide-react';
import { db } from '../../lib/db';
import { deleteSlot, pairWithNext, swapExercise, unpair, updateSlot } from '../../lib/programOps';
import { parseRange } from '../../lib/program';
import { formatRest } from '../../lib/format';
import { undoStore } from '../../lib/repo';
import type { Slot } from '../../lib/types';
import { Sheet, ConfirmSheet } from '../../components/Sheet';
import { Button, cx, Field, inputClass, Segmented, Switch } from '../../components/ui';
import { Stepper } from '../../components/Stepper';
import { ExercisePicker } from '../../components/ExercisePicker';
import { toast } from '../../components/Toast';
import { ExerciseEditorSheet } from './ExerciseEditorSheet';

const REST_OPTIONS = [0, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300];

async function loadSlotContext(id: string) {
  const slot = await db.slots.get(id);
  if (!slot || slot.deletedAt) return null;
  const siblings = (await db.slots.where('dayKey').equals(slot.dayKey).toArray()).filter((s) => !s.deletedAt).sort((a, b) => a.position - b.position);
  const exercise = (await db.exercises.where('key').equals(slot.exerciseKey).toArray()).find((e) => !e.deletedAt);
  const i = siblings.findIndex((s) => s.id === id);
  const partner = slot.superset ? siblings.find((s) => s.id !== id && s.superset?.group === slot.superset!.group) : undefined;
  return { slot, exercise, next: siblings[i + 1], partner };
}

/** Everything about one exercise of a day, editable from the phone. Changes save by themselves. */
export function SlotEditorSheet({ slotId, onClose }: { slotId: string | null; onClose: () => void }) {
  const ctx = useLiveQuery(() => (slotId ? loadSlotContext(slotId) : null), [slotId]);
  const [, navigate] = useLocation();
  const [swapOpen, setSwapOpen] = useState(false);
  const [exerciseOpen, setExerciseOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!slotId || !ctx) return null;
  const { slot, exercise, next, partner } = ctx;

  return (
    <>
      <Sheet open={!!slotId && !swapOpen && !exerciseOpen && !confirmDelete} onClose={onClose} title={`${slot.label} · ${slot.name}`}>
        <SlotForm key={slot.id} slot={slot} />

        <div className="mt-5 rounded-2xl border border-line p-3">
          <p className="text-[13px] font-medium text-muted">Esercizio in libreria</p>
          <p className="mt-0.5 text-[16px] font-semibold">{exercise?.name ?? slot.exerciseKey}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" icon={<ArrowLeftRight size={16} aria-hidden />} onClick={() => setSwapOpen(true)}>
              Sostituisci
            </Button>
            <Button variant="secondary" size="sm" icon={<Pencil size={16} aria-hidden />} onClick={() => setExerciseOpen(true)} disabled={!exercise}>
              Modifica
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            block
            className="mt-1"
            icon={<History size={16} aria-hidden />}
            onClick={() => {
              onClose();
              navigate(`/storico/esercizio/${encodeURIComponent(slot.exerciseKey)}`);
            }}
          >
            Storico di questo esercizio
          </Button>
        </div>

        <div className="mt-3 rounded-2xl border border-line p-3">
          <p className="text-[13px] font-medium text-muted">Superserie</p>
          {partner ? (
            <>
              <p className="mt-0.5 text-[15px]">
                In coppia con <span className="font-semibold">{partner.label} {partner.name}</span>
              </p>
              <Button variant="secondary" size="sm" block className="mt-3" icon={<Unlink size={16} aria-hidden />} onClick={() => void unpair(slot.id)}>
                Separa la superserie
              </Button>
            </>
          ) : next && !next.superset ? (
            <Button
              variant="secondary"
              size="sm"
              block
              className="mt-2"
              icon={<Link2 size={16} aria-hidden />}
              onClick={async () => {
                if (await pairWithNext(slot.id)) toast.show('Superserie: fai la a, poi subito la b, poi 1 minuto di recupero');
              }}
            >
              Abbina con {next.label} {next.name}
            </Button>
          ) : (
            <p className="mt-1 text-[14px] text-muted">Per creare una superserie, porta l’esercizio da abbinare subito sotto questo.</p>
          )}
        </div>

        <Button variant="danger" block className="mt-4" icon={<Trash2 size={18} aria-hidden />} onClick={() => setConfirmDelete(true)}>
          Togli dal giorno
        </Button>
        <p className="mt-2 mb-1 text-center text-[12px] text-muted">Lo storico dell’esercizio resta.</p>
      </Sheet>

      <ExercisePicker
        open={swapOpen}
        onClose={() => setSwapOpen(false)}
        title="Sostituisci nel programma"
        hint={`Da ora in poi ${slot.label} usa l’esercizio scelto. ${exercise?.name ?? 'Il vecchio'} resta in libreria con il suo storico.`}
        currentKey={slot.exerciseKey}
        onPick={async (key) => {
          setSwapOpen(false);
          if (key === slot.exerciseKey) return;
          await swapExercise(slot.id, { key });
          toast.show('Esercizio sostituito', { actionLabel: 'Annulla', onAction: () => void undoStore.undoLast() });
        }}
        onCreate={async (name) => {
          setSwapOpen(false);
          await swapExercise(slot.id, { newName: name });
          toast.show(`Nuovo esercizio: ${name}`, { actionLabel: 'Annulla', onAction: () => void undoStore.undoLast() });
        }}
      />
      <ExerciseEditorSheet open={exerciseOpen} onClose={() => setExerciseOpen(false)} exercise={exercise} />
      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Togliere ${slot.name}?`}
        text="Esce da questo giorno. Le serie già fatte restano nello storico dell’esercizio."
        confirmLabel="Togli dal giorno"
        danger
        onConfirm={async () => {
          await deleteSlot(slot.id);
          onClose();
          toast.show('Esercizio tolto', { actionLabel: 'Annulla', onAction: () => void undoStore.undoLast() });
        }}
      />
    </>
  );
}

function SlotForm({ slot }: { slot: Slot }) {
  const [name, setName] = useState(slot.name);
  const [reps, setReps] = useState(slot.reps);
  const [rir, setRir] = useState(slot.rir);
  const [note, setNote] = useState(slot.note);
  const [demo, setDemo] = useState(slot.demo);
  useEffect(() => setName(slot.name), [slot.name]);
  useEffect(() => setReps(slot.reps), [slot.reps]);
  useEffect(() => setRir(slot.rir), [slot.rir]);
  useEffect(() => setNote(slot.note), [slot.note]);
  useEffect(() => setDemo(slot.demo), [slot.demo]);

  const repsValid = !!parseRange(reps);
  const rirValid = !!parseRange(rir);
  const isA = slot.superset?.role === 'a';

  return (
    <div className="flex flex-col gap-4">
      <Field label="Nome in questo giorno" htmlFor="slot-name">
        <input id="slot-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== slot.name && void updateSlot(slot.id, { name: name.trim() })} />
      </Field>

      <fieldset>
        <legend className="mb-1.5 px-1 text-[13px] font-medium text-muted">Serie</legend>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-raised p-2 text-center">
            <p className="text-[12px] text-muted">Settimane 1-3</p>
            <Stepper className="justify-center" label="Serie settimane 1-3" value={slot.sets[0]} max={10} onChange={(v) => void updateSlot(slot.id, { sets: [v, Math.max(v, slot.sets[1])] })} />
          </div>
          <div className="rounded-2xl bg-raised p-2 text-center">
            <p className="text-[12px] text-muted">Dalla settimana 4</p>
            <Stepper className="justify-center" label="Serie dalla settimana 4" value={slot.sets[1]} max={10} onChange={(v) => void updateSlot(slot.id, { sets: [slot.sets[0], v] })} />
          </div>
        </div>
        <p className="mt-1.5 px-1 text-[12px] text-muted">0 nelle settimane 1-3 = l’esercizio compare dalla settimana 4. Lo scarico usa metà del secondo numero.</p>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Ripetizioni" htmlFor="slot-reps" hint={repsValid ? undefined : 'Es. 6-10'}>
          <input
            id="slot-reps"
            className={cx(inputClass, 'tnum', !repsValid && 'border-danger')}
            inputMode="text"
            value={reps}
            onChange={(e) => setReps(e.target.value.replace(/[^\d\-–]/g, '').slice(0, 7))}
            onBlur={() => repsValid && reps !== slot.reps && void updateSlot(slot.id, { reps })}
          />
        </Field>
        <Field label="RIR" htmlFor="slot-rir" hint={rirValid ? undefined : 'Es. 1-2'}>
          <input
            id="slot-rir"
            className={cx(inputClass, 'tnum', !rirValid && 'border-danger')}
            value={rir}
            onChange={(e) => setRir(e.target.value.replace(/[^\d\-–]/g, '').slice(0, 5))}
            onBlur={() => rirValid && rir !== slot.rir && void updateSlot(slot.id, { rir })}
          />
        </Field>
      </div>

      <Field label={isA ? 'Recupero (la «a» passa subito alla «b»)' : 'Recupero'} htmlFor="slot-rest">
        <select id="slot-rest" className={inputClass} value={slot.restSeconds} onChange={(e) => void updateSlot(slot.id, { restSeconds: Number(e.target.value) })}>
          {[...new Set([...REST_OPTIONS, slot.restSeconds])].sort((a, b) => a - b).map((s) => (
            <option key={s} value={s}>
              {s === 0 ? 'Nessuno (subito il prossimo)' : formatRest(s)}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Tipo">
        <Segmented
          label="Tipo di esercizio"
          value={slot.kind}
          onChange={(v) => void updateSlot(slot.id, { kind: v })}
          options={[
            { value: 'compound', label: 'Multiarticolare' },
            { value: 'isolation', label: 'Isolamento' },
          ]}
        />
      </Field>

      <Switch label="Un braccio alla volta" description="Una riga copre entrambe le braccia" checked={slot.singleArm} onChange={(v) => void updateSlot(slot.id, { singleArm: v })} />

      <Field label="Nota" htmlFor="slot-note">
        <textarea id="slot-note" lang="en" className={cx(inputClass, 'min-h-24 py-3')} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== slot.note && void updateSlot(slot.id, { note })} />
      </Field>

      <Field label="Link «Guarda»" htmlFor="slot-demo">
        <input id="slot-demo" type="url" inputMode="url" className={inputClass} value={demo} onChange={(e) => setDemo(e.target.value)} onBlur={() => demo !== slot.demo && void updateSlot(slot.id, { demo })} />
      </Field>
    </div>
  );
}
