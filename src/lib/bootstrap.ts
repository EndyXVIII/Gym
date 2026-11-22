import { db, getMeta, setMeta } from './db';
import { SETTINGS_ID } from './ids';
import { buildSeed, SEED_VERSION } from './seed';

/**
 * First launch on a device: import my program and week 1 numbers.
 * Seed records have deterministic ids and an old updatedAt, so if the server
 * already has newer versions, sync replaces them (last write wins).
 */
export async function ensureSeeded(): Promise<boolean> {
  const done = await getMeta<number>('seedVersion');
  if (done && done >= SEED_VERSION) return false;
  const seed = buildSeed();
  await db.transaction('rw', [db.settings, db.exercises, db.days, db.slots, db.sessions, db.setLogs, db.meta], async () => {
    // Never overwrite records that already exist (e.g. pulled from the server).
    const putMissing = async <T extends { id: string }>(table: typeof db.exercises | typeof db.days | typeof db.slots | typeof db.sessions | typeof db.setLogs, rows: T[]) => {
      const existing = await table.bulkGet(rows.map((r) => r.id));
      const missing = rows.filter((_, i) => !existing[i]);
      if (missing.length) await (table as unknown as { bulkPut(r: T[]): Promise<unknown> }).bulkPut(missing);
    };
    if (!(await db.settings.get(SETTINGS_ID))) await db.settings.put(seed.settings);
    await putMissing(db.exercises, seed.exercises);
    await putMissing(db.days, seed.days);
    await putMissing(db.slots, seed.slots);
    await putMissing(db.sessions, seed.sessions);
    await putMissing(db.setLogs, seed.setLogs);
    await setMeta('seedVersion', SEED_VERSION);
  });
  return true;
}

/** Ask the browser not to evict our data (iOS may otherwise clear it under pressure). */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) {
      await navigator.storage.persist?.();
    }
  } catch {
    /* not supported */
  }
}
