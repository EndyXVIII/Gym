import { beforeEach, describe, expect, it } from 'vitest';
import { db, SchedaDB, useDatabase } from './db';
import { ensureSeeded } from './bootstrap';
import { addDay, deleteDay, reorderSlots, swapExercise, updateDay, updateSlot } from './programOps';
import { lastPerformance } from './program';
import { slotSeedId } from './seed';
import { undoStore } from './repo';

let n = 0;
beforeEach(async () => {
  useDatabase(new SchedaDB(`test-${++n}`));
  undoStore.clear();
  await ensureSeeded();
});

const labels = async (dayKey: string) =>
  (await db.slots.where('dayKey').equals(dayKey).toArray())
    .filter((s) => !s.deletedAt)
    .sort((a, b) => a.position - b.position)
    .map((s) => `${s.label}:${s.exerciseKey}`);

async function last(key: string) {
  const logs = await db.setLogs.toArray();
  const sessions = new Map((await db.sessions.toArray()).map((s) => [s.id, s]));
  return lastPerformance(key, logs, sessions);
}

describe('seed import', () => {
  it('is idempotent: importing twice creates no duplicates', async () => {
    const before = await Promise.all([db.exercises.count(), db.slots.count(), db.setLogs.count(), db.sessions.count()]);
    await db.meta.delete('seedVersion');
    await ensureSeeded();
    const after = await Promise.all([db.exercises.count(), db.slots.count(), db.setLogs.count(), db.sessions.count()]);
    expect(after).toEqual(before);
    expect(before).toEqual([28, 33, 25, 4]);
  });

  it('never overwrites a record that is already there', async () => {
    const id = slotSeedId('upper-a', '1');
    await updateSlot(id, { sets: [4, 4] });
    await db.meta.delete('seedVersion');
    await ensureSeeded();
    expect((await db.slots.get(id))!.sets).toEqual([4, 4]);
  });
});

describe('program editor', () => {
  it('swapping an exercise creates a new library exercise and keeps the old history', async () => {
    const id = slotSeedId('upper-a', '1');
    await swapExercise(id, { newName: 'Smith machine press' });
    const slot = (await db.slots.get(id))!;
    expect(slot.exerciseKey).toBe('smith-machine-press');
    expect(slot.name).toBe('Smith machine press');
    const ex = (await db.exercises.where('key').equals('smith-machine-press').first())!;
    expect(ex.primary).toEqual(['chest']); // muscles copied from the old exercise
    expect(await db.exercises.where('key').equals('bench-press').count()).toBe(1);
    const p = await last('bench-press');
    expect(p?.sets[0].weightKg).toBe(20);
    expect(await last('smith-machine-press')).toBeNull();
  });

  it('swapping to an existing library exercise', async () => {
    const id = slotSeedId('upper-b', '1');
    await swapExercise(id, { key: 'incline-dumbbell' });
    expect((await db.slots.get(id))!.exerciseKey).toBe('incline-dumbbell');
    expect((await last('incline-dumbbell'))?.sets[0].weightKg).toBe(24);
  });

  it('changing sets or reps never deletes past logs', async () => {
    const before = await db.setLogs.count();
    const id = slotSeedId('upper-a', '2');
    await updateSlot(id, { sets: [2, 2], reps: '8-12' });
    const slot = (await db.slots.get(id))!;
    expect([slot.repsMin, slot.repsMax]).toEqual([8, 12]);
    expect(await db.setLogs.count()).toBe(before);
    expect((await last('lat-pulldown'))?.sets[0].weightKg).toBe(70);
  });

  it('reordering renumbers the exercises 1..n', async () => {
    const ids = (await db.slots.where('dayKey').equals('upper-a').toArray()).sort((a, b) => a.position - b.position).map((s) => s.id);
    // Drag the last exercise (Bayesian curl) to the top.
    await reorderSlots('upper-a', [ids[6], ...ids.slice(0, 6)]);
    expect(await labels('upper-a')).toEqual([
      '1:bayesian-cable-curl',
      '2:bench-press',
      '3:lat-pulldown',
      '4:chest-supported-row',
      '5:pec-deck',
      '6:cable-lateral-raise',
      '7:overhead-cable-triceps-extension',
    ]);
    expect((await db.slots.get(ids[6]))!.restSeconds).toBe(60); // its rest does not change
  });

  it('adds a fifth day with a weekday, deletes it softly', async () => {
    const day = await addDay();
    await updateDay(day.id, { weekday: 3, title: 'Arms', type: 'upper' });
    const saved = (await db.days.get(day.id))!;
    expect(saved.weekday).toBe(3);
    expect((await db.days.toArray()).filter((d) => !d.deletedAt)).toHaveLength(5);
    await deleteDay(day.id);
    expect((await db.days.get(day.id))!.deletedAt).not.toBeNull();
  });

  it('undo puts a swap back', async () => {
    const id = slotSeedId('lower-a', '1');
    await swapExercise(id, { key: 'leg-press' });
    expect((await db.slots.get(id))!.exerciseKey).toBe('leg-press');
    await undoStore.undoLast();
    expect((await db.slots.get(id))!.exerciseKey).toBe('hack-squat');
  });

  it('every write is stamped and marked for sync', async () => {
    const id = slotSeedId('lower-a', '2');
    await updateSlot(id, { note: 'test' });
    const s = (await db.slots.get(id))!;
    expect(s._dirty).toBe(1);
    expect(s.updatedAt > '2026-11-16T00:00:00.000Z').toBe(true);
  });
});
