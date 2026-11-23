import { db } from './db';
import { loadDays, loadExerciseMap, loadSettings } from './queries';
import { creditsFor, sumCredits, type MuscleCredits } from './muscleStats';
import { addDays, BLOCK_WEEKS, dateInBlock, isWorkingDone, sessionSortKey } from './program';
import type { Day, ISODate, Session, SetLog } from './types';

const alive = <T extends { deletedAt: string | null }>(rows: T[]) => rows.filter((r) => !r.deletedAt);

export interface WeekSessionMuscles {
  session: Session;
  day: Day | undefined;
  credits: MuscleCredits;
  /** Working sets done in the session. */
  sets: number;
}

export interface WeekMuscles {
  blockStart: ISODate;
  /** All blocks that have sessions, newest first (always includes the current one). */
  blocks: ISODate[];
  week: number;
  from: ISODate;
  to: ISODate;
  sessions: WeekSessionMuscles[];
  credits: MuscleCredits;
  sets: number;
  /** The week before, in the same block (null in week 1). */
  prev: MuscleCredits | null;
  /** Weeks 1-7 of this block that have working sets. */
  weeksWithData: number[];
}

/** The muscles hit in one week of a block, in total and per session. */
export async function loadWeekMuscles(blockStartArg: ISODate | null, week: number): Promise<WeekMuscles> {
  const settings = await loadSettings();
  const [days, sessionsAll, logsAll, exercises] = await Promise.all([loadDays(), db.sessions.toArray(), db.setLogs.toArray(), loadExerciseMap()]);
  const sessions = alive(sessionsAll);
  const blocks = [...new Set([settings.blockStartDate, ...sessions.map((s) => s.blockStart)])].sort().reverse();
  const blockStart = blockStartArg && blocks.includes(blockStartArg) ? blockStartArg : settings.blockStartDate;
  const dayByKey = new Map((await db.days.toArray()).map((d) => [d.key, d]));
  for (const d of days) dayByKey.set(d.key, d);

  const logsBySession = new Map<string, SetLog[]>();
  for (const l of alive(logsAll)) {
    if (!isWorkingDone(l)) continue;
    logsBySession.set(l.sessionId, [...(logsBySession.get(l.sessionId) ?? []), l]);
  }

  const perSession = (s: Session): WeekSessionMuscles => {
    const logs = logsBySession.get(s.id) ?? [];
    return { session: s, day: dayByKey.get(s.dayKey), credits: creditsFor(logs, exercises), sets: logs.length };
  };
  const inBlock = sessions.filter((s) => s.blockStart === blockStart);
  const byWeek = (w: number) => inBlock.filter((s) => s.week === w).map(perSession).filter((x) => x.sets > 0);

  const current = byWeek(week).sort((a, b) => sessionSortKey(a.session).localeCompare(sessionSortKey(b.session)));
  const previous = week > 1 ? byWeek(week - 1) : [];
  const weeksWithData = Array.from({ length: BLOCK_WEEKS }, (_, i) => i + 1).filter((w) => byWeek(w).length > 0);
  const from = dateInBlock(blockStart, week, 1);

  return {
    blockStart,
    blocks,
    week,
    from,
    to: addDays(from, 6),
    sessions: current,
    credits: sumCredits(current.map((x) => x.credits)),
    sets: current.reduce((n, x) => n + x.sets, 0),
    prev: week > 1 ? sumCredits(previous.map((x) => x.credits)) : null,
    weeksWithData,
  };
}
