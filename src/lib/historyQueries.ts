import { db } from './db';
import { loadDays, loadExerciseMap, loadSettings, loadSlots } from './queries';
import { BLOCK_WEEKS, isWorkingDone, personalRecords, sessionSortKey, topSet, volumeKg } from './program';
import type { Day, Exercise, Session, SetLog } from './types';

const alive = <T extends { deletedAt: string | null }>(rows: T[]) => rows.filter((r) => !r.deletedAt);

export interface GridCell {
  session: Session | null;
  top: SetLog | null;
  /** Working sets done for this exercise in that session. */
  count: number;
  skipped: boolean;
  pr: boolean;
}

export interface GridRow {
  exerciseKey: string;
  slotId: string | null;
  label: string;
  name: string;
  /** Logged on this day but not in its program (old layout, substitutions). */
  extra: boolean;
  cells: GridCell[];
}

export interface GridDay {
  day: Day;
  rows: GridRow[];
  sessionsByWeek: (Session | null)[];
}

export interface HistoryGrid {
  blockStart: string;
  blocks: string[];
  days: GridDay[];
}

/** The Excel-like grid: one table per day, rows = exercises, columns = weeks 1-7, cells = top set. */
export async function loadHistoryGrid(blockStartArg: string | null): Promise<HistoryGrid> {
  const settings = await loadSettings();
  const [days, slots, sessionsAll, logsAll, exercises] = await Promise.all([
    loadDays(),
    loadSlots(),
    db.sessions.toArray(),
    db.setLogs.toArray(),
    loadExerciseMap(),
  ]);
  const sessions = alive(sessionsAll);
  const logs = alive(logsAll);
  const blocks = [...new Set([settings.blockStartDate, ...sessions.map((s) => s.blockStart)])].sort().reverse();
  const blockStart = blockStartArg && blocks.includes(blockStartArg) ? blockStartArg : settings.blockStartDate;

  const sessionMap = new Map(sessions.map((s) => [s.id, s]));
  const prs = personalRecords(logs, sessionMap);
  const logsBySession = new Map<string, SetLog[]>();
  for (const l of logs) {
    if (!isWorkingDone(l)) continue;
    const arr = logsBySession.get(l.sessionId) ?? [];
    arr.push(l);
    logsBySession.set(l.sessionId, arr);
  }

  const out: GridDay[] = days.map((day) => {
    const daySlots = slots.filter((s) => s.dayKey === day.key);
    const daySessions = sessions.filter((s) => s.dayKey === day.key && s.blockStart === blockStart);
    const sessionsByWeek: (Session | null)[] = Array.from({ length: BLOCK_WEEKS }, (_, i) => {
      const inWeek = daySessions.filter((s) => s.week === i + 1).sort((a, b) => sessionSortKey(b).localeCompare(sessionSortKey(a)));
      return inWeek[0] ?? null;
    });
    const rows: GridRow[] = daySlots.map((s) => ({ exerciseKey: s.exerciseKey, slotId: s.id, label: s.label, name: s.name, extra: false, cells: [] }));
    const known = new Set(daySlots.map((s) => s.exerciseKey));
    for (const s of sessionsByWeek) {
      for (const l of s ? (logsBySession.get(s.id) ?? []) : []) {
        if (known.has(l.exerciseKey)) continue;
        known.add(l.exerciseKey);
        rows.push({ exerciseKey: l.exerciseKey, slotId: null, label: '', name: exercises.get(l.exerciseKey)?.name ?? l.exerciseKey, extra: true, cells: [] });
      }
    }
    for (const row of rows) {
      row.cells = sessionsByWeek.map((s) => {
        if (!s) return { session: null, top: null, count: 0, skipped: false, pr: false };
        const own = (logsBySession.get(s.id) ?? []).filter((l) => l.exerciseKey === row.exerciseKey);
        const top = topSet(own);
        return {
          session: s,
          top,
          count: own.length,
          skipped: !!row.slotId && own.length === 0 && s.skipped.includes(row.slotId),
          pr: own.some((l) => prs.has(l.id)),
        };
      });
    }
    return { day, rows, sessionsByWeek };
  });
  return { blockStart, blocks, days: out };
}

export interface SessionListItem {
  session: Session;
  day: Day | undefined;
  sets: number;
  volume: number;
}

export async function loadSessionList(): Promise<SessionListItem[]> {
  const [days, sessions, logs] = await Promise.all([loadDays(), db.sessions.toArray(), db.setLogs.toArray()]);
  const dayByKey = new Map(days.map((d) => [d.key, d]));
  const bySession = new Map<string, SetLog[]>();
  for (const l of alive(logs)) {
    const arr = bySession.get(l.sessionId) ?? [];
    arr.push(l);
    bySession.set(l.sessionId, arr);
  }
  return alive(sessions)
    .sort((a, b) => sessionSortKey(b).localeCompare(sessionSortKey(a)))
    .map((s) => {
      const own = bySession.get(s.id) ?? [];
      return { session: s, day: dayByKey.get(s.dayKey), sets: own.filter(isWorkingDone).length, volume: volumeKg(own) };
    });
}

export interface CellLogs {
  logs: SetLog[];
  exercise: Exercise | undefined;
}

export async function loadCellLogs(sessionId: string | null, exerciseKey: string): Promise<CellLogs> {
  const exercise = (await loadExerciseMap([exerciseKey])).get(exerciseKey);
  if (!sessionId) return { logs: [], exercise };
  const logs = alive(await db.setLogs.where('sessionId').equals(sessionId).toArray())
    .filter((l) => l.exerciseKey === exerciseKey && l.doneAt !== null)
    .sort((a, b) => a.setIndex - b.setIndex);
  return { logs, exercise };
}
