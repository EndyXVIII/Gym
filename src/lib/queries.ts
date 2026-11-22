/**
 * Read models for the screens. They run inside useLiveQuery, so the UI updates
 * by itself whenever IndexedDB changes (local edits or sync).
 */
import { db } from './db';
import { SETTINGS_ID } from './ids';
import { lastPerformance, personalRecords, sessionSortKey, type Performance } from './program';
import { defaultSettings } from './seed';
import type { Day, Exercise, Session, SetLog, Settings, Slot } from './types';

const alive = <T extends { deletedAt: string | null }>(rows: T[]) => rows.filter((r) => !r.deletedAt);

export async function loadSettings(): Promise<Settings> {
  return (await db.settings.get(SETTINGS_ID)) ?? defaultSettings();
}

export async function loadDays(): Promise<Day[]> {
  return alive(await db.days.toArray()).sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
}

export async function loadSlots(dayKey?: string): Promise<Slot[]> {
  const rows = dayKey ? await db.slots.where('dayKey').equals(dayKey).toArray() : await db.slots.toArray();
  return alive(rows).sort((a, b) => a.position - b.position);
}

/** Exercises by key. If a key exists twice (shouldn't), the live, newest one wins. */
export async function loadExerciseMap(keys?: string[]): Promise<Map<string, Exercise>> {
  const rows = keys ? await db.exercises.where('key').anyOf(keys).toArray() : await db.exercises.toArray();
  const map = new Map<string, Exercise>();
  for (const e of rows.sort((a, b) => Number(!!b.deletedAt) - Number(!!a.deletedAt) || a.updatedAt.localeCompare(b.updatedAt))) {
    map.set(e.key, e);
  }
  return map;
}

export interface ProgramData {
  days: Day[];
  slotsByDay: Map<string, Slot[]>;
}

export async function loadProgram(): Promise<ProgramData> {
  const [days, slots] = await Promise.all([loadDays(), loadSlots()]);
  const slotsByDay = new Map<string, Slot[]>();
  for (const d of days) slotsByDay.set(d.key, []);
  for (const s of slots) slotsByDay.get(s.dayKey)?.push(s);
  return { days, slotsByDay };
}

export interface TodayData extends ProgramData {
  sessions: Session[];
  inProgress: Session[];
}

export async function loadToday(): Promise<TodayData> {
  const [program, sessions] = await Promise.all([loadProgram(), db.sessions.toArray()]);
  const live = alive(sessions).sort((a, b) => sessionSortKey(b).localeCompare(sessionSortKey(a)));
  return {
    ...program,
    sessions: live,
    inProgress: live.filter((s) => s.startedAt && !s.finishedAt),
  };
}

/* ------------------------------------------------------------------ session screen */

export interface SessionView {
  session: Session;
  day: Day | null;
  slots: Slot[];
  /** Logs of this session (not deleted), by slot id. */
  logsBySlot: Map<string, SetLog[]>;
  /** Logs of this session that belong to no current slot, by exercise key. */
  orphanLogs: Map<string, SetLog[]>;
  exercises: Map<string, Exercise>;
  /** "Ultima volta" per exercise key, from sessions before this one. */
  last: Map<string, Performance | null>;
  /** Log ids in this session that are personal records. */
  prs: Set<string>;
}

export async function loadSessionView(sessionId: string): Promise<SessionView | null> {
  const session = await db.sessions.get(sessionId);
  if (!session || session.deletedAt) return null;
  const [day, slots, ownLogs] = await Promise.all([
    db.days.where('key').equals(session.dayKey).filter((d) => !d.deletedAt).first(),
    loadSlots(session.dayKey),
    db.setLogs.where('sessionId').equals(sessionId).toArray(),
  ]);
  const logs = alive(ownLogs);
  const slotIds = new Set(slots.map((s) => s.id));
  const logsBySlot = new Map<string, SetLog[]>();
  const orphanLogs = new Map<string, SetLog[]>();
  for (const l of logs) {
    if (l.slotId && slotIds.has(l.slotId)) {
      const arr = logsBySlot.get(l.slotId) ?? [];
      arr.push(l);
      logsBySlot.set(l.slotId, arr);
    } else {
      const arr = orphanLogs.get(l.exerciseKey) ?? [];
      arr.push(l);
      orphanLogs.set(l.exerciseKey, arr);
    }
  }

  const keys = new Set<string>();
  for (const s of slots) keys.add(session.substitutions[s.id] ?? s.exerciseKey);
  for (const l of logs) keys.add(l.exerciseKey);
  const keyList = [...keys];
  const [exercises, history] = await Promise.all([loadExerciseMap(keyList), db.setLogs.where('exerciseKey').anyOf(keyList).toArray()]);
  const liveHistory = alive(history);
  const sessionIds = [...new Set(liveHistory.map((l) => l.sessionId))];
  const sessionRows = await db.sessions.bulkGet(sessionIds);
  const sessions = new Map<string, Session>();
  for (const s of sessionRows) if (s && !s.deletedAt) sessions.set(s.id, s);

  const last = new Map<string, Performance | null>();
  for (const k of keyList) last.set(k, lastPerformance(k, liveHistory, sessions, { excludeSessionId: sessionId, before: session }));
  const allPrs = personalRecords(liveHistory, sessions);
  const prs = new Set(logs.filter((l) => allPrs.has(l.id)).map((l) => l.id));

  return { session, day: day ?? null, slots, logsBySlot, orphanLogs, exercises, last, prs };
}

/** "Ultima volta" for a set of exercises, from every session (used on Oggi and in pickers). */
export async function loadLastPerformances(keys: string[]): Promise<Map<string, Performance | null>> {
  const history = alive(await db.setLogs.where('exerciseKey').anyOf(keys).toArray());
  const sessionRows = await db.sessions.bulkGet([...new Set(history.map((l) => l.sessionId))]);
  const sessions = new Map<string, Session>();
  for (const s of sessionRows) if (s && !s.deletedAt) sessions.set(s.id, s);
  const out = new Map<string, Performance | null>();
  for (const k of keys) out.set(k, lastPerformance(k, history, sessions));
  return out;
}

export async function loadLibrary(): Promise<Exercise[]> {
  return alive(await db.exercises.toArray()).sort((a, b) => a.name.localeCompare(b.name, 'it'));
}
