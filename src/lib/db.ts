import Dexie, { type Table } from 'dexie';
import type { BlobRecord, Day, Exercise, Media, MetaRecord, Session, SetLog, Settings, Slot, SyncedTable } from './types';

/** IndexedDB is the source of truth on the device. Supabase is a background copy. */
export class SchedaDB extends Dexie {
  exercises!: Table<Exercise, string>;
  days!: Table<Day, string>;
  slots!: Table<Slot, string>;
  sessions!: Table<Session, string>;
  setLogs!: Table<SetLog, string>;
  settings!: Table<Settings, string>;
  media!: Table<Media, string>;
  /** Local only: photo and video bytes. */
  blobs!: Table<BlobRecord, string>;
  /** Local only: sync cursors and flags. */
  meta!: Table<MetaRecord, string>;

  constructor(name = 'scheda') {
    super(name);
    this.version(1).stores({
      exercises: 'id, key, _dirty',
      days: 'id, key, _dirty',
      slots: 'id, dayKey, exerciseKey, _dirty',
      sessions: 'id, dayKey, date, _dirty',
      setLogs: 'id, sessionId, exerciseKey, _dirty',
      settings: 'id, _dirty',
      media: 'id, exerciseKey, _dirty',
      blobs: 'id, uploaded',
      meta: 'key',
    });
  }

  table_(name: SyncedTable): Table<Exercise | Day | Slot | Session | SetLog | Settings | Media, string> {
    return this.table(name);
  }
}

export const SYNCED_TABLES: SyncedTable[] = ['settings', 'exercises', 'days', 'slots', 'sessions', 'setLogs', 'media'];

export let db = new SchedaDB();

/** Tests use a fresh database per test. */
export function useDatabase(next: SchedaDB): void {
  db = next;
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const r = await db.meta.get(key);
  return r?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
