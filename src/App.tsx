import { lazy, Suspense, useEffect, useState } from 'react';
import { Route, Router, Switch, useLocation } from 'wouter';
import { ensureSeeded, requestPersistentStorage } from './lib/bootstrap';
import { installAudioUnlock } from './lib/feedback';
import { SettingsProvider } from './app/SettingsContext';
import { TabBar } from './components/TabBar';
import { ToastHost } from './components/Toast';
import { ScreenSkeleton } from './components/ui';
import { UpdatePrompt } from './app/UpdatePrompt';
import { TodayScreen } from './screens/today/TodayScreen';
import { startSync } from './lib/syncRunner';
import { hasStoredSession, supabaseConfigured } from './lib/supabase';
import { AUTH_SKIP_KEY } from './screens/auth/authKeys';

const SessionScreen = lazy(() => import('./screens/session/SessionScreen'));
const ProgramScreen = lazy(() => import('./screens/program/ProgramScreen'));
const HistoryScreen = lazy(() => import('./screens/history/HistoryScreen'));
const ExerciseHistoryScreen = lazy(() => import('./screens/history/ExerciseHistoryScreen'));
const SettingsScreen = lazy(() => import('./screens/settings/SettingsScreen'));
const SignInScreen = lazy(() => import('./screens/auth/SignInScreen'));

/** "" at the root (Vercel, Netlify), "/Gym" on GitHub Pages. */
const ROUTER_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureSeeded()
      .then(() => setReady(true))
      .catch((e: unknown) => {
        console.warn(e);
        setError('Non riesco ad aprire il database del telefono. Se sei in navigazione privata, aprila in una finestra normale.');
      });
    void requestPersistentStorage();
    return installAudioUnlock();
  }, []);

  useEffect(() => {
    if (ready) return startSync();
  }, [ready]);

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-8 text-center">
        <p className="text-[18px] font-semibold">Qualcosa non va</p>
        <p className="text-muted">{error}</p>
      </div>
    );
  }
  if (!ready) return <ScreenSkeleton />;
  return (
    <SettingsProvider>
      <Router base={ROUTER_BASE}>
        <Shell />
      </Router>
    </SettingsProvider>
  );
}

/** First launch with Supabase configured and no session on this device: sign in first (or skip). */
function needsSignIn(): boolean {
  if (!supabaseConfigured || hasStoredSession()) return false;
  try {
    return localStorage.getItem(AUTH_SKIP_KEY) !== '1';
  } catch {
    return false;
  }
}

function Shell() {
  const [path, navigate] = useLocation();
  const inSession = path.startsWith('/sessione/');
  const fullScreen = inSession || path === '/accedi';

  useEffect(() => {
    if (path !== '/accedi' && needsSignIn()) navigate('/accedi', { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);

  return (
    <>
      <main className={fullScreen ? '' : 'pb-[calc(88px+env(safe-area-inset-bottom))]'}>
        <Suspense fallback={<ScreenSkeleton />}>
          <Switch>
            <Route path="/">
              <TodayScreen />
            </Route>
            <Route path="/sessione/:id">{(p) => <SessionScreen id={p.id} />}</Route>
            <Route path="/programma">
              <ProgramScreen />
            </Route>
            <Route path="/programma/:dayKey">{(p) => <ProgramScreen dayKey={decodeURIComponent(p.dayKey)} />}</Route>
            <Route path="/storico">
              <HistoryScreen />
            </Route>
            <Route path="/storico/esercizio/:key">{(p) => <ExerciseHistoryScreen exerciseKey={decodeURIComponent(p.key)} />}</Route>
            <Route path="/impostazioni">
              <SettingsScreen />
            </Route>
            <Route path="/accedi">
              <SignInScreen />
            </Route>
            <Route>
              <div className="px-6 pt-24 text-center text-muted">Pagina non trovata.</div>
            </Route>
          </Switch>
        </Suspense>
      </main>
      {!fullScreen && <TabBar />}
      <ToastHost bottom={inSession ? 168 : 80} />
      <UpdatePrompt />
    </>
  );
}
