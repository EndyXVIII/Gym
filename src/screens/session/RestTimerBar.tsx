import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { SkipForward } from 'lucide-react';
import { useSettings } from '../../app/SettingsContext';
import { softBeep, vibrate } from '../../lib/feedback';
import { formatSeconds } from '../../lib/format';
import { useNow } from '../../lib/hooks';
import { restTimer } from '../../lib/timer';
import { cx } from '../../components/ui';

/**
 * Sticky rest timer. The countdown is computed from the end timestamp on every
 * tick, so it is right after the phone was locked or the app was in the background.
 */
export function RestTimerBar({ sessionId }: { sessionId: string }) {
  const settings = useSettings();
  const timer = useSyncExternalStore(restTimer.subscribe, restTimer.get, restTimer.get);
  const active = !!timer && timer.sessionId === sessionId;
  const now = useNow(250, active);
  const [flash, setFlash] = useState(0);

  const remainingMs = active ? Math.max(0, timer.endsAt - now) : 0;
  const ended = active && remainingMs <= 0;

  // End of rest: flash, optional soft beep, vibration where it exists. Once per timer.
  useEffect(() => {
    if (!active || !ended || timer.alerted) return;
    restTimer.markAlerted();
    const late = now - timer.endsAt > 15_000; // came back long after it ended: no sound
    setFlash((f) => f + 1);
    if (settings.sound && !late) softBeep();
    vibrate([180, 90, 180]);
  }, [active, ended, timer, now, settings.sound]);

  // Hide a finished timer after a few seconds.
  useEffect(() => {
    if (!active || !ended) return;
    const id = window.setTimeout(() => restTimer.stop(), 6000);
    return () => window.clearTimeout(id);
  }, [active, ended]);

  return (
    <>
      {flash > 0 && createPortal(<div key={flash} aria-hidden className="pointer-events-none fixed inset-0 z-[70] bg-[color-mix(in_srgb,var(--success)_38%,transparent)]" style={{ animation: 'flash 900ms ease-out forwards' }} />, document.body)}
      {active && (
        <div
          role="timer"
          aria-live="off"
          aria-label={ended ? 'Recupero finito' : `Recupero: ${formatSeconds(remainingMs / 1000)}`}
          className={cx('anim-slide-up overflow-hidden rounded-[20px] border bg-raised', ended ? 'border-[color-mix(in_srgb,var(--success)_60%,transparent)]' : 'border-line')}
        >
          <div className="h-1 bg-[color-mix(in_srgb,var(--border)_70%,transparent)]">
            <div
              className={cx('h-full', ended ? 'bg-success' : 'bg-accent')}
              style={{ width: `${ended ? 100 : Math.min(100, (1 - remainingMs / (timer.duration * 1000)) * 100)}%`, transition: 'width 250ms linear' }}
            />
          </div>
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="min-w-0 flex-1 pl-2">
              <p className="truncate text-[13px] font-medium text-muted">{ended ? 'Recupero finito' : 'Recupero'} · {timer.label}</p>
              <p className={cx('text-[34px] leading-none font-bold tnum', ended ? 'text-success-ink' : 'text-ink')} aria-hidden>
                {ended ? 'Vai!' : formatSeconds(Math.ceil(remainingMs / 1000))}
              </p>
            </div>
            {!ended && (
              <>
                <TimerButton label="Togli 15 secondi" onClick={() => restTimer.adjust(-15)}>
                  −15
                </TimerButton>
                <TimerButton label="Aggiungi 15 secondi" onClick={() => restTimer.adjust(15)}>
                  +15
                </TimerButton>
              </>
            )}
            <button
              type="button"
              onClick={() => restTimer.stop()}
              aria-label={ended ? 'Chiudi il timer' : 'Salta il recupero'}
              className="pressable flex h-12 min-w-12 items-center justify-center gap-1 rounded-2xl bg-surface px-3 text-[15px] font-semibold"
            >
              {ended ? 'OK' : <SkipForward size={20} aria-hidden />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function TimerButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="pressable h-12 min-w-14 rounded-2xl bg-surface px-2 text-[16px] font-semibold tnum">
      {children}
    </button>
  );
}
