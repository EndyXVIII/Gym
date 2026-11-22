/**
 * Every local write goes through a Writer: it stamps updatedAt, marks the record
 * dirty for sync, soft-deletes, and remembers the previous state so the action
 * can be undone.
 */
import { db } from './db';
import type { SyncFields, SyncedTable } from './types';

type AnyRecord = SyncFields & Record<string, unknown>;

let lastStamp = 0;
/** ISO timestamp, strictly increasing within this tab (two writes in the same ms stay ordered). */
export function nowISO(): string {
  let t = Date.now();
  if (t <= lastStamp) t = lastStamp + 1;
  lastStamp = t;
  return new Date(t).toISOString();
}

/* ------------------------------------------------------------------ change listeners */

type Listener = () => void;
const listeners = new Set<Listener>();

export function onLocalChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notifyLocalChange(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* a listener must never break a write */
    }
  }
}

/* ------------------------------------------------------------------ writer */

interface Before {
  table: SyncedTable;
  id: string;
  before: AnyRecord | undefined;
}

export class Writer {
  private touched = new Map<string, Before>();

  private async remember(table: SyncedTable, id: string): Promise<void> {
    const k = `${table}:${id}`;
    if (this.touched.has(k)) return;
    const before = (await db.table(table).get(id)) as AnyRecord | undefined;
    this.touched.set(k, { table, id, before: before ? structuredClone(before) : undefined });
  }

  /** Inserts or replaces a whole record. */
  async put<T extends SyncFields>(table: SyncedTable, record: T): Promise<T> {
    await this.remember(table, record.id);
    const next = { ...record, updatedAt: nowISO(), _dirty: 1 as const };
    await db.table(table).put(next);
    return next;
  }

  async bulkPut<T extends SyncFields>(table: SyncedTable, records: T[]): Promise<T[]> {
    const out: T[] = [];
    for (const r of records) out.push(await this.put(table, r));
    return out;
  }

  /** Merges changes into an existing record. Returns undefined if it doesn't exist. */
  async patch<T extends SyncFields>(table: SyncedTable, id: string, changes: Partial<T>): Promise<T | undefined> {
    const current = (await db.table(table).get(id)) as T | undefined;
    if (!current) return undefined;
    return this.put(table, { ...current, ...changes, id });
  }

  /** Soft delete: the record stays, with deletedAt set, so the delete syncs. */
  async remove(table: SyncedTable, id: string): Promise<void> {
    const current = (await db.table(table).get(id)) as SyncFields | undefined;
    if (!current || current.deletedAt) return;
    await this.put(table, { ...current, deletedAt: nowISO() });
  }

  get changed(): boolean {
    return this.touched.size > 0;
  }

  /** Restores every touched record to its state before this writer ran. */
  undoSteps(): Before[] {
    return [...this.touched.values()];
  }
}

/** Runs `fn` with a Writer, then notifies sync. Returns the writer so callers can register undo. */
export async function write<R>(fn: (w: Writer) => Promise<R>): Promise<{ result: R; writer: Writer }> {
  const w = new Writer();
  const result = await db.transaction('rw', ['exercises', 'days', 'slots', 'sessions', 'setLogs', 'settings', 'media'], () => fn(w));
  if (w.changed) notifyLocalChange();
  return { result, writer: w };
}

/** Puts records back as they were (as new writes, so the undo syncs too). */
export async function revert(steps: Before[]): Promise<void> {
  await write(async (w) => {
    for (const s of steps) {
      if (s.before) {
        await w.put(s.table, s.before as SyncFields);
      } else {
        await w.remove(s.table, s.id);
      }
    }
  });
}

/* ------------------------------------------------------------------ undo stack */

export interface UndoEntry {
  id: number;
  label: string;
  steps: Before[];
  /** Extra work to undo outside the database (e.g. stop the rest timer it started). */
  after?: () => void;
  at: number;
}

let undoStack: UndoEntry[] = [];
let undoSeq = 0;
const undoListeners = new Set<Listener>();

function emitUndo() {
  for (const fn of undoListeners) fn();
}

export const undoStore = {
  subscribe(fn: Listener) {
    undoListeners.add(fn);
    return () => undoListeners.delete(fn);
  },
  getSnapshot(): UndoEntry | null {
    return undoStack[undoStack.length - 1] ?? null;
  },
  push(label: string, writer: Writer, after?: () => void): UndoEntry | null {
    const steps = writer.undoSteps();
    if (steps.length === 0) return null;
    const entry: UndoEntry = { id: ++undoSeq, label, steps, after, at: Date.now() };
    undoStack = [...undoStack.slice(-19), entry];
    emitUndo();
    return entry;
  },
  async undoLast(): Promise<UndoEntry | null> {
    const entry = undoStack[undoStack.length - 1];
    if (!entry) return null;
    undoStack = undoStack.slice(0, -1);
    emitUndo();
    await revert(entry.steps);
    entry.after?.();
    return entry;
  },
  clear() {
    undoStack = [];
    emitUndo();
  },
};

/** Runs an action and records it for undo. */
export async function action<R>(label: string, fn: (w: Writer) => Promise<R>, after?: () => void): Promise<R> {
  const { result, writer } = await write(fn);
  undoStore.push(label, writer, after);
  return result;
}
