import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { KeyRound, Mail } from 'lucide-react';
import { getSupabase, supabaseConfigured } from '../../lib/supabase';
import { runSync } from '../../lib/syncRunner';
import { Button, cx, inputClass } from '../../components/ui';
import { toast } from '../../components/Toast';

import { AUTH_SKIP_KEY } from './authKeys';

const EMAIL_KEY = 'scheda:last-email';

function messageFor(error: unknown): string {
  const e = error as { message?: string; status?: number; code?: string };
  const msg = (e?.message ?? '').toLowerCase();
  if (!navigator.onLine || msg.includes('fetch') || msg.includes('network')) return 'Sei offline: per accedere serve la connessione.';
  if (msg.includes('signups not allowed') || msg.includes('signup') || e?.code === 'otp_disabled' || e?.code === 'user_not_found') return 'Questa email non è abilitata. Crea il tuo utente nella dashboard di Supabase.';
  if (e?.status === 429 || msg.includes('security purposes') || msg.includes('rate limit')) return 'Troppe richieste: aspetta un minuto e riprova.';
  if (msg.includes('expired') || msg.includes('invalid') || e?.code === 'otp_expired') return 'Codice non valido o scaduto. Chiedine uno nuovo.';
  return 'Qualcosa non ha funzionato. Riprova tra poco.';
}

/** Sign in with a 6-digit code sent by email (no magic link: on iPhone it would open Safari, not the app). */
export default function SignInScreen() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem(EMAIL_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const skip = () => {
    try {
      localStorage.setItem(AUTH_SKIP_KEY, '1');
    } catch {
      /* ignore */
    }
    navigate('/', { replace: true });
  };

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const address = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(address)) {
      setError('Scrivi un indirizzo email valido.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const sb = await getSupabase();
      const { error: err } = await sb.auth.signInWithOtp({ email: address, options: { shouldCreateUser: false } });
      if (err) throw err;
      try {
        localStorage.setItem(EMAIL_KEY, address);
      } catch {
        /* ignore */
      }
      setStep('code');
      setCooldown(60);
      setCode('');
      window.setTimeout(() => codeInput.current?.focus(), 50);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code, e?: React.FormEvent) => {
    e?.preventDefault();
    if (!/^\d{6,10}$/.test(value)) {
      setError('Il codice ha 6 cifre.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const sb = await getSupabase();
      const { error: err } = await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: value, type: 'email' });
      if (err) throw err;
      try {
        localStorage.removeItem(AUTH_SKIP_KEY);
      } catch {
        /* ignore */
      }
      toast.show('Accesso fatto: sincronizzo i dati.', { tone: 'success' });
      void runSync();
      navigate('/', { replace: true });
    } catch (err) {
      setError(messageFor(err));
      setCode('');
      codeInput.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  if (!supabaseConfigured) {
    return (
      <Shell>
        <p className="text-[15px] text-muted">La sincronizzazione non è configurata: l’app funziona solo su questo dispositivo. Le istruzioni sono nel README del progetto.</p>
        <Button variant="primary" size="lg" block className="mt-6" onClick={() => navigate('/', { replace: true })}>
          Vai a Oggi
        </Button>
      </Shell>
    );
  }

  return (
    <Shell>
      {step === 'email' ? (
        <form onSubmit={sendCode} noValidate>
          <p className="text-[15px] text-muted">Ti mando un codice di 6 cifre per email. Niente password, niente link.</p>
          <label className="mt-6 block">
            <span className="mb-1.5 block px-1 text-[13px] font-medium text-muted">Email</span>
            <div className="relative">
              <Mail size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="send"
                className={cx(inputClass, 'pl-11')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!error}
                aria-describedby={error ? 'auth-error' : undefined}
              />
            </div>
          </label>
          {error && (
            <p id="auth-error" role="alert" className="mt-3 text-[14px] text-danger-ink">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" size="lg" block className="mt-6" disabled={busy}>
            {busy ? 'Invio…' : 'Invia il codice'}
          </Button>
        </form>
      ) : (
        <form onSubmit={(e) => void verify(code, e)} noValidate>
          <p className="text-[15px] text-muted">
            Ho mandato un codice a <span className="font-semibold text-ink">{email.trim()}</span>. Su iPhone puoi toccarlo sopra la tastiera.
          </p>
          <label className="mt-6 block">
            <span className="mb-1.5 block px-1 text-[13px] font-medium text-muted">Codice</span>
            <div className="relative">
              <KeyRound size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                ref={codeInput}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                enterKeyHint="go"
                maxLength={10}
                className={cx(inputClass, 'pl-11 text-[24px] font-semibold tracking-[0.3em] tnum')}
                value={code}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setCode(v);
                  if (v.length === 6) void verify(v);
                }}
                aria-invalid={!!error}
                aria-describedby={error ? 'auth-error' : undefined}
              />
            </div>
          </label>
          {error && (
            <p id="auth-error" role="alert" className="mt-3 text-[14px] text-danger-ink">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" size="lg" block className="mt-6" disabled={busy}>
            {busy ? 'Verifica…' : 'Accedi'}
          </Button>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="ghost" disabled={cooldown > 0 || busy} onClick={() => void sendCode()}>
              {cooldown > 0 ? `Nuovo codice (${cooldown})` : 'Nuovo codice'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setStep('email');
                setError(null);
              }}
            >
              Cambia email
            </Button>
          </div>
        </form>
      )}
      <button type="button" onClick={skip} className="pressable mt-8 min-h-12 w-full rounded-2xl text-[15px] text-muted underline underline-offset-4">
        Continua senza accedere (solo su questo telefono)
      </button>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col px-6 pt-safe pb-[max(env(safe-area-inset-bottom),24px)]">
      <div className="mt-[12vh]">
        <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width={64} height={64} className="rounded-[16px]" />
        <h1 className="mt-5 text-[32px] leading-tight font-bold tracking-tight">Accedi a Scheda</h1>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
