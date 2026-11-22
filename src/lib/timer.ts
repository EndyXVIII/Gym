/**
 * Rest timer. It stores an end timestamp, not a ticking counter, so it stays
 * right when the phone locks or the app goes to the background. Persisted in
 * localStorage so a reload doesn't lose it.
 */
export interface RestTimer {
  /** Epoch ms when the rest ends. */
  endsAt: number;
  /** Planned duration in seconds (for the progress ring). */
  duration: number;
  sessionId: string;
  label: string;
  /** Set once the end alert (flash + beep) has fired. */
  alerted: boolean;
}

const KEY = 'scheda:rest-timer';
type Listener = () => void;
const listeners = new Set<Listener>();
let state: RestTimer | null = load();

function load(): RestTimer | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as RestTimer;
    // Forget timers that ended long ago.
    if (!t || typeof t.endsAt !== 'number' || Date.now() - t.endsAt > 10 * 60_000) return null;
    return t;
  } catch {
    return null;
  }
}

function save() {
  try {
    if (state) localStorage.setItem(KEY, JSON.stringify(state));
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}

function set(next: RestTimer | null) {
  state = next;
  save();
  for (const fn of listeners) fn();
}

export const restTimer = {
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  get(): RestTimer | null {
    return state;
  },
  start(seconds: number, sessionId: string, label: string, now = Date.now()) {
    if (seconds <= 0) return;
    set({ endsAt: now + seconds * 1000, duration: seconds, sessionId, label, alerted: false });
  },
  /** -15 s / +15 s. Never below "now". */
  adjust(deltaSeconds: number, now = Date.now()) {
    if (!state) return;
    const endsAt = Math.max(now, state.endsAt + deltaSeconds * 1000);
    const remaining = Math.ceil((endsAt - now) / 1000);
    set({ ...state, endsAt, duration: Math.max(state.duration + deltaSeconds, remaining, 1), alerted: endsAt <= now ? state.alerted : false });
  },
  markAlerted() {
    if (state && !state.alerted) set({ ...state, alerted: true });
  },
  stop() {
    set(null);
  },
  remainingMs(now = Date.now()): number {
    return state ? Math.max(0, state.endsAt - now) : 0;
  },
};
