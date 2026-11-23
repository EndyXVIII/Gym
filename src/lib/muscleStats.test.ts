import { beforeEach, describe, expect, it } from 'vitest';
import { db, SchedaDB, useDatabase } from './db';
import { ensureSeeded } from './bootstrap';
import { creditsFor, formatSerie, FULL_AT_WEEK, heatLevel, heatLevels, rankedMuscles, regionValue, sumCredits, untrainedMuscles } from './muscleStats';
import { loadWeekMuscles } from './muscleQueries';
import { startSession, setDone } from './sessionOps';
import { slotSeedId } from './seed';
import type { SetLog } from './types';

const ex = new Map([
  ['bench', { primary: ['chest' as const], secondary: ['triceps' as const, 'front-delts' as const] }],
  ['curl', { primary: ['biceps' as const], secondary: ['forearms' as const] }],
]);
const log = (p: Partial<SetLog> & { id: string; exerciseKey: string }): SetLog => ({
  sessionId: 's', slotId: null, setIndex: 0, weightKg: 50, reps: 8, isWarmup: false, isSummary: false, rawText: null, note: null,
  doneAt: '2026-11-23T18:00:00.000Z', updatedAt: '2026-11-23T18:00:00.000Z', deletedAt: null, ...p,
});

describe('muscle credits', () => {
  it('counts 1 per working set for primary muscles and 0.5 for secondary ones', () => {
    const c = creditsFor([log({ id: '1', exerciseKey: 'bench' }), log({ id: '2', exerciseKey: 'bench' }), log({ id: '3', exerciseKey: 'curl' })], ex);
    expect(c).toEqual({ chest: 2, triceps: 1, 'front-delts': 1, biceps: 1, forearms: 0.5 });
  });

  it('ignores warm-ups, unchecked, deleted logs and unknown exercises', () => {
    const c = creditsFor(
      [
        log({ id: '1', exerciseKey: 'bench', isWarmup: true }),
        log({ id: '2', exerciseKey: 'bench', doneAt: null }),
        log({ id: '3', exerciseKey: 'bench', deletedAt: '2026-11-23T19:00:00.000Z' }),
        log({ id: '4', exerciseKey: 'nope' }),
      ],
      ex,
    );
    expect(c).toEqual({});
  });

  it('a muscle that is both primary and secondary counts once, as primary', () => {
    const c = creditsFor([log({ id: '1', exerciseKey: 'x' })], new Map([['x', { primary: ['lats' as const], secondary: ['lats' as const, 'biceps' as const] }]]));
    expect(c).toEqual({ lats: 1, biceps: 0.5 });
  });

  it('sums credits of several workouts', () => {
    expect(sumCredits([{ chest: 2, biceps: 1 }, { chest: 1.5 }])).toEqual({ chest: 3.5, biceps: 1 });
  });

  it('the generic forearms credit lights both forearm regions', () => {
    const c = { forearms: 1.5, 'forearm-flexors': 3 };
    expect(regionValue(c, 'forearm-flexors')).toBe(4.5);
    expect(regionValue(c, 'forearm-extensors')).toBe(1.5);
    expect(regionValue({}, 'chest')).toBe(0);
  });

  it('heat levels: 0 none, 1-5 as a fraction of the scale', () => {
    expect([0, 0.5, 2.5, 4, 6, 8, 12, 30].map((v) => heatLevel(v, FULL_AT_WEEK))).toEqual([0, 1, 2, 2, 3, 4, 5, 5]);
    expect(heatLevels({ chest: 12, biceps: 1, 'forearm-flexors': 0 }, FULL_AT_WEEK)).toEqual({ chest: 5, biceps: 1 });
  });

  it('ranks trained muscles and lists the untrained ones', () => {
    const c = { biceps: 2, chest: 5, 'rear-delts': 2 };
    expect(rankedMuscles(c).map((r) => r.muscle)).toEqual(['chest', 'rear-delts', 'biceps']);
    const rest = untrainedMuscles(c);
    expect(rest).not.toContain('chest');
    expect(rest).toContain('quads');
    expect(rest).not.toContain('forearms');
  });

  it('formats serie with a decimal comma', () => {
    expect([3, 2.5, 0.5, 2.25].map(formatSerie)).toEqual(['3', '2,5', '0,5', '2,5']);
  });
});

let n = 0;
beforeEach(async () => {
  useDatabase(new SchedaDB(`muscles-${++n}`));
  await ensureSeeded();
});

describe('muscles of a week (from the database)', () => {
  it('week 1 from the seed: one set per typed number, extra log included', async () => {
    const w = await loadWeekMuscles('2026-11-16', 1);
    expect(w.sessions).toHaveLength(4);
    expect(w.sets).toBe(25);
    expect(w.credits.chest).toBe(4); // bench, pec deck, machine press, incline dumbbell (extra log)
    expect(w.credits.quads).toBe(4); // hack squat, leg extension x2, leg press
    expect(w.credits['forearm-flexors']).toBe(1);
    expect(w.credits.triceps).toBe(2.5); // pushdown 1 + 3 presses at 0.5
    expect(w.prev).toBeNull();
    expect(w.weeksWithData).toEqual([1]);
    expect([w.from, w.to]).toEqual(['2026-11-16', '2026-11-22']);
  });

  it('a set checked in week 2 shows up there, with week 1 as comparison', async () => {
    const sid = await startSession('upper-a', 2, '2026-11-16', '2026-11-23');
    await setDone({ sessionId: sid, slotId: slotSeedId('upper-a', '1'), exerciseKey: 'bench-press', setIndex: 0, logId: null }, { weightKg: 22.5, reps: 8 }, true);
    const w = await loadWeekMuscles('2026-11-16', 2);
    expect(w.sessions).toHaveLength(1);
    expect(w.credits).toEqual({ chest: 1, triceps: 0.5, 'front-delts': 0.5 });
    expect(w.prev?.chest).toBe(4);
    expect(w.weeksWithData).toEqual([1, 2]);
    expect(w.sessions[0].day?.title).toBe('Upper A');
  });

  it('a week with no workouts is empty, not an error', async () => {
    const w = await loadWeekMuscles('2026-11-16', 5);
    expect([w.sessions.length, w.sets, w.credits]).toEqual([0, 0, {}]);
    expect((await db.sessions.count())).toBe(4);
  });
});
