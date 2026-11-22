/** Writes for the Programma editor. Days, slots and exercises are data: nothing is hard-coded. */
import { db } from './db';
import { newId } from './ids';
import { createExercise } from './libraryOps';
import { normalizeOrder, parseRange } from './program';
import { action, type Writer } from './repo';
import type { Day, DayType, Exercise, Slot } from './types';

const alive = <T extends { deletedAt: string | null }>(rows: T[]) => rows.filter((r) => !r.deletedAt);

async function daySlots(dayKey: string): Promise<Slot[]> {
  return alive(await db.slots.where('dayKey').equals(dayKey).toArray()).sort((a, b) => a.position - b.position);
}

/** Normalizes the order (pairs adjacent, roles, labels) and writes only the slots that changed. */
async function writeNormalized(w: Writer, stored: Slot[], ordered: Slot[]): Promise<void> {
  const byId = new Map(stored.map((s) => [s.id, s]));
  for (const s of normalizeOrder(ordered)) {
    const before = byId.get(s.id);
    if (!before || JSON.stringify({ ...before, _dirty: undefined }) !== JSON.stringify({ ...s, _dirty: undefined })) await w.put('slots', s);
  }
}

async function renormalize(w: Writer, dayKey: string): Promise<void> {
  const stored = await daySlots(dayKey);
  await writeNormalized(w, stored, stored);
}

/* ------------------------------------------------------------------ days */

export async function addDay(): Promise<Day> {
  return action('Giorno aggiunto', async (w) => {
    const days = alive(await db.days.toArray());
    const n = days.length + 1;
    const day: Day = {
      id: newId(),
      key: `day-${newId().slice(0, 8)}`,
      title: `Giorno ${n}`,
      weekday: null,
      type: 'upper',
      estimatedMinutes: 60,
      position: Math.max(0, ...days.map((d) => d.position)) + 1,
      updatedAt: '',
      deletedAt: null,
    };
    return w.put('days', day);
  });
}

export async function updateDay(id: string, changes: Partial<Pick<Day, 'title' | 'weekday' | 'type' | 'estimatedMinutes'>>): Promise<void> {
  await action('Giorno modificato', (w) => w.patch<Day>('days', id, changes));
}

/** Soft-deletes the day and its slots. Sessions and logs stay in the history. */
export async function deleteDay(id: string): Promise<void> {
  await action('Giorno eliminato', async (w) => {
    const day = await db.days.get(id);
    if (!day) return;
    await w.remove('days', id);
    for (const s of await daySlots(day.key)) await w.remove('slots', s.id);
  });
}

export async function moveDay(id: string, dir: -1 | 1): Promise<void> {
  await action('Ordine dei giorni', async (w) => {
    const days = alive(await db.days.toArray()).sort((a, b) => a.position - b.position);
    const i = days.findIndex((d) => d.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= days.length) return;
    [days[i], days[j]] = [days[j], days[i]];
    for (let k = 0; k < days.length; k++) if (days[k].position !== k + 1) await w.put('days', { ...days[k], position: k + 1 });
  });
}

/* ------------------------------------------------------------------ slots */

export async function reorderSlots(dayKey: string, orderedIds: string[]): Promise<void> {
  await action('Ordine degli esercizi', async (w) => {
    const stored = await daySlots(dayKey);
    const byId = new Map(stored.map((s) => [s.id, s]));
    const ordered = orderedIds.map((id) => byId.get(id)).filter((s): s is Slot => !!s);
    for (const s of stored) if (!orderedIds.includes(s.id)) ordered.push(s);
    await writeNormalized(w, stored, ordered);
  });
}

export type SlotChanges = Partial<Pick<Slot, 'name' | 'sets' | 'reps' | 'rir' | 'restSeconds' | 'kind' | 'note' | 'demo' | 'singleArm'>>;

export async function updateSlot(id: string, changes: SlotChanges): Promise<void> {
  await action('Esercizio modificato', async (w) => {
    const extra: Partial<Slot> = {};
    if (changes.reps !== undefined) {
      const r = parseRange(changes.reps);
      if (r) {
        extra.repsMin = r.min;
        extra.repsMax = r.max;
        extra.reps = r.min === r.max ? String(r.min) : `${r.min}-${r.max}`;
      }
    }
    if (changes.restSeconds !== undefined) extra.restText = changes.restSeconds === 0 ? 'go straight to the next' : `${changes.restSeconds} s`;
    await w.patch<Slot>('slots', id, { ...changes, ...extra });
  });
}

export async function addSlot(dayKey: string, exercise: Exercise): Promise<Slot> {
  return action('Esercizio aggiunto', async (w) => {
    const slots = await daySlots(dayKey);
    const slot: Slot = {
      id: newId(),
      dayKey,
      label: String(slots.length + 1),
      exerciseKey: exercise.key,
      name: exercise.name,
      sets: [3, 3],
      reps: '8-12',
      repsMin: 8,
      repsMax: 12,
      rir: '0-1',
      restSeconds: 90,
      restText: '90 s',
      superset: null,
      kind: 'isolation',
      note: '',
      demo: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${exercise.name} proper form`)}`,
      position: slots.length + 1,
      singleArm: false,
      updatedAt: '',
      deletedAt: null,
    };
    const saved = await w.put('slots', slot);
    await renormalize(w, dayKey);
    return saved;
  });
}

export async function addSlotWithNewExercise(dayKey: string, name: string): Promise<Slot> {
  const ex = await action('Nuovo esercizio', (w) => createExercise(w, name, null));
  return addSlot(dayKey, ex);
}

export async function deleteSlot(id: string): Promise<void> {
  await action('Esercizio tolto dal giorno', async (w) => {
    const slot = await db.slots.get(id);
    if (!slot) return;
    await w.remove('slots', id);
    await renormalize(w, slot.dayKey);
  });
}

/** Pairs a slot with the next one as a superset (a = this one, b = the next). */
export async function pairWithNext(id: string): Promise<boolean> {
  return action('Superserie creata', async (w) => {
    const slot = await db.slots.get(id);
    if (!slot) return false;
    const stored = await daySlots(slot.dayKey);
    const i = stored.findIndex((s) => s.id === id);
    const next = stored[i + 1];
    if (!next || slot.superset || next.superset) return false;
    const group = newId();
    const rest = next.restSeconds > 0 ? Math.min(next.restSeconds, 90) : 60;
    const ordered = stored.map((s) =>
      s.id === slot.id
        ? { ...s, superset: { group, role: 'a' as const } }
        : s.id === next.id
          ? { ...s, superset: { group, role: 'b' as const }, restSeconds: rest }
          : s,
    );
    await writeNormalized(w, stored, ordered);
    return true;
  });
}

/** Splits a superset: both exercises go back to their own rest. */
export async function unpair(id: string): Promise<void> {
  await action('Superserie separata', async (w) => {
    const slot = await db.slots.get(id);
    if (!slot?.superset) return;
    const stored = await daySlots(slot.dayKey);
    const ordered = stored.map((s) => (s.superset?.group === slot.superset!.group ? { ...s, superset: null, restSeconds: s.restSeconds || 90 } : s));
    await writeNormalized(w, stored, ordered);
  });
}

/**
 * Swaps the exercise of a slot (e.g. Smith press -> barbell bench press).
 * The old exercise stays in the library with its history; past logs are untouched.
 */
export async function swapExercise(slotId: string, target: { key: string } | { newName: string }): Promise<void> {
  await action('Esercizio sostituito nel programma', async (w) => {
    const slot = await db.slots.get(slotId);
    if (!slot) return;
    let ex: Exercise | undefined;
    if ('newName' in target) {
      const old = (await db.exercises.where('key').equals(slot.exerciseKey).toArray()).find((e) => !e.deletedAt) ?? null;
      ex = await createExercise(w, target.newName, old);
    } else {
      ex = (await db.exercises.where('key').equals(target.key).toArray()).find((e) => !e.deletedAt);
    }
    if (!ex) return;
    await w.patch<Slot>('slots', slotId, {
      exerciseKey: ex.key,
      name: ex.name,
      demo: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${ex.name} proper form`)}`,
    });
  });
}

/* ------------------------------------------------------------------ library */

export type ExerciseChanges = Partial<Pick<Exercise, 'name' | 'equipment' | 'primary' | 'secondary' | 'loadStepKg' | 'photoId' | 'preferMuscleMap'>>;

export async function updateExercise(id: string, changes: ExerciseChanges): Promise<void> {
  await action('Esercizio modificato', (w) => w.patch<Exercise>('exercises', id, changes));
}

export function dayTypeLabel(t: DayType): string {
  return t === 'upper' ? 'Parte alta' : 'Parte bassa';
}
