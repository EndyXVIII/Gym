/**
 * When to sync: at start, a moment after every local change, when the
 * connection comes back, when the app returns to the foreground, and every
 * minute while open. Updates the status dot.
 */
import { getMeta } from './db';
import { onLocalChange } from './repo';
import { getSupabase, hasStoredSession, supabaseAdapter, supabaseConfigured } from './supabase';
import { NetworkError, pendingCount, syncOnce } from './sync';
import { syncStatus } from './syncStatus';

let timer: number | undefined;
let running = false;
let again = false;
let failures = 0;
let started = false;

async function refreshIdle(): Promise<void> {
  const pending = await pendingCount();
  const lastSyncedAt = (await getMeta<string>('lastSyncedAt')) ?? null;
  if (!supabaseConfigured) return syncStatus.set({ kind: 'local', pending, lastSyncedAt });
  const signedIn = await isSignedIn();
  if (!signedIn) return syncStatus.set({ kind: 'signedOut', pending, lastSyncedAt });
  if (!navigator.onLine) return syncStatus.set({ kind: 'offline', pending, lastSyncedAt });
  if (syncStatus.get().kind !== 'error') syncStatus.set({ kind: pending ? 'pending' : 'synced', pending, lastSyncedAt });
}

async function isSignedIn(): Promise<boolean> {
  if (!supabaseConfigured || !hasStoredSession()) return false;
  try {
    const sb = await getSupabase();
    const { data } = await sb.auth.getSession();
    return !!data.session;
  } catch {
    return false;
  }
}

export function scheduleSync(delay = 1500): void {
  if (!supabaseConfigured) {
    void refreshIdle();
    return;
  }
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void runSync(), delay);
}

export async function runSync(): Promise<void> {
  if (!supabaseConfigured) return refreshIdle();
  if (running) {
    again = true;
    return;
  }
  if (!(await isSignedIn())) return refreshIdle();
  if (!navigator.onLine) return refreshIdle();
  running = true;
  syncStatus.set({ kind: 'syncing', message: null });
  try {
    await syncOnce(await supabaseAdapter());
    failures = 0;
    syncStatus.set({ kind: 'synced', message: null });
  } catch (e) {
    failures += 1;
    if (e instanceof NetworkError) syncStatus.set({ kind: 'offline', message: null });
    else syncStatus.set({ kind: 'error', message: (e as Error).message });
    // Back off: 5 s, 10 s, 20 s ... up to 5 minutes.
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void runSync(), Math.min(300_000, 5000 * 2 ** (failures - 1)));
  } finally {
    running = false;
    const kind = syncStatus.get().kind;
    const pending = await pendingCount();
    const lastSyncedAt = (await getMeta<string>('lastSyncedAt')) ?? null;
    syncStatus.set({ pending, lastSyncedAt, kind: kind === 'synced' && pending > 0 ? 'pending' : kind });
    if (again) {
      again = false;
      scheduleSync(300);
    }
  }
}

/** Call once at startup. */
export function startSync(): () => void {
  if (started) return () => undefined;
  started = true;
  const offChange = onLocalChange(() => {
    void refreshIdle();
    scheduleSync(1500);
  });
  const onOnline = () => scheduleSync(0);
  const onOffline = () => void refreshIdle();
  const onVisible = () => {
    if (document.visibilityState === 'visible') scheduleSync(0);
  };
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', onVisible);
  const interval = window.setInterval(() => {
    if (document.visibilityState === 'visible') scheduleSync(0);
  }, 60_000);
  if (supabaseConfigured) {
    void getSupabase().then((sb) =>
      sb.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') scheduleSync(0);
        if (event === 'SIGNED_OUT') void refreshIdle();
      }),
    );
  }
  void refreshIdle().then(() => scheduleSync(0));
  return () => {
    started = false;
    offChange();
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    document.removeEventListener('visibilitychange', onVisible);
    window.clearInterval(interval);
  };
}
