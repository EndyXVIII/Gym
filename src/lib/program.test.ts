import { describe, expect, it } from 'vitest';
import { v5 as uuidv5 } from 'uuid';
import {
  calendarWeek,
  dateInBlock,
  dayPlanSummary,
  displayReps,
  groupSlots,
  isSlotHidden,
  lastPerformance,
  nextMonday,
  performanceLabel,
  personalRecords,
  prefillFor,
  progressionHint,
  relabel,
  setsForWeek,
  targetRir,
  volumeKg,
  weekInfo,
  weekRule,
} from './program';
import { formatKg, formatSet, parseReps, parseWeight, sanitizeWeightTyping } from './format';
import { buildSeed } from './seed';
import { SCHEDA_NAMESPACE, seedId } from './ids';
import type { Session, SetLog } from './types';

const seed = buildSeed();
const sessionsById = new Map(seed.sessions.map((s) => [s.id, s]));

function log(partial: Partial<SetLog> & Pick<SetLog, 'id' | 'sessionId' | 'exerciseKey'>): SetLog {
  return {
    slotId: null,
    setIndex: 0,
    weightKg: 50,
    reps: 8,
    isWarmup: false,
    isSummary: false,
    rawText: null,
    note: null,
    doneAt: '2026-11-23T18:00:00.000Z',
    updatedAt: '2026-11-23T18:00:00.000Z',
    deletedAt: null,
    ...partial,
  };
}

function session(id: string, date: string, dayKey = 'upper-a', startedAt = `${date}T17:00:00.000Z`): Session {
  return {
    id,
    dayKey,
    week: 2,
    blockStart: '2026-11-16',
    date,
    startedAt,
    finishedAt: null,
    note: '',
    skipped: [],
    substitutions: {},
    updatedAt: startedAt,
    deletedAt: null,
  };
}

describe('weeks', () => {
  const settings = { blockStartDate: '2026-11-16', weekOverride: null };

  it('week 1 runs Monday 16 to Sunday 22 November 2026, week 2 starts Monday 23', () => {
    expect(calendarWeek('2026-11-16', '2026-11-16')).toBe(1);
    expect(calendarWeek('2026-11-16', '2026-11-22')).toBe(1);
    expect(calendarWeek('2026-11-16', '2026-11-23')).toBe(2);
    expect(weekInfo(settings, '2026-11-22').week).toBe(1);
    expect(weekInfo(settings, '2026-11-23').week).toBe(2);
  });

  it('week 7 is the deload, after it the block is completed', () => {
    const w7 = weekInfo(settings, '2026-12-28');
    expect(w7.week).toBe(7);
    expect(w7.isDeload).toBe(true);
    expect(w7.completed).toBe(false);
    const after = weekInfo(settings, '2027-01-04');
    expect(after.completed).toBe(true);
    expect(after.week).toBe(7);
  });

  it('the settings override the calendar week', () => {
    const w = weekInfo({ blockStartDate: '2026-11-16', weekOverride: 5 }, '2026-11-23');
    expect(w.week).toBe(5);
    expect(w.overridden).toBe(true);
    expect(weekInfo({ blockStartDate: '2026-11-16', weekOverride: 3 }, '2027-02-01').completed).toBe(false);
  });

  it('a future start date shows week 1, not started', () => {
    const w = weekInfo({ blockStartDate: '2026-12-07', weekOverride: null }, '2026-12-02');
    expect(w.week).toBe(1);
    expect(w.notStarted).toBe(true);
  });

  it('a new block starts on the next Monday', () => {
    expect(nextMonday('2027-01-04')).toBe('2027-01-04'); // Monday stays
    expect(nextMonday('2027-01-03')).toBe('2027-01-04'); // Sunday
    expect(nextMonday('2027-01-06')).toBe('2027-01-11'); // Wednesday
  });

  it('dates in the block follow the weekday', () => {
    expect(dateInBlock('2026-11-16', 1, 1)).toBe('2026-11-16');
    expect(dateInBlock('2026-11-16', 2, 2)).toBe('2026-11-24');
    expect(dateInBlock('2026-11-16', 7, 5)).toBe('2027-01-01');
  });

  it('has a rule line for every week', () => {
    for (let w = 1; w <= 7; w++) expect(weekRule(w).text.length).toBeGreaterThan(10);
    expect(weekRule(7).title).toBe('Scarico');
  });
});

describe('sets by week', () => {
  it('uses the first number in weeks 1-3 and the second in weeks 4-6', () => {
    for (const w of [1, 2, 3]) expect(setsForWeek([3, 4], w)).toBe(3);
    for (const w of [4, 5, 6]) expect(setsForWeek([3, 4], w)).toBe(4);
  });

  it('"serie extra" off keeps the first number', () => {
    for (const w of [4, 5, 6]) expect(setsForWeek([3, 4], w, false)).toBe(3);
  });

  it('week 7 is half of the weeks 4-6 number, rounded up, minimum 1', () => {
    expect(setsForWeek([3, 4], 7)).toBe(2);
    expect(setsForWeek([3, 3], 7)).toBe(2);
    expect(setsForWeek([4, 4], 7)).toBe(2);
    expect(setsForWeek([2, 2], 7)).toBe(1);
    expect(setsForWeek([1, 1], 7)).toBe(1);
    expect(setsForWeek([3, 5], 7)).toBe(3);
    expect(setsForWeek([3, 4], 7, false)).toBe(2);
  });

  it('a [0, 3] slot is hidden in weeks 1-3 and appears from week 4', () => {
    for (const w of [1, 2, 3]) expect(isSlotHidden({ sets: [0, 3] }, w)).toBe(true);
    for (const w of [4, 5, 6]) expect(setsForWeek([0, 3], w)).toBe(3);
    expect(setsForWeek([0, 3], 7)).toBe(2);
    expect(isSlotHidden({ sets: [0, 3] }, 5, false)).toBe(true);
    expect(isSlotHidden({ sets: [0, 3] }, 7, false)).toBe(true);
  });

  it('counts exercises and sets of Upper A per week', () => {
    const upperA = seed.slots.filter((s) => s.dayKey === 'upper-a');
    expect(dayPlanSummary(upperA, 2, true)).toEqual({ exercises: 7, sets: 22 });
    expect(dayPlanSummary(upperA, 4, true)).toEqual({ exercises: 7, sets: 25 });
    expect(dayPlanSummary(upperA, 7, true)).toEqual({ exercises: 7, sets: 14 });
    const lowerA = seed.slots.filter((s) => s.dayKey === 'lower-a');
    expect(dayPlanSummary(lowerA, 2, true).exercises).toBe(8);
    expect(dayPlanSummary(lowerA, 4, true).exercises).toBe(9);
  });
});

describe('RIR by week', () => {
  it('week 1 adds one to every number', () => {
    expect(targetRir('0-1', 'isolation', 1)).toBe('1-2');
    expect(targetRir('1', 'compound', 1)).toBe('2');
    expect(targetRir('1-2', 'compound', 1)).toBe('2-3');
    expect(targetRir('0', 'isolation', 1)).toBe('1');
  });

  it('weeks 2-5 show the listed RIR', () => {
    for (const w of [2, 3, 4, 5]) {
      expect(targetRir('1-2', 'compound', w)).toBe('1-2');
      expect(targetRir('0', 'isolation', w)).toBe('0');
    }
  });

  it('week 6: compounds at 1, isolations to failure', () => {
    expect(targetRir('1-2', 'compound', 6)).toBe('1');
    expect(targetRir('0-1', 'isolation', 6)).toBe('0');
    expect(targetRir('1', 'isolation', 6)).toBe('0');
  });

  it('week 7: about 4', () => {
    expect(targetRir('1-2', 'compound', 7)).toBe('~4');
    expect(targetRir('0', 'isolation', 7)).toBe('~4');
  });
});

describe('progression hint', () => {
  const s1 = session('s1', '2026-11-23');
  it('adds one load step when every working set hit the top of the range', () => {
    const last = { session: s1, sets: [1, 2, 3].map((i) => log({ id: `l${i}`, sessionId: 's1', exerciseKey: 'x', setIndex: i, weightKg: 70, reps: 10 })) };
    const hint = progressionHint(last, { min: 6, max: 10 }, 2.5, 2);
    expect(hint.kind).toBe('load');
    expect(hint.weightKg).toBe(72.5);
    expect(hint.reps).toBe(6);
  });

  it('otherwise one more rep at the same load', () => {
    const last = {
      session: s1,
      sets: [log({ id: 'a', sessionId: 's1', exerciseKey: 'x', weightKg: 70, reps: 10 }), log({ id: 'b', sessionId: 's1', exerciseKey: 'x', setIndex: 1, weightKg: 70, reps: 8 })],
    };
    const hint = progressionHint(last, { min: 6, max: 10 }, 2.5, 3);
    expect(hint.kind).toBe('reps');
    expect(hint.weightKg).toBe(70);
    expect(hint.reps).toBe(11);
  });

  it('works on the week 1 summaries: bench 20 x 10 -> 22.5, lat pulldown 70 x 6 -> 70 x 7', () => {
    const bench = lastPerformance('bench-press', seed.setLogs, sessionsById)!;
    expect(progressionHint(bench, { min: 6, max: 10 }, 2.5, 2)).toMatchObject({ kind: 'load', weightKg: 22.5 });
    const lat = lastPerformance('lat-pulldown', seed.setLogs, sessionsById)!;
    expect(progressionHint(lat, { min: 6, max: 10 }, 2.5, 2)).toMatchObject({ kind: 'reps', weightKg: 70, reps: 7 });
  });

  it('keeps the load in the deload week', () => {
    const lat = lastPerformance('lat-pulldown', seed.setLogs, sessionsById)!;
    expect(progressionHint(lat, { min: 6, max: 10 }, 2.5, 7)).toMatchObject({ kind: 'deload', weightKg: 70 });
  });

  it('first time: no history', () => {
    expect(progressionHint(null, { min: 8, max: 12 }, 2.5, 2).kind).toBe('first');
  });
});

describe('"Ultima volta" across days (week 1 seed)', () => {
  const label = (key: string) => {
    const p = lastPerformance(key, seed.setLogs, sessionsById);
    if (!p) return null;
    const l = performanceLabel(p);
    return formatSet(l.weightKg, l.reps);
  };

  it('Monday: bench press 20 x 10, lat pulldown 70 x 6', () => {
    expect(label('bench-press')).toBe('20 kg × 10');
    expect(label('lat-pulldown')).toBe('70 kg × 6');
  });

  it('Tuesday: hack squat 45 x 6, reverse pec deck 40 x 10 (Friday), leg extension 85 x 10 (Friday)', () => {
    expect(label('hack-squat')).toBe('45 kg × 6');
    const rpd = lastPerformance('reverse-pec-deck', seed.setLogs, sessionsById)!;
    expect(formatSet(rpd.sets[0].weightKg, rpd.sets[0].reps)).toBe('40 kg × 10');
    expect(rpd.session.dayKey).toBe('lower-b');
    const le = lastPerformance('leg-extension', seed.setLogs, sessionsById)!;
    expect(formatSet(le.sets[0].weightKg, le.sets[0].reps)).toBe('85 kg × 10');
    expect(le.session.date).toBe('2026-11-20');
  });

  it('Friday: cable lateral raise 30 x 10 (from Tuesday)', () => {
    const p = lastPerformance('cable-lateral-raise', seed.setLogs, sessionsById)!;
    expect(label('cable-lateral-raise')).toBe('30 kg × 10');
    expect(p.session.dayKey).toBe('lower-a');
  });

  it('"6/7" prefills 6 and keeps the raw text for the history', () => {
    const p = lastPerformance('lying-leg-curl', seed.setLogs, sessionsById)!;
    expect(prefillFor(p, 0)).toEqual({ weightKg: 45, reps: 6 });
    expect(displayReps(p.sets[0])).toBe('6/7');
    expect(p.sets[0].note).toContain('Seated leg curl');
  });

  it('a skipped exercise ("x") leaves the earlier numbers as last time', () => {
    const p = lastPerformance('standing-calf-raise', seed.setLogs, sessionsById)!;
    expect(p.session.dayKey).toBe('lower-a');
    expect(formatSet(p.sets[0].weightKg, p.sets[0].reps)).toBe('60 kg × 8');
    const fri = seed.sessions.find((s) => s.dayKey === 'lower-b')!;
    expect(fri.skipped).toContain(seedId('slot', 'lower-b', '4a'));
  });

  it('ignores warm-ups, unchecked rows and deleted logs, and prefers the newest session', () => {
    const s2 = session('s2', '2026-11-23', 'upper-b');
    const all = [
      ...seed.setLogs,
      log({ id: 'w', sessionId: 's2', exerciseKey: 'bench-press', weightKg: 40, reps: 10, isWarmup: true }),
      log({ id: 'u', sessionId: 's2', exerciseKey: 'bench-press', setIndex: 1, weightKg: 99, reps: 9, doneAt: null }),
      log({ id: 'd', sessionId: 's2', exerciseKey: 'bench-press', setIndex: 2, weightKg: 99, reps: 9, deletedAt: '2026-11-23T19:00:00.000Z' }),
    ];
    const map = new Map(sessionsById);
    map.set('s2', s2);
    expect(lastPerformance('bench-press', all, map)!.session.dayKey).toBe('upper-a');
    all.push(log({ id: 'ok', sessionId: 's2', exerciseKey: 'bench-press', setIndex: 3, weightKg: 22.5, reps: 8 }));
    const p = lastPerformance('bench-press', all, map)!;
    expect(p.session.id).toBe('s2');
    expect(p.sets.map((s) => s.id)).toEqual(['ok']);
    expect(lastPerformance('bench-press', all, map, { excludeSessionId: 's2' })!.session.dayKey).toBe('upper-a');
    expect(lastPerformance('bench-press', all, map, { before: s2 })!.session.dayKey).toBe('upper-a');
  });
});

describe('records and totals', () => {
  it('marks a PR for more weight, or more reps at the same weight', () => {
    const a = session('a', '2026-11-23');
    const b = session('b', '2026-11-30');
    const logs = [
      log({ id: 'a1', sessionId: 'a', exerciseKey: 'x', weightKg: 70, reps: 6 }),
      log({ id: 'b1', sessionId: 'b', exerciseKey: 'x', weightKg: 70, reps: 7 }),
      log({ id: 'b2', sessionId: 'b', exerciseKey: 'x', setIndex: 1, weightKg: 72.5, reps: 5 }),
      log({ id: 'b3', sessionId: 'b', exerciseKey: 'x', setIndex: 2, weightKg: 70, reps: 9 }),
    ];
    const prs = personalRecords(logs, new Map([['a', a], ['b', b]]));
    expect([...prs].sort()).toEqual(['b1', 'b2']);
  });

  it('warm-ups never count in the volume', () => {
    const logs = [
      log({ id: '1', sessionId: 's', exerciseKey: 'x', weightKg: 50, reps: 10 }),
      log({ id: '2', sessionId: 's', exerciseKey: 'x', weightKg: 20, reps: 10, isWarmup: true }),
    ];
    expect(volumeKg(logs)).toBe(500);
  });
});

describe('labels and supersets', () => {
  it('recomputing labels gives the sheet labels back', () => {
    for (const day of seed.days) {
      const slots = seed.slots.filter((s) => s.dayKey === day.key);
      expect(relabel(slots).map((s) => s.label)).toEqual(slots.map((s) => s.label));
    }
  });

  it('groups superset pairs together', () => {
    const upperA = seed.slots.filter((s) => s.dayKey === 'upper-a');
    const groups = groupSlots(upperA).map((g) => g.map((s) => s.label));
    expect(groups).toEqual([['1'], ['2'], ['3'], ['4'], ['5'], ['6a', '6b']]);
  });

  it('marks single-arm exercises', () => {
    const sal = seed.slots.find((s) => s.exerciseKey === 'single-arm-lat-pulldown')!;
    expect(sal.singleArm).toBe(true);
    expect(seed.slots.filter((s) => s.singleArm)).toHaveLength(1);
  });
});

describe('numbers on an Italian keyboard', () => {
  it('accepts a comma or a dot and rounds to 0.5 kg', () => {
    expect(parseWeight('22,5')).toBe(22.5);
    expect(parseWeight('22.5')).toBe(22.5);
    expect(parseWeight('22,7')).toBe(22.5);
    expect(parseWeight('22,8')).toBe(23);
    expect(parseWeight('')).toBeNull();
    expect(parseWeight('abc')).toBeNull();
    expect(formatKg(22.5)).toBe('22,5');
    expect(formatKg(20)).toBe('20');
    expect(sanitizeWeightTyping('2a2,,5.')).toBe('22,5');
    expect(parseReps('6/7')).toBe(6);
  });
});

describe('seed ids', () => {
  it('are UUID v5 of readable keys, the same on every build', () => {
    expect(seedId('slot', 'upper-a', '6a')).toBe(uuidv5('slot:upper-a:6a', SCHEDA_NAMESPACE));
    const again = buildSeed();
    expect(again.slots.map((s) => s.id)).toEqual(seed.slots.map((s) => s.id));
    expect(again.setLogs).toEqual(seed.setLogs);
    const ids = [...seed.exercises, ...seed.days, ...seed.slots, ...seed.sessions, ...seed.setLogs].map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('imports one summary entry per typed week 1 number plus the extra log', () => {
    // 22 typed numbers (one is "x") + 4 extra entries
    expect(seed.setLogs).toHaveLength(21 + 4);
    expect(seed.setLogs.every((l) => l.isSummary && !l.isWarmup)).toBe(true);
    expect(seed.setLogs.filter((l) => l.slotId === null)).toHaveLength(4);
    const dates = Object.fromEntries(seed.sessions.map((s) => [s.dayKey, s.date]));
    expect(dates).toEqual({ 'upper-a': '2026-11-16', 'lower-a': '2026-11-17', 'upper-b': '2026-11-19', 'lower-b': '2026-11-20' });
  });

  it('keeps incline-dumbbell in the library with history only', () => {
    expect(seed.exercises.find((e) => e.key === 'incline-dumbbell')).toBeTruthy();
    expect(seed.slots.some((s) => s.exerciseKey === 'incline-dumbbell')).toBe(false);
    expect(seed.setLogs.filter((l) => l.exerciseKey === 'incline-dumbbell')).toHaveLength(1);
  });
});
