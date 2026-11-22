/** Observable sync status for the status dot. The sync engine updates it. */
export interface SyncState {
  kind: 'local' | 'signedOut' | 'offline' | 'pending' | 'syncing' | 'synced' | 'error';
  pending: number;
  lastSyncedAt: string | null;
  message: string | null;
}

let state: SyncState = { kind: 'local', pending: 0, lastSyncedAt: null, message: null };
const listeners = new Set<() => void>();

export const syncStatus = {
  get: () => state,
  set(next: Partial<SyncState>) {
    state = { ...state, ...next };
    listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
