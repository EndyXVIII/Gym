import { beforeEach, describe, expect, it } from 'vitest';
import { db, SchedaDB, useDatabase } from './db';
import { ensureSeeded } from './bootstrap';
import { NetworkError, pendingCount, syncOnce, type PushRow, type RemoteAdapter, type RemoteRow } from './sync';
import { deleteSlot, updateSlot } from './programOps';
import { slotSeedId } from './seed';
import { startSession, setDone } from './sessionOps';
import type { Exercise, Media } from './types';

/** In-memory stand-in for Supabase with the same rules as supabase/schema.sql. */
class FakeServer {
  tables = new Map<string, Map<string, RemoteRow>>();
  files = new Map<string, Blob>();
  clock = Date.parse('2026-11-23T10:00:00.000Z');
  online = true;

  private table(name: string) {
    let t = this.tables.get(name);
    if (!t) this.tables.set(name, (t = new Map()));
    return t;
  }

  adapter(uid: string | null): RemoteAdapter {
    const check = () => {
      if (!this.online) throw new NetworkError('Failed to fetch');
    };
    return {
      userId: async () => uid,
      push: async (table: string, rows: PushRow[]) => {
        check();
        const t = this.table(table);
        for (const r of rows) {
          const old = t.get(r.id);
          if (old && Date.parse(r.updated_at) < Date.parse(old.updated_at)) continue; // last write wins
          this.clock += 1;
          t.set(r.id, { ...structuredClone(r), server_updated_at: new Date(this.clock).toISOString() });
        }
      },
      pull: async (table: string, since: string | null, limit: number) => {
        check();
        return [...this.table(table).values()]
          .filter((r) => !since || Date.parse(r.server_updated_at) > Date.parse(since))
          .sort((a, b) => a.server_updated_at.localeCompare(b.server_updated_at))
          .slice(0, limit)
          .map((r) => structuredClone(r));
      },
      upload: async (path: string, blob: Blob) => {
        check();
        this.files.set(path, blob);
      },
      download: async (path: string) => {
        check();
        const f = this.files.get(path);
        if (!f) throw new Error('not found');
        return f;
      },
      remove: async (path: string) => {
        check();
        this.files.delete(path);
      },
    };
  }
}

let n = 0;
let server: FakeServer;
let phone: SchedaDB;
let mac: SchedaDB;
const UID = '11111111-1111-4111-8111-111111111111';

async function on(device: SchedaDB) {
  useDatabase(device);
}

beforeEach(async () => {
  n += 1;
  server = new FakeServer();
  phone = new SchedaDB(`phone-${n}`);
  mac = new SchedaDB(`mac-${n}`);
  for (const d of [phone, mac]) {
    useDatabase(d);
    await ensureSeeded();
  }
});

describe('sync', () => {
  it('first sync pushes everything once; a second device does not duplicate the seed', async () => {
    await on(phone);
    const r1 = await syncOnce(server.adapter(UID));
    expect(r1.pushed).toBe(1 + 28 + 4 + 33 + 4 + 25);
    expect(await pendingCount()).toBe(0);
    await on(mac);
    await syncOnce(server.adapter(UID));
    expect(server.tables.get('slots')!.size).toBe(33);
    expect(server.tables.get('set_logs')!.size).toBe(25);
    expect(await db.slots.count()).toBe(33);
  });

  it('an edit on the phone reaches the Mac', async () => {
    await on(phone);
    await updateSlot(slotSeedId('upper-a', '1'), { sets: [4, 4] });
    await syncOnce(server.adapter(UID));
    await on(mac);
    await syncOnce(server.adapter(UID));
    expect((await db.slots.get(slotSeedId('upper-a', '1')))!.sets).toEqual([4, 4]);
    expect((await db.slots.get(slotSeedId('upper-a', '1')))!._dirty).toBe(0);
  });

  it('offline: a logged set stays on the device and syncs when the connection is back', async () => {
    await on(phone);
    await syncOnce(server.adapter(UID));
    const sid = await startSession('upper-a', 2, '2026-11-16', '2026-11-23');
    await setDone({ sessionId: sid, slotId: slotSeedId('upper-a', '1'), exerciseKey: 'bench-press', setIndex: 0, logId: null }, { weightKg: 22.5, reps: 8 }, true);
    server.online = false;
    await expect(syncOnce(server.adapter(UID))).rejects.toBeInstanceOf(NetworkError);
    expect(await pendingCount()).toBe(2); // the session and the set
    // "reload": a new connection to the same IndexedDB still has it
    const reopened = new SchedaDB(phone.name);
    useDatabase(reopened);
    expect((await db.setLogs.where('sessionId').equals(sid).toArray())[0].weightKg).toBe(22.5);
    server.online = true;
    await syncOnce(server.adapter(UID));
    expect(await pendingCount()).toBe(0);
    const remote = [...server.tables.get('set_logs')!.values()].find((r) => r.data.sessionId === sid);
    expect(remote?.data.weightKg).toBe(22.5);
  });

  it('conflict: the last write wins on both devices', async () => {
    const id = slotSeedId('lower-a', '2');
    await on(phone);
    await syncOnce(server.adapter(UID));
    await on(mac);
    await syncOnce(server.adapter(UID));
    await on(phone);
    await updateSlot(id, { note: 'phone' });
    await new Promise((r) => setTimeout(r, 5));
    await on(mac);
    await updateSlot(id, { note: 'mac (later)' });
    // The later edit syncs first, the older one afterwards: still the later one wins.
    await syncOnce(server.adapter(UID));
    await on(phone);
    await syncOnce(server.adapter(UID));
    expect((await db.slots.get(id))!.note).toBe('mac (later)');
    await on(mac);
    await syncOnce(server.adapter(UID));
    expect((await db.slots.get(id))!.note).toBe('mac (later)');
    expect(server.tables.get('slots')!.get(id)!.data.note).toBe('mac (later)');
  });

  it('deletes are soft and propagate', async () => {
    const id = slotSeedId('lower-b', '7');
    await on(phone);
    await deleteSlot(id);
    await syncOnce(server.adapter(UID));
    await on(mac);
    await syncOnce(server.adapter(UID));
    expect((await db.slots.get(id))!.deletedAt).not.toBeNull();
  });

  it('a re-imported seed never overwrites newer data from the server', async () => {
    const id = slotSeedId('upper-b', '6');
    await on(phone);
    await updateSlot(id, { sets: [3, 3] });
    await syncOnce(server.adapter(UID));
    // A brand-new device: seed first, then sync.
    const tablet = new SchedaDB(`tablet-${n}`);
    useDatabase(tablet);
    await ensureSeeded();
    await syncOnce(server.adapter(UID));
    expect((await db.slots.get(id))!.sets).toEqual([3, 3]);
    expect(server.tables.get('slots')!.get(id)!.data.sets).toEqual([3, 3]);
  });

  it('uploads my photo and downloads it on the other device', async () => {
    await on(phone);
    const ex = (await db.exercises.where('key').equals('hack-squat').first()) as Exercise;
    const media: Media = { id: 'aaaaaaaa-0000-4000-8000-000000000001', exerciseKey: ex.key, kind: 'photo', mime: 'image/jpeg', size: 3, width: 10, height: 10, storagePath: null, updatedAt: new Date().toISOString(), deletedAt: null, _dirty: 1 };
    await db.media.put(media);
    await db.blobs.put({ id: media.id, blob: new Blob(['abc'], { type: 'image/jpeg' }), uploaded: 0 });
    await db.exercises.put({ ...ex, photoId: media.id, updatedAt: new Date().toISOString(), _dirty: 1 });
    const r = await syncOnce(server.adapter(UID));
    expect(r.uploaded).toBe(1);
    expect(server.files.has(`${UID}/${media.id}`)).toBe(true);
    await on(mac);
    const r2 = await syncOnce(server.adapter(UID));
    expect(r2.downloaded).toBe(1);
    const blob = (await db.blobs.get(media.id))!.blob;
    expect(await blob.text()).toBe('abc');
  });

  it('refuses to run signed out', async () => {
    await on(phone);
    await expect(syncOnce(server.adapter(null))).rejects.toThrow();
  });
});
