import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { LogIn, LogOut, RefreshCw } from 'lucide-react';
import { getSupabase, supabaseConfigured } from '../../lib/supabase';
import { runSync } from '../../lib/syncRunner';
import { syncLabel, useSyncState, SyncDot } from '../../components/SyncDot';
import { Button } from '../../components/ui';
import { ConfirmSheet } from '../../components/Sheet';
import { toast } from '../../components/Toast';
import { Section, Row } from './SettingsScreen';

function useAccountEmail(): string | null | undefined {
  const [email, setEmail] = useState<string | null | undefined>(supabaseConfigured ? undefined : null);
  useEffect(() => {
    if (!supabaseConfigured) return;
    let unsub: (() => void) | undefined;
    void getSupabase().then(async (sb) => {
      const { data } = await sb.auth.getSession();
      setEmail(data.session?.user.email ?? null);
      const { data: sub } = sb.auth.onAuthStateChange((_e, session) => setEmail(session?.user.email ?? null));
      unsub = () => sub.subscription.unsubscribe();
    });
    return () => unsub?.();
  }, []);
  return email;
}

function formatWhen(iso: string | null): string {
  if (!iso) return 'mai';
  const d = new Date(iso);
  return d.toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Account and sync status. The email shown comes from the session on this device, never from the code. */
export function AccountSection() {
  const s = useSyncState();
  const email = useAccountEmail();
  const [, navigate] = useLocation();
  const [confirmOut, setConfirmOut] = useState(false);

  return (
    <Section title="Sincronizzazione">
      <Row>
        <div className="flex items-center gap-3">
          <SyncDot />
          <div className="min-w-0">
            <p className="text-[15px]">{syncLabel(s.kind)}</p>
            <p className="text-[13px] text-muted tnum">
              {s.pending > 0 ? `${s.pending} modifiche in attesa · ` : ''}Ultima sincronizzazione: {formatWhen(s.lastSyncedAt)}
            </p>
            {s.kind === 'error' && s.message && <p className="mt-1 text-[13px] text-danger-ink">{s.message}</p>}
          </div>
        </div>
      </Row>
      {!supabaseConfigured ? (
        <Row>
          <p className="text-[14px] text-muted">Supabase non è configurato in questa installazione: i dati restano su questo dispositivo. Usa l’esportazione JSON come backup.</p>
        </Row>
      ) : email ? (
        <>
          <Row>
            <p className="text-[13px] text-muted">Account</p>
            <p className="truncate text-[15px]">{email}</p>
          </Row>
          <Row>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" icon={<RefreshCw size={18} aria-hidden />} onClick={() => void runSync()}>
                Sincronizza ora
              </Button>
              <Button variant="secondary" icon={<LogOut size={18} aria-hidden />} onClick={() => setConfirmOut(true)}>
                Esci
              </Button>
            </div>
          </Row>
        </>
      ) : email === null ? (
        <Row>
          <Button variant="primary" block icon={<LogIn size={18} aria-hidden />} onClick={() => navigate('/accedi')}>
            Accedi con un codice via email
          </Button>
        </Row>
      ) : null}
      <ConfirmSheet
        open={confirmOut}
        onClose={() => setConfirmOut(false)}
        title="Uscire?"
        text="I dati restano su questo telefono, ma smettono di sincronizzarsi finché non accedi di nuovo."
        confirmLabel="Esci"
        onConfirm={async () => {
          const sb = await getSupabase();
          await sb.auth.signOut({ scope: 'local' });
          toast.show('Sei uscito. I dati restano qui.');
          void runSync();
        }}
      />
    </Section>
  );
}
