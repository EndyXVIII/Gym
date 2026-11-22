/**
 * Background sync with Supabase. IndexedDB stays the source of truth:
 *  1. upload photo/video bytes not uploaded yet,
 *  2. push records marked dirty (upsert; the server keeps the newer updatedAt),
 *  3. pull rows changed on the server since the last cursor (server time),
 *     applying a remote row only if it is newer than mine (last write wins),
 *  4. download bytes of photos I don't have, remove files of deleted ones.
 */
import { db, getMeta, setMeta, SYNCED_TABLES } from './db';
import { nowISO } from './repo';
import type { Media, SyncFields, SyncedTable } from './types';

export const REMOTE_TABLE: Record<SyncedTable, string> = {
  settings: 'settings',
  exercises: 'exercises',
  days: 'days',
  slots: 'slots',
  sessions: 'sessions',
  setLogs: 'set_logs',
  media: 'media',
};

export interface RemoteRow {
  id: string;
  user_id?: string;
  data: Record<string, unknown>;
  updated_at: string;
  deleted_at: string | null;
  server_updated_at: string;
}

export type PushRow = Omit<RemoteRow, 'server_updated_at'>;

/** What the sync needs from the server. Supabase in the app, an in-memory fake in tests. */
export interface RemoteAdapter {
  userId(): Promise<string | null>;
  push(table: string, rows: PushRow[]): Promise<void>;
  /** Rows with server_updated_at > since (or all), oldest first. */
  pull(table: string, since: string | null, limit: number): Promise<RemoteRow[]>;
  upload(path: string, blob: Blob, contentType: string): Promise<void>;
  download(path: string): Promise<Blob>;
  remove(path: string): Promise<void>;
}

export class NetworkError extends Error {}

const PUSH_CHUNK = 200;
const PULL_LIMIT = 1000;
/** Re-read a little before the cursor: rows committed late with an earlier server time are not missed. */
const CURSOR_OVERLAP_MS = 2 * 60_000;

export interface SyncReport {
  pushed: number;
  pulled: number;
  uploaded: number;
  downloaded: number;
}

function strip(r: SyncFields): Record<string, unknown> {
  const { _dirty: _ignored, ...rest } = r;
  return rest;
}

function isNewer(a: string, b: string): boolean {
  return Date.parse(a) > Date.parse(b);
}

export async function pendingCount(): Promise<number> {
  let n = 0;
  for (const t of SYNCED_TABLES) n += await db.table(t).where('_dirty').equals(1).count();
  n += await db.blobs.where('uploaded').equals(0).count();
  return n;
}

export async function syncOnce(remote: RemoteAdapter): Promise<SyncReport> {
  const uid = await remote.userId();
  if (!uid) throw new Error('not signed in');
  const report: SyncReport = { pushed: 0, pulled: 0, uploaded: 0, downloaded: 0 };

  // Another account on this device: start the cursors again so nothing is skipped.
  if ((await getMeta<string>('syncUser')) !== uid) {
    for (const t of SYNCED_TABLES) await db.meta.delete(`cursor:${t}`);
    await setMeta('syncUser', uid);
  }

  // 1. Bytes first, so the media records go up with their storage path.
  for (const b of await db.blobs.where('uploaded').equals(0).toArray()) {
    const media = await db.media.get(b.id);
    if (!media || media.deletedAt) continue;
    const path = `${uid}/${media.id}`;
    await remote.upload(path, b.blob, media.mime);
    await db.blobs.update(b.id, { uploaded: 1 });
    // A new updatedAt, so other devices take the version that has the path.
    if (media.storagePath !== path) await db.media.put({ ...media, storagePath: path, updatedAt: nowISO(), _dirty: 1 });
    report.uploaded += 1;
  }

  // 2. Push.
  for (const t of SYNCED_TABLES) {
    const table = db.table(t);
    const dirty = (await table.where('_dirty').equals(1).toArray()) as SyncFields[];
    for (let i = 0; i < dirty.length; i += PUSH_CHUNK) {
      const chunk = dirty.slice(i, i + PUSH_CHUNK);
      await remote.push(
        REMOTE_TABLE[t],
        chunk.map((r) => ({ id: r.id, user_id: uid, data: strip(r), updated_at: r.updatedAt, deleted_at: r.deletedAt })),
      );
      // Clear the flag only where nothing changed while the request was in flight.
      for (const r of chunk) {
        const cur = (await table.get(r.id)) as SyncFields | undefined;
        if (cur && cur.updatedAt === r.updatedAt && cur._dirty === 1) await table.update(r.id, { _dirty: 0 });
      }
      report.pushed += chunk.length;
    }
  }

  // 3. Pull.
  for (const t of SYNCED_TABLES) {
    const table = db.table(t);
    const cursor = await getMeta<string>(`cursor:${t}`);
    let since: string | null = cursor ? new Date(Date.parse(cursor) - CURSOR_OVERLAP_MS).toISOString() : null;
    let newest = cursor ?? null;
    for (;;) {
      const rows = await remote.pull(REMOTE_TABLE[t], since, PULL_LIMIT);
      if (rows.length === 0) break;
      const locals = (await table.bulkGet(rows.map((r) => r.id))) as (SyncFields | undefined)[];
      const apply: SyncFields[] = [];
      rows.forEach((row, i) => {
        const data = row.data as unknown as SyncFields;
        if (!data || data.id !== row.id || typeof data.updatedAt !== 'string') return;
        const mine = locals[i];
        if (!mine || isNewer(data.updatedAt, mine.updatedAt)) apply.push({ ...data, _dirty: 0 });
      });
      if (apply.length) await table.bulkPut(apply);
      report.pulled += apply.length;
      const last = rows[rows.length - 1].server_updated_at;
      if (!newest || Date.parse(last) >= Date.parse(newest)) newest = last;
      if (rows.length < PULL_LIMIT) break;
      since = last;
    }
    if (newest) await setMeta(`cursor:${t}`, newest);
  }

  // 4. Photo bytes: download what my exercises show, delete files of removed photos.
  const exercises = (await db.exercises.toArray()).filter((e) => !e.deletedAt && e.photoId);
  for (const e of exercises) {
    const media = await db.media.get(e.photoId!);
    if (!media || media.deletedAt || !media.storagePath) continue;
    if (await db.blobs.get(media.id)) continue;
    try {
      const blob = await remote.download(media.storagePath);
      await db.blobs.put({ id: media.id, blob, uploaded: 1 });
      report.downloaded += 1;
    } catch (err) {
      if (err instanceof NetworkError) throw err;
      /* missing on the server: keep showing the illustration */
    }
  }
  const removed = (await db.media.toArray()).filter((m: Media) => m.deletedAt && m.storagePath);
  for (const m of removed) {
    try {
      await remote.remove(m.storagePath!);
    } catch (err) {
      if (err instanceof NetworkError) throw err;
    }
    await db.blobs.delete(m.id);
    await db.media.update(m.id, { storagePath: null });
  }

  await setMeta('lastSyncedAt', new Date().toISOString());
  return report;
}
