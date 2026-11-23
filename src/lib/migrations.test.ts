import { beforeEach, describe, expect, it } from 'vitest';
import { db, SchedaDB, useDatabase } from './db';
import { ensureSeeded } from './bootstrap';
import { buildExport, importBackup } from './exportImport';
import { migrateNoSupersets } from './migrations';
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
