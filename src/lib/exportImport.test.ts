import { beforeEach, describe, expect, it } from 'vitest';
import { db, SchedaDB, useDatabase } from './db';
import { ensureSeeded } from './bootstrap';
import { buildCsv, buildExport, ImportError, importBackup } from './exportImport';
import { updateSlot } from './programOps';
import { slotSeedId } from './seed';

let n = 0;
beforeEach(async () => {
  useDatabase(new SchedaDB(`exp-${++n}`));
  await ensureSeeded();
});

describe('export and import', () => {
  it('round-trips into an empty device', async () => {
    const file = await buildExport(new Date('2026-11-30T10:00:00Z'));
    expect(file.setLogs).toHaveLength(25);
    expect(file.slots.every((s) => !('_dirty' in s))).toBe(true);
    useDatabase(new SchedaDB(`exp-empty-${n}`));
    const r = await importBackup(JSON.stringify(file));
    expect(r.added).toBe(28 + 4 + 33 + 4 + 25 + 1);
    expect(await db.setLogs.count()).toBe(25);
  });

  it('last write wins: an older backup does not undo newer edits', async () => {
    const old = await buildExport();
    const id = slotSeedId('upper-a', '1');
    await updateSlot(id, { sets: [4, 4] });
    const r = await importBackup(JSON.stringify(old));
    expect(r.updated).toBe(0);
    expect((await db.slots.get(id))!.sets).toEqual([4, 4]);
  });

  it('a newer backup updates and marks the records for sync', async () => {
    const id = slotSeedId('upper-a', '1');
    const file = await buildExport();
    const slot = file.slots.find((s) => s.id === id) as unknown as { sets: number[]; updatedAt: string };
    slot.sets = [5, 5];
    slot.updatedAt = '2027-01-01T00:00:00.000Z';
    const r = await importBackup(JSON.stringify(file));
    expect(r.updated).toBe(1);
    const saved = (await db.slots.get(id))!;
    expect(saved.sets).toEqual([5, 5]);
    expect(saved._dirty).toBe(1);
  });

  it('rejects files that are not Scheda backups', async () => {
    await expect(importBackup('nope')).rejects.toBeInstanceOf(ImportError);
    await expect(importBackup(JSON.stringify({ app: 'other' }))).rejects.toBeInstanceOf(ImportError);
    await expect(importBackup(JSON.stringify({ app: 'scheda', format: 1, slots: [{ foo: 1 }] }))).rejects.toBeInstanceOf(ImportError);
  });

  it('CSV has one row per set with Italian decimals and the raw week 1 text', async () => {
    const csv = await buildCsv();
    const lines = csv.trim().split('\r\n');
    expect(lines[0].replace('﻿', '')).toBe('data;blocco;settimana;giorno;etichetta;esercizio;serie;riscaldamento;peso_kg;ripetizioni;scritto;nota');
    expect(lines).toHaveLength(26);
    expect(lines.find((l) => l.includes('Lying leg curl'))).toContain(';45;6/7;45x6/7;');
  });
});
