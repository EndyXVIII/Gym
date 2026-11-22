import { db } from './db';
import { loadDays, loadSlots } from './queries';
import { isWorkingDone, personalRecords, sessionSortKey, topSet } from './program';
import type { Day, Exercise, Session, SetLog } from './types';

const alive = <T extends { deletedAt: string | null }>(rows: T[]) => rows.filter((r) => !r.deletedAt);

export interface ExerciseSummary {
  exercise: Exercise;
  /** Days of the current program that use it. */
  days: Day[];
  best: SetLog | null;
  /** Top weight per session, oldest first (for the sparkline). */
  trend: number[];
  lastDate: string | null;
  sessions: number;
  /** The latest session had a PR. */
  recentPr: boolean;
}

export async function loadExerciseIndex(): Promise<ExerciseSummary[]> {
  const [exercises, days, slots, sessionsAll, logsAll] = await Promise.all([db.exercises.toArray(), loadDays(), loadSlots(), db.sessions.toArray(), db.setLogs.toArray()]);
  const sessions = new Map(alive(sessionsAll).map((s) => [s.id, s]));
  const logs = alive(logsAll).filter((l) => isWorkingDone(l) && sessions.has(l.sessionId));
  const prs = personalRecords(logs, sessions);
  const byKey = new Map<string, SetLog[]>();
  for (const l of logs) {
    const arr = byKey.get(l.exerciseKey) ?? [];
    arr.push(l);
    byKey.set(l.exerciseKey, arr);
  }
  const dayByKey = new Map(days.map((d) => [d.key, d]));
  return alive(exercises)
    .map((exercise) => {
      const own = byKey.get(exercise.key) ?? [];
      const bySession = new Map<string, SetLog[]>();
      for (const l of own) bySession.set(l.sessionId, [...(bySession.get(l.sessionId) ?? []), l]);
      const ordered = [...bySession.entries()].map(([id, ls]) => ({ s: sessions.get(id)!, ls })).sort((a, b) => sessionSortKey(a.s).localeCompare(sessionSortKey(b.s)));
      const trend = ordered.map(({ ls }) => topSet(ls)?.weightKg ?? 0);
      const latest = ordered.at(-1);
      const usedIn = [...new Set(slots.filter((s) => s.exerciseKey === exercise.key).map((s) => s.dayKey))].map((k) => dayByKey.get(k)).filter((d): d is Day => !!d);
      return {
        exercise,
        days: usedIn,
        best: topSet(own),
        trend,
        lastDate: latest?.s.date ?? null,
        sessions: ordered.length,
        recentPr: !!latest && latest.ls.some((l) => prs.has(l.id)),
      };
    })
    .sort((a, b) => Number(b.days.length > 0) - Number(a.days.length > 0) || (b.lastDate ?? '').localeCompare(a.lastDate ?? '') || a.exercise.name.localeCompare(b.exercise.name, 'it'));
}

export interface HistoryEntry {
  session: Session;
  day: Day | undefined;
  /** All non-deleted done logs of the exercise in that session, warm-ups included (shown dimmed). */
  logs: SetLog[];
}

export interface ExerciseHistory {
  exercise: Exercise | undefined;
  summary: ExerciseSummary | undefined;
  entries: HistoryEntry[];
  prs: Set<string>;
}

export async function loadExerciseHistory(key: string): Promise<ExerciseHistory> {
  const [index, days, sessionsAll, logsAll] = await Promise.all([loadExerciseIndex(), loadDays(), db.sessions.toArray(), db.setLogs.where('exerciseKey').equals(key).toArray()]);
  const summary = index.find((e) => e.exercise.key === key);
  const exercise = summary?.exercise ?? (await db.exercises.where('key').equals(key).toArray()).find((e) => !e.deletedAt);
  const sessions = new Map(alive(sessionsAll).map((s) => [s.id, s]));
  const allDays = new Map((await db.days.toArray()).map((d) => [d.key, d]));
  for (const d of days) allDays.set(d.key, d);
  const logs = alive(logsAll).filter((l) => l.doneAt !== null && sessions.has(l.sessionId));
  const prs = personalRecords(logs, sessions);
  const bySession = new Map<string, SetLog[]>();
  for (const l of logs) bySession.set(l.sessionId, [...(bySession.get(l.sessionId) ?? []), l]);
  const entries = [...bySession.entries()]
    .map(([id, ls]) => ({ session: sessions.get(id)!, day: allDays.get(sessions.get(id)!.dayKey), logs: ls.sort((a, b) => a.setIndex - b.setIndex) }))
    .sort((a, b) => sessionSortKey(b.session).localeCompare(sessionSortKey(a.session)));
  return { exercise, summary, entries, prs };
}
