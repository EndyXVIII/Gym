import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { SkipForward } from 'lucide-react';
import { useSettings } from '../../app/SettingsContext';
import { softBeep, vibrate } from '../../lib/feedback';
import { formatSeconds } from '../../lib/format';
import { useNow } from '../../lib/hooks';
import { restTimer } from '../../lib/timer';
import { cx } from '../../components/ui';

const R = 29;
const C = 2 * Math.PI * R;

/**
 * Sticky rest timer with a progress ring. The countdown is computed from the end
 * timestamp on every tick, so it is right after the phone was locked or the app
 * was in the background.
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

  const progress = active && !ended ? Math.min(1, Math.max(0, remainingMs / (timer.duration * 1000))) : ended ? 0 : 1;

  return (
    <>
      {flash > 0 &&
        createPortal(
          <div key={flash} aria-hidden className="pointer-events-none fixed inset-0 z-[70] bg-[color-mix(in_srgb,var(--success)_38%,transparent)]" style={{ animation: 'flash 900ms ease-out forwards' }} />,
          document.body,
        )}
      {active && (
        <div
          role="timer"
          aria-live="off"
          aria-label={ended ? 'Recupero finito' : `Recupero: ${formatSeconds(remainingMs / 1000)}`}
          className={cx(
            'anim-slide-up flex items-center gap-3 rounded-[26px] border p-2.5 pr-2 shadow-[var(--shadow)] backdrop-blur-xl',
            ended ? 'border-[color-mix(in_srgb,var(--success)_65%,transparent)] bg-[color-mix(in_srgb,var(--success)_16%,var(--surface))]' : 'border-line bg-[var(--glass)]',
          )}
        >
          <div className="relative h-[68px] w-[68px] shrink-0" aria-hidden>
            <svg viewBox="0 0 68 68" className="h-full w-full -rotate-90">
              <circle cx="34" cy="34" r={R} fill="none" stroke="color-mix(in srgb, var(--text) 12%, transparent)" strokeWidth="6" />
              <circle
                cx="34"
                cy="34"
                r={R}
                fill="none"
                stroke={ended ? 'var(--success)' : 'var(--accent)'}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - progress)}
                style={{ transition: 'stroke-dashoffset 250ms linear' }}
              />
            </svg>
            <span className={cx('absolute inset-0 flex items-center justify-center text-[19px] leading-none font-extrabold tnum', ended && 'text-success-ink')}>
              {ended ? 'Vai!' : formatSeconds(Math.ceil(remainingMs / 1000))}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="eyebrow text-muted">{ended ? 'Recupero finito' : 'Recupero'}</p>
            <p className="truncate text-[14px] font-semibold">{timer.label}</p>
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
            className="pressable flex h-12 min-w-12 items-center justify-center gap-1 rounded-2xl bg-raised px-3 text-[15px] font-bold"
          >
            {ended ? 'OK' : <SkipForward size={20} aria-hidden />}
          </button>
        </div>
      )}
    </>
  );
}

function TimerButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="pressable h-12 min-w-12 rounded-2xl bg-raised px-2 text-[15px] font-bold tnum">
      {children}
    </button>
  );
}
