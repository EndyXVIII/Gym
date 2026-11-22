import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { loadSettings } from '../lib/queries';
import type { Settings } from '../lib/types';
import { ScreenSkeleton } from '../components/ui';

const Ctx = createContext<Settings | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const settings = useLiveQuery(loadSettings, []);
  useTheme(settings?.theme);
  if (!settings) return <ScreenSkeleton />;
  return <Ctx.Provider value={settings}>{children}</Ctx.Provider>;
}

export function useSettings(): Settings {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSettings outside SettingsProvider');
  return s;
}

function useTheme(theme: Settings['theme'] | undefined) {
  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      localStorage.setItem('scheda:theme', theme);
    } catch {
      /* private mode */
    }
    const apply = () => {
      const bg = getComputedStyle(root).getPropertyValue('--bg').trim() || '#0B0F14';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}
