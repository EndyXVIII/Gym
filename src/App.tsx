import { lazy, Suspense, useEffect, useState } from 'react';
import { Route, Switch, useLocation } from 'wouter';
import { ensureSeeded, requestPersistentStorage } from './lib/bootstrap';
import { installAudioUnlock } from './lib/feedback';
import { SettingsProvider } from './app/SettingsContext';
import { TabBar } from './components/TabBar';
import { ToastHost } from './components/Toast';
import { ScreenSkeleton } from './components/ui';
import { UpdatePrompt } from './app/UpdatePrompt';
import { TodayScreen } from './screens/today/TodayScreen';

const SessionScreen = lazy(() => import('./screens/session/SessionScreen'));
const ProgramScreen = lazy(() => import('./screens/program/ProgramScreen'));
const HistoryScreen = lazy(() => import('./screens/history/HistoryScreen'));
const ExerciseHistoryScreen = lazy(() => import('./screens/history/ExerciseHistoryScreen'));
const SettingsScreen = lazy(() => import('./screens/settings/SettingsScreen'));

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
      <Shell />
    </SettingsProvider>
  );
}

function Shell() {
  const [path] = useLocation();
  const inSession = path.startsWith('/sessione/');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);

  return (
    <>
      <main className={inSession ? '' : 'pb-[calc(88px+env(safe-area-inset-bottom))]'}>
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
            <Route>
              <div className="px-6 pt-24 text-center text-muted">Pagina non trovata.</div>
            </Route>
          </Switch>
        </Suspense>
      </main>
      {!inSession && <TabBar />}
      <ToastHost bottom={inSession ? 168 : 80} />
      <UpdatePrompt />
    </>
  );
}
