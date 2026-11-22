import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { todayISO } from './program';

/** Ticks every `ms` while mounted (for clocks and countdowns). */
export function useNow(ms = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), ms);
    const onVisible = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [ms, enabled]);
  return now;
}

/** Today's local date, refreshed when the app comes back to the foreground or the minute changes. */
export function useToday(): string {
  const now = useNow(60_000);
  return todayISO(new Date(now));
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    (fn) => {
      window.addEventListener('online', fn);
      window.addEventListener('offline', fn);
      return () => {
        window.removeEventListener('online', fn);
        window.removeEventListener('offline', fn);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

type WakeLockSentinelLike = { release(): Promise<void>; released?: boolean; addEventListener?: (t: string, f: () => void) => void };

/** Keeps the screen on while `active` (Screen Wake Lock API where available). */
export function useWakeLock(active: boolean): void {
  const sentinel = useRef<WakeLockSentinelLike | null>(null);
  useEffect(() => {
    if (!active) return;
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> } };
    if (!nav.wakeLock) return;
    let cancelled = false;
    const acquire = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      if (sentinel.current && !sentinel.current.released) return;
      try {
        sentinel.current = await nav.wakeLock!.request('screen');
      } catch {
        /* denied (low battery, not visible...) */
      }
    };
    void acquire();
    const onVisible = () => void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel.current?.release().catch(() => undefined);
      sentinel.current = null;
    };
  }, [active]);
}

/**
 * How many px of the layout viewport the on-screen keyboard covers (iOS).
 * Used to lift the rest timer above the keyboard.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setInset(covered > 80 ? Math.round(covered) : 0);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return inset;
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (fn) => {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      mq.addEventListener('change', fn);
      return () => mq.removeEventListener('change', fn);
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  );
}

/** True while the element is at least partly on screen. */
export function useInView<T extends Element>(ref: React.RefObject<T | null>, rootMargin = '0px'): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver((entries) => setInView(entries.some((e) => e.isIntersecting)), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);
  return inView;
}
