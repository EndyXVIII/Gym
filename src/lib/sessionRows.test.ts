import { describe, expect, it } from 'vitest';
import { allWorkingDone, appendIndex, buildRows, warmupIndex } from './sessionRows';
import type { Session, SetLog } from './types';

const s: Session = {
  id: 'last',
  dayKey: 'upper-a',
  week: 1,
  blockStart: '2026-11-16',
  date: '2026-11-16',
  startedAt: '2026-11-16T12:00:00.000Z',
  finishedAt: '2026-11-16T12:00:00.000Z',
  note: '',
  skipped: [],
  substitutions: {},
  updatedAt: '2026-11-16T00:00:00.000Z',
  deletedAt: null,
};

function log(p: Partial<SetLog> & Pick<SetLog, 'id'>): SetLog {
  return {
    sessionId: 'now',
    slotId: 'slot',
    exerciseKey: 'bench-press',
    setIndex: 0,
    weightKg: 20,
    reps: 10,
    isWarmup: false,
    isSummary: false,
    rawText: null,
    note: null,
    doneAt: null,
    updatedAt: '2026-11-23T18:00:00.000Z',
    deletedAt: null,
    ...p,
  };
}

const summary = { session: s, sets: [log({ id: 'wk1', sessionId: 'last', isSummary: true, doneAt: s.startedAt, weightKg: 20, reps: 10 })] };

describe('set rows', () => {
  it('plans the week’s sets, prefilled from last time', () => {
    const rows = buildRows([], 3, summary, 6);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => [r.workingNumber, r.weightKg, r.reps, r.log])).toEqual([
      [1, 20, 10, null],
      [2, 20, 10, null],
      [3, 20, 10, null],
    ]);
  });

  it('without history: empty weight, reps at the bottom of the range', () => {
    const rows = buildRows([], 4, null, 8);
    expect(rows.every((r) => r.weightKg === null && r.reps === 8)).toBe(true);
  });

  it('takes set i from last time’s set i', () => {
    const last = {
      session: s,
      sets: [
        log({ id: 'a', sessionId: 'last', setIndex: 0, weightKg: 70, reps: 8, doneAt: s.startedAt }),
        log({ id: 'b', sessionId: 'last', setIndex: 1, weightKg: 67.5, reps: 9, doneAt: s.startedAt }),
      ],
    };
    const rows = buildRows([], 3, last, 6);
    expect(rows.map((r) => r.weightKg)).toEqual([70, 67.5, 67.5]);
  });

  it('stored rows keep their values, planned rows fill up to the planned count', () => {
    const rows = buildRows([log({ id: 'x', weightKg: 22.5, reps: 8, doneAt: '2026-11-23T18:01:00.000Z' })], 3, summary, 6);
    expect(rows.map((r) => [r.key, r.weightKg, r.reps, r.done])).toEqual([
      ['x', 22.5, 8, true],
      ['v:1', 20, 10, false],
      ['v:2', 20, 10, false],
    ]);
  });

  it('a warm-up does not take the place of a working set', () => {
    const rows = buildRows([log({ id: 'w', setIndex: -1, isWarmup: true, weightKg: 10, reps: 12 })], 3, summary, 6);
    expect(rows).toHaveLength(4);
    expect(rows[0].workingNumber).toBeNull();
    expect(rows.slice(1).map((r) => r.workingNumber)).toEqual([1, 2, 3]);
    expect(warmupIndex(rows)).toBe(-2);
    expect(appendIndex(rows)).toBe(3);
  });

  it('extra sets beyond the plan stay', () => {
    const logs = [0, 1, 2, 3].map((i) => log({ id: `l${i}`, setIndex: i, doneAt: '2026-11-23T18:00:00.000Z' }));
    const rows = buildRows(logs, 3, summary, 6);
    expect(rows).toHaveLength(4);
    expect(allWorkingDone(rows)).toBe(true);
  });

  it('ignores deleted logs', () => {
    const rows = buildRows([log({ id: 'd', deletedAt: '2026-11-23T18:00:00.000Z' })], 2, null, 6);
    expect(rows.every((r) => r.log === null)).toBe(true);
  });
});
