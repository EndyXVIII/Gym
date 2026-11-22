import { useSyncExternalStore } from 'react';
import { syncStatus, type SyncState } from '../lib/syncStatus';
import { cx } from './ui';

const LABELS: Record<SyncState['kind'], string> = {
  local: 'Solo su questo dispositivo',
  signedOut: 'Non sincronizzato: accedi nelle Impostazioni',
  offline: 'Offline: le modifiche restano sul telefono',
  pending: 'Modifiche da sincronizzare',
  syncing: 'Sincronizzazione in corso',
  synced: 'Sincronizzato',
  error: 'Errore di sincronizzazione',
};

const COLORS: Record<SyncState['kind'], string> = {
  local: 'bg-muted',
  signedOut: 'bg-muted',
  offline: 'bg-muted',
  pending: 'bg-warning',
  syncing: 'bg-warning animate-pulse',
  synced: 'bg-success',
  error: 'bg-danger',
};

export function useSyncState(): SyncState {
  return useSyncExternalStore(syncStatus.subscribe, syncStatus.get, syncStatus.get);
}

export function syncLabel(kind: SyncState['kind']): string {
  return LABELS[kind];
}

/** Small status dot. The shape also changes (ring when not synced) so it doesn't rely on color alone. */
export function SyncDot({ withLabel = false, className }: { withLabel?: boolean; className?: string }) {
  const s = useSyncState();
  const label = LABELS[s.kind];
  return (
    <span className={cx('inline-flex items-center gap-2', className)} role="status" aria-label={`Sincronizzazione: ${label}`} title={label}>
      <span
        aria-hidden
        className={cx(
          'inline-block h-2.5 w-2.5 rounded-full',
          COLORS[s.kind],
          (s.kind === 'local' || s.kind === 'offline' || s.kind === 'signedOut') && 'bg-transparent ring-2 ring-[var(--muted)] ring-inset',
        )}
      />
      {withLabel && <span className="text-[13px] text-muted">{label}</span>}
    </span>
  );
}
