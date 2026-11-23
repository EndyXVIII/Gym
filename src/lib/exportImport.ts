/** Backup: JSON export/import (merge, last write wins) and a CSV of every set for Excel. */
import { db, SYNCED_TABLES } from './db';
import { runMigrations } from './migrations';
import { notifyLocalChange } from './repo';
import { displayReps } from './program';
import type { SyncFields, SyncedTable } from './types';

export const EXPORT_FORMAT = 1;

export type ExportFile = {
  app: 'scheda';
  format: number;
  exportedAt: string;
} & Record<SyncedTable, SyncFields[]>;

function strip<T extends SyncFields>(r: T): T {
  const { _dirty: _ignored, ...rest } = r;
  return rest as T;
}

/** Everything, soft-deleted records included (so a restore keeps the deletes). Photos are not included. */
export async function buildExport(now = new Date()): Promise<ExportFile> {
  const out = { app: 'scheda', format: EXPORT_FORMAT, exportedAt: now.toISOString() } as ExportFile;
  for (const t of SYNCED_TABLES) out[t] = ((await db.table(t).toArray()) as SyncFields[]).map(strip);
  return out;
}

export interface ImportResult {
  added: number;
  updated: number;
  unchanged: number;
}

export class ImportError extends Error {}

/** Merges a backup: a record is taken only if it's new or newer than mine. */
export async function importBackup(text: string): Promise<ImportResult> {
  let data: Partial<ExportFile>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportError('Il file non è un JSON valido.');
  }
  if (!data || data.app !== 'scheda' || typeof data.format !== 'number') throw new ImportError('Questo file non è un backup di Scheda.');
  if (data.format > EXPORT_FORMAT) throw new ImportError('Il backup viene da una versione più nuova dell’app: aggiorna Scheda e riprova.');
  const result: ImportResult = { added: 0, updated: 0, unchanged: 0 };
  for (const t of SYNCED_TABLES) {
    const rows = data[t];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) throw new ImportError(`Sezione «${t}» non valida.`);
    for (const r of rows) {
      if (!r || typeof r.id !== 'string' || typeof r.updatedAt !== 'string') throw new ImportError(`Un record di «${t}» non ha id o data di modifica.`);
    }
    const table = db.table(t);
    const existing = (await table.bulkGet(rows.map((r) => r.id))) as (SyncFields | undefined)[];
    const toPut: SyncFields[] = [];
    rows.forEach((r, i) => {
      const mine = existing[i];
      if (!mine) {
        result.added += 1;
        toPut.push({ ...strip(r), _dirty: 1 });
      } else if (Date.parse(r.updatedAt) > Date.parse(mine.updatedAt)) {
        result.updated += 1;
        toPut.push({ ...strip(r), _dirty: 1 });
      } else {
        result.unchanged += 1;
      }
    });
    if (toPut.length) await table.bulkPut(toPut);
  }
  if (result.added || result.updated) {
    await runMigrations(); // an old backup may still have supersets
    notifyLocalChange();
  }
  return result;
}

/* ------------------------------------------------------------------ CSV */

function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One row per set, ";" separated with decimal commas (opens directly in Excel set to Italian). */
export async function buildCsv(): Promise<string> {
  const [sessions, logs, days, exercises, slots] = await Promise.all([db.sessions.toArray(), db.setLogs.toArray(), db.days.toArray(), db.exercises.toArray(), db.slots.toArray()]);
  const sessionById = new Map(sessions.filter((s) => !s.deletedAt).map((s) => [s.id, s]));
  const dayByKey = new Map(days.map((d) => [d.key, d]));
  const exByKey = new Map(exercises.map((e) => [e.key, e]));
  const slotById = new Map(slots.map((s) => [s.id, s]));
  const header = ['data', 'blocco', 'settimana', 'giorno', 'etichetta', 'esercizio', 'serie', 'riscaldamento', 'peso_kg', 'ripetizioni', 'scritto', 'nota'];
  const rows = logs
    .filter((l) => !l.deletedAt && l.doneAt && sessionById.has(l.sessionId))
    .map((l) => ({ l, s: sessionById.get(l.sessionId)! }))
    .sort((a, b) => a.s.date.localeCompare(b.s.date) || (a.l.doneAt ?? '').localeCompare(b.l.doneAt ?? '') || a.l.setIndex - b.l.setIndex);
  const lines = [header.join(';')];
  const counter = new Map<string, number>();
  for (const { l, s } of rows) {
    const k = `${s.id}:${l.exerciseKey}`;
    const n = l.isWarmup ? 0 : (counter.get(k) ?? 0) + 1;
    if (!l.isWarmup) counter.set(k, n);
    lines.push(
      [
        s.date,
        s.blockStart,
        s.week,
        dayByKey.get(s.dayKey)?.title ?? s.dayKey,
        l.slotId ? (slotById.get(l.slotId)?.label ?? '') : '',
        exByKey.get(l.exerciseKey)?.name ?? l.exerciseKey,
        l.isWarmup ? '' : n,
        l.isWarmup ? 'sì' : '',
        l.weightKg === null ? '' : String(l.weightKg).replace('.', ','),
        l.isSummary ? displayReps(l) : (l.reps ?? ''),
        l.rawText ?? '',
        l.note ?? '',
      ]
        .map(csvCell)
        .join(';'),
    );
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/* ------------------------------------------------------------------ files */

export function backupFileName(ext: 'json' | 'csv', now = new Date()): string {
  const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `scheda-${d}.${ext}`;
}

/** On the phone: the share sheet (Save to Files, AirDrop...). On the Mac: a normal download. */
export async function saveFile(name: string, blob: Blob): Promise<void> {
  const file = new File([blob], name, { type: blob.type });
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  if (coarse && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
