import { beforeEach, describe, expect, it } from 'vitest';
import { db, SchedaDB, useDatabase } from './db';
import { ensureSeeded } from './bootstrap';
import { buildExport, importBackup } from './exportImport';
import { migrateMoreUpperSets, migrateNoSupersets, migrateWeekOverride, MORE_UPPER_SETS } from './migrations';
import { SEED_TIME, slotSeedId } from './seed';
import type { Slot } from './types';

let n = 0;
beforeEach(async () => {
  useDatabase(new SchedaDB(`mig-${++n}`));
  await ensureSeeded();
});

/** What an old device has: the pair 6a/6b of Upper A with superset fields. */
async function makeOldPair(): Promise<{ a: Slot; b: Slot }> {
  const a = (await db.slots.get(slotSeedId('upper-a', '6a')))!;
  const b = (await db.slots.get(slotSeedId('upper-a', '6b')))!;
  const oldA = { ...a, label: '6a', superset: { group: 'upper-a:6', role: 'a' as const }, restSeconds: 0, restText: 'go straight to 6b' };
  const oldB = { ...b, label: '6b', superset: { group: 'upper-a:6', role: 'b' as const }, restSeconds: 60 };
  await db.slots.bulkPut([oldA, oldB]);
  return { a: oldA, b: oldB };
}

describe('no more supersets', () => {
  it('a fresh seed needs no migration', async () => {
    expect(await migrateNoSupersets()).toBe(0);
  });

  it('old pairs become separate, numbered exercises with a rest of their own', async () => {
    await makeOldPair();
    expect(await migrateNoSupersets()).toBe(2);
    const a = (await db.slots.get(slotSeedId('upper-a', '6a')))!;
    const b = (await db.slots.get(slotSeedId('upper-a', '6b')))!;
    expect([a.label, a.superset, a.restSeconds, a.restText]).toEqual(['6', null, 90, '90 s']);
    expect([b.label, b.superset, b.restSeconds]).toEqual(['7', null, 60]);
    // same exercises, same order, history untouched
    expect([a.exerciseKey, b.exerciseKey]).toEqual(['overhead-cable-triceps-extension', 'bayesian-cable-curl']);
    expect(await db.setLogs.count()).toBe(25);
    // the fix is a normal edit: newer than the seed and marked for sync
    expect(a.updatedAt > SEED_TIME).toBe(true);
    expect(a._dirty).toBe(1);
  });

  it('is idempotent', async () => {
    await makeOldPair();
    await migrateNoSupersets();
    expect(await migrateNoSupersets()).toBe(0);
  });

  it('does not touch exercises I set up with no rest on purpose', async () => {
    const id = slotSeedId('upper-b', '6');
    await db.slots.put({ ...(await db.slots.get(id))!, restSeconds: 0 });
    expect(await migrateNoSupersets()).toBe(0);
    expect((await db.slots.get(id))!.restSeconds).toBe(0);
  });

  it('an old backup with supersets is cleaned on import', async () => {
    const file = await buildExport();
    const slots = file.slots as unknown as Slot[];
    const a = slots.find((s) => s.id === slotSeedId('upper-a', '6a'))!;
    Object.assign(a, { label: '6a', superset: { group: 'x', role: 'a' }, restSeconds: 0, updatedAt: '2026-11-17T00:00:00.000Z' });
    useDatabase(new SchedaDB(`mig-import-${n}`));
    await importBackup(JSON.stringify(file));
    const saved = (await db.slots.get(slotSeedId('upper-a', '6a')))!;
    expect([saved.superset, saved.restSeconds, saved.label]).toEqual([null, 90, '6']);
  });
});

describe('more serie from week 4 reach a device that already has the program', () => {
  /** A device from before the change: the old numbers and notes, no migration done. */
  async function makeOldDevice() {
    for (const c of MORE_UPPER_SETS) {
      const slot = (await db.slots.get(slotSeedId(c.dayKey, c.seedLabel)))!;
      await db.slots.put({ ...slot, sets: [...c.from.sets], note: c.from.note ?? slot.note });
    }
    await db.meta.delete('migrations');
  }
  const slotOf = async (dayKey: string, label: string) => (await db.slots.get(slotSeedId(dayKey, label)))!;

  it('a fresh install already has them: nothing to change', async () => {
    expect(await migrateMoreUpperSets()).toBe(0);
    expect(await migrateMoreUpperSets()).toBe(0);
  });

  it('an old device gets the 7 changes once, with weeks 1-3 untouched', async () => {
    await makeOldDevice();
    expect((await slotOf('upper-a', '6a')).sets).toEqual([4, 4]);
    expect(await migrateMoreUpperSets()).toBe(7);
    for (const c of MORE_UPPER_SETS) {
      const slot = await slotOf(c.dayKey, c.seedLabel);
      expect(slot.sets).toEqual(c.to.sets);
      expect(slot.sets[0]).toBe(c.from.sets[0]);
      expect(slot._dirty).toBe(1); // a normal edit: it syncs
      if (c.to.note) expect(slot.note).toBe(c.to.note);
    }
    expect((await slotOf('upper-a', '6a')).sets).toEqual([4, 6]);
    expect((await slotOf('upper-b', '5a')).sets).toEqual([4, 5]);
    // the exercises, the order and the past numbers are as they were
    expect(await db.setLogs.count()).toBe(25);
    expect((await slotOf('upper-a', '6a')).exerciseKey).toBe('overhead-cable-triceps-extension');
    // a second start does nothing, even if I later put the old number back by hand
    await db.slots.put({ ...(await slotOf('upper-a', '6a')), sets: [4, 4] });
    expect(await migrateMoreUpperSets()).toBe(0);
    expect((await slotOf('upper-a', '6a')).sets).toEqual([4, 4]);
  });

  it('a slot I changed by hand is left alone, and so is a note I wrote', async () => {
    await makeOldDevice();
    await db.slots.put({ ...(await slotOf('upper-a', '3')), sets: [3, 6] });
    await db.slots.put({ ...(await slotOf('upper-a', '5')), note: 'my own note' });
    expect(await migrateMoreUpperSets()).toBe(6);
    expect((await slotOf('upper-a', '3')).sets).toEqual([3, 6]);
    expect((await slotOf('upper-a', '5')).sets).toEqual([3, 5]);
    expect((await slotOf('upper-a', '5')).note).toBe('my own note');
  });
});

describe('the block is 6 weeks: an old week override of 7 is cleared', () => {
  it('7 goes back to automatic, a valid week stays', async () => {
    const s = (await db.settings.toArray())[0];
    await db.settings.put({ ...s, weekOverride: 7 });
    expect(await migrateWeekOverride()).toBe(true);
    expect((await db.settings.get(s.id))!.weekOverride).toBeNull();
    await db.settings.put({ ...s, weekOverride: 5, updatedAt: '2030-01-01T00:00:00.000Z' });
    expect(await migrateWeekOverride()).toBe(false);
    expect((await db.settings.get(s.id))!.weekOverride).toBe(5);
  });
});
