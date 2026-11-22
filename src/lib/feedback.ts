/**
 * End-of-rest feedback: a soft beep (Web Audio, unlocked on the first tap) and
 * vibration where it exists (Android; iPhone Safari has no vibration API).
 */
type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

let ctx: AudioContext | null = null;
let unlocked = false;

function getContext(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    // "ambient" mixes with my music instead of stopping it (Safari 16.4+).
    const nav = navigator as AudioSessionNavigator;
    if (nav.audioSession) nav.audioSession.type = 'ambient';
  } catch {
    /* ignore */
  }
  ctx = new AC();
  return ctx;
}

/** iOS only allows audio after a user gesture: call this from the first tap. */
export function unlockAudio(): void {
  if (unlocked) return;
  const c = getContext();
  if (!c) return;
  try {
    const buffer = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.connect(c.destination);
    src.start(0);
    void c.resume();
    unlocked = true;
  } catch {
    /* try again on the next tap */
  }
}

export function installAudioUnlock(): () => void {
  const handler = () => {
    unlockAudio();
    if (unlocked) {
      window.removeEventListener('pointerdown', handler, true);
      window.removeEventListener('keydown', handler, true);
    }
  };
  window.addEventListener('pointerdown', handler, true);
  window.addEventListener('keydown', handler, true);
  return () => {
    window.removeEventListener('pointerdown', handler, true);
    window.removeEventListener('keydown', handler, true);
  };
}

/** Two soft sine notes. */
export function softBeep(): void {
  const c = getContext();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  const t0 = c.currentTime + 0.02;
  const notes: [number, number][] = [
    [880, 0],
    [1318.5, 0.18],
  ];
  for (const [freq, offset] of notes) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0 + offset);
    gain.gain.exponentialRampToValueAtTime(0.22, t0 + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.32);
    osc.connect(gain).connect(c.destination);
    osc.start(t0 + offset);
    osc.stop(t0 + offset + 0.36);
  }
}

export function vibrate(pattern: number | number[]): void {
  try {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  } catch {
    /* not supported */
  }
}
