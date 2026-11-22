/** Writes for the Sessione screen. Every function is one undoable action. */
import { db } from './db';
import { newId } from './ids';
import { action, nowISO, write } from './repo';
import type { Session, SetLog } from './types';

export interface RowTarget {
  sessionId: string;
  slotId: string | null;
  exerciseKey: string;
  setIndex: number;
  /** Existing log, or null for a planned row. */
  logId: string | null;
  isWarmup?: boolean;
}

export interface RowValues {
  weightKg: number | null;
  reps: number | null;
}

function newLog(t: RowTarget, v: RowValues, doneAt: string | null): SetLog {
  return {
    id: newId(),
    sessionId: t.sessionId,
    slotId: t.slotId,
    exerciseKey: t.exerciseKey,
    setIndex: t.setIndex,
    weightKg: v.weightKg,
    reps: v.reps,
    isWarmup: !!t.isWarmup,
    isSummary: false,
    rawText: null,
    note: null,
    doneAt,
    updatedAt: nowISO(),
    deletedAt: null,
  };
}

/** Starts a session for a day, or returns the one already in progress for it. */
export async function startSession(dayKey: string, week: number, blockStart: string, date: string): Promise<string> {
  const open = (await db.sessions.where('dayKey').equals(dayKey).toArray()).find((s) => !s.deletedAt && s.startedAt && !s.finishedAt);
  if (open) return open.id;
  const now = nowISO();
  const session: Session = {
    id: newId(),
    dayKey,
    week,
    blockStart,
    date,
    startedAt: now,
    finishedAt: null,
    note: '',
    skipped: [],
    substitutions: {},
    updatedAt: now,
    deletedAt: null,
  };
  await write((w) => w.put('sessions', session));
  return session.id;
}

/** Autosave of an edited row (not checked). */
export async function saveRow(t: RowTarget, v: RowValues): Promise<string> {
  return action('Modifica serie', async (w) => {
    if (t.logId) {
      await w.patch<SetLog>('setLogs', t.logId, { weightKg: v.weightKg, reps: v.reps });
      return t.logId;
    }
    const log = await w.put('setLogs', newLog(t, v, null));
    return log.id;
  });
}

/** Check or uncheck a set. Checking saves the values at once. */
export async function setDone(t: RowTarget, v: RowValues, done: boolean, after?: () => void): Promise<string> {
  return action(
    done ? 'Serie completata' : 'Serie riaperta',
    async (w) => {
      if (t.logId) {
        await w.patch<SetLog>('setLogs', t.logId, { weightKg: v.weightKg, reps: v.reps, doneAt: done ? nowISO() : null });
        return t.logId;
      }
      const log = await w.put('setLogs', newLog(t, v, done ? nowISO() : null));
      return log.id;
    },
    after,
  );
}

/** Applies values to several unchecked rows (prefill from last time / progression hint). */
export async function fillRows(rows: { target: RowTarget; values: RowValues }[], label: string): Promise<void> {
  if (!rows.length) return;
  await action(label, async (w) => {
    for (const { target, values } of rows) {
      if (target.logId) await w.patch<SetLog>('setLogs', target.logId, { weightKg: values.weightKg, reps: values.reps });
      else await w.put('setLogs', newLog(target, values, null));
    }
  });
}

export async function addRow(t: RowTarget, v: RowValues, label = 'Serie aggiunta'): Promise<void> {
  await action(label, (w) => w.put('setLogs', newLog(t, v, null)));
}

export async function deleteRow(logId: string): Promise<void> {
  await action('Serie eliminata', (w) => w.remove('setLogs', logId));
}

export async function setWarmup(t: RowTarget, v: RowValues, isWarmup: boolean): Promise<void> {
  await action(isWarmup ? 'Segnata come riscaldamento' : 'Segnata come serie di lavoro', async (w) => {
    if (t.logId) await w.patch<SetLog>('setLogs', t.logId, { isWarmup });
    else await w.put('setLogs', newLog({ ...t, isWarmup }, v, null));
  });
}

export async function setSkipped(sessionId: string, slotId: string, skipped: boolean): Promise<void> {
  await action(skipped ? 'Esercizio saltato' : 'Esercizio ripristinato', async (w) => {
    const s = await db.sessions.get(sessionId);
    if (!s) return;
    const set = new Set(s.skipped);
    if (skipped) set.add(slotId);
    else set.delete(slotId);
    await w.patch<Session>('sessions', sessionId, { skipped: [...set] });
  });
}

/** "Sostituisci per oggi": logs go to the other exercise, the slot stays as it is. */
export async function setSubstitution(sessionId: string, slotId: string, exerciseKey: string | null): Promise<void> {
  await action(exerciseKey ? 'Esercizio sostituito per oggi' : 'Sostituzione annullata', async (w) => {
    const s = await db.sessions.get(sessionId);
    if (!s) return;
    const subs = { ...s.substitutions };
    if (exerciseKey) subs[slotId] = exerciseKey;
    else delete subs[slotId];
    await w.patch<Session>('sessions', sessionId, { substitutions: subs });
    // Unchecked rows of this slot follow the exercise shown on the card.
    const logs = await db.setLogs.where('sessionId').equals(sessionId).toArray();
    const slot = await db.slots.get(slotId);
    const key = exerciseKey ?? slot?.exerciseKey;
    if (!key) return;
    for (const l of logs) {
      if (l.slotId !== slotId || l.deletedAt) continue;
      if (l.doneAt === null) await w.patch<SetLog>('setLogs', l.id, { exerciseKey: key });
    }
  });
}

export async function updateSessionNote(sessionId: string, note: string): Promise<void> {
  await write((w) => w.patch<Session>('sessions', sessionId, { note }));
}

/** Finish: drafts that were never checked are dropped. */
export async function finishSession(sessionId: string, note: string): Promise<void> {
  await action('Allenamento terminato', async (w) => {
    const s = await db.sessions.get(sessionId);
    if (!s) return;
    await w.patch<Session>('sessions', sessionId, { finishedAt: s.finishedAt ?? nowISO(), note });
    const logs = await db.setLogs.where('sessionId').equals(sessionId).toArray();
    for (const l of logs) if (!l.deletedAt && l.doneAt === null) await w.remove('setLogs', l.id);
  });
}

/** Deletes a session and its logs (soft). */
export async function discardSession(sessionId: string): Promise<void> {
  await action('Allenamento eliminato', async (w) => {
    await w.remove('sessions', sessionId);
    const logs = await db.setLogs.where('sessionId').equals(sessionId).toArray();
    for (const l of logs) await w.remove('setLogs', l.id);
  });
}

/**
 * A finished session for a day and week, created on demand (editing an empty
 * cell of the Storico grid).
 */
export async function ensureSessionFor(dayKey: string, week: number, blockStart: string, date: string): Promise<string> {
  const existing = (await db.sessions.where('dayKey').equals(dayKey).toArray()).filter(
    (s) => !s.deletedAt && s.blockStart === blockStart && s.week === week,
  );
  if (existing.length) return existing.sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))[0].id;
  const now = nowISO();
  const time = `${date}T12:00:00.000Z`;
  const session: Session = {
    id: newId(),
    dayKey,
    week,
    blockStart,
    date,
    startedAt: time,
    finishedAt: time,
    note: '',
    skipped: [],
    substitutions: {},
    updatedAt: now,
    deletedAt: null,
  };
  await write((w) => w.put('sessions', session));
  return session.id;
}
