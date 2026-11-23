import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MORE_UPPER_SETS } from './migrations';
import { BLOCK_WEEKS } from './program';
import { buildSeed, SEED } from './seed';
import { seedId } from './ids';

/**
 * The program change: no deload week (6-week block) and more serie from week 4 for triceps,
 * biceps, side delts, lats and upper back. The script scripts/count-direct-sets.mjs counts the
 * DIRECT serie (primary muscles) per muscle; these tests freeze its answer.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.resolve(here, '../../scripts/count-direct-sets.mjs');
const seedFile = path.resolve(here, '../data/seed.json');

type Table = Record<string, number>;
interface Analysis {
  muscles: Record<string, { early: number; late: number; byDay: Record<string, { early: number; late: number }> }>;
  days: Record<string, { early: number; late: number }>;
  weeks: { week: number; total: number }[];
  slots: { id: string; day: string; sets: [number, number] }[];
}

/** Serie per week from week 4, as in the program before the change (the numbers I started from). */
const LATE_BEFORE: Table = { lats: 14, biceps: 11, 'side-delts': 11, hamstrings: 10, chest: 9, quads: 9, triceps: 9, calves: 8, abs: 6, 'forearm-extensors': 6, 'forearm-flexors': 6, 'rear-delts': 6, 'upper-back': 6, 'glute-medius': 3, glutes: 3 };
/** The goal: 9 -> 12 triceps, 11 -> 13 side delts, 14 -> 16 lats, 6 -> 8 upper back, 11 -> 12 biceps; the rest the same. */
const LATE_AFTER: Table = { ...LATE_BEFORE, triceps: 12, 'side-delts': 13, lats: 16, 'upper-back': 8, biceps: 12 };
/** Weeks 1-3: untouched. */
const EARLY: Table = { lats: 12, biceps: 10, 'side-delts': 9, hamstrings: 10, chest: 9, quads: 9, triceps: 9, calves: 8, abs: 6, 'forearm-extensors': 0, 'forearm-flexors': 6, 'rear-delts': 6, 'upper-back': 6, 'glute-medius': 3, glutes: 3 };

function run(args: string[]): { after: Analysis; before: Analysis | null; checks: { rule: string; ok: boolean; detail: string }[] | null } {
  return JSON.parse(execFileSync(process.execPath, [script, '--json', ...args], { encoding: 'utf8' }));
}

/** The program as it was: the new seed with the changed slots put back to their old numbers. */
function oldProgramFile(): string {
  const old = structuredClone(SEED) as unknown as { program: { blockWeeks: number }; days: { key: string; exercises: { label: string; sets: [number, number]; note: string }[] }[] };
  for (const c of MORE_UPPER_SETS) {
    const slot = old.days.find((d) => d.key === c.dayKey)!.exercises.find((e) => e.label === c.seedLabel)!;
    slot.sets = [...c.from.sets];
    if (c.from.note !== undefined) slot.note = c.from.note;
  }
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'scheda-')), 'before.json');
  fs.writeFileSync(file, JSON.stringify(old));
  return file;
}

const lateOf = (a: Analysis) => Object.fromEntries(Object.entries(a.muscles).map(([m, v]) => [m, v.late]));
const earlyOf = (a: Analysis) => Object.fromEntries(Object.entries(a.muscles).map(([m, v]) => [m, v.early]));

describe('the block has no deload week', () => {
  it('is 6 weeks long in the code and in the program data', () => {
    expect(BLOCK_WEEKS).toBe(6);
    expect((SEED.program as { blockWeeks: number }).blockWeeks).toBe(6);
  });

  it('the program data has no word about a deload, week 7 or half the sets', () => {
    const text = JSON.stringify(SEED).toLowerCase();
    expect(text).not.toMatch(/deload|scarico|week 7|wk 7|settimana 7|7 weeks|7 settimane/);
  });
});

describe('more serie from week 4: direct serie per muscle', () => {
  const before = run([seedFile, '--before', oldProgramFile()]).before!;
  const { after, checks } = run([seedFile, '--before', oldProgramFile()]);

  it('the old program gives the numbers I started from (9, 11, 14, 6, 11)', () => {
    expect(lateOf(before)).toEqual(LATE_BEFORE);
    expect(earlyOf(before)).toEqual(EARLY);
  });

  it('after: tricipiti 12, deltoidi laterali 13, dorsali 16, alto schiena 8, bicipiti 12; the other muscles as before', () => {
    expect(lateOf(after)).toEqual(LATE_AFTER);
  });

  it('weeks 1-3 are untouched', () => {
    expect(earlyOf(after)).toEqual(EARLY);
  });

  it('every rule of the change holds (the script checks them)', () => {
    expect(checks!.filter((c) => !c.ok)).toEqual([]);
    expect(checks!.length).toBeGreaterThanOrEqual(14);
  });

  it('serie per day and per week', () => {
    expect(Object.fromEntries(Object.entries(after.days).map(([k, d]) => [k, [d.early, d.late]]))).toEqual({
      'upper-a': [22, 29],
      'lower-a': [26, 29],
      'upper-b': [24, 30],
      'lower-b': [25, 28],
    });
    expect(after.weeks.map((w) => w.total)).toEqual([97, 97, 97, 116, 116, 116]);
    expect(before.weeks.map((w) => w.total)).toEqual([97, 97, 97, 108, 108, 108]);
  });

  it('the new serie are split between the two upper days, so each muscle is still trained twice a week', () => {
    const split = (m: string) => [after.muscles[m].byDay['upper-a'].late, after.muscles[m].byDay['upper-b'].late];
    expect(split('triceps')).toEqual([6, 6]);
    expect(split('side-delts')).toEqual([5, 5]); // + 3 on Lower B, which is not touched
    expect(split('lats')).toEqual([8, 8]);
    expect(split('upper-back')).toEqual([4, 4]);
    expect(split('biceps')).toEqual([4, 5]); // + 3 on Lower B
  });
});

describe('MORE_UPPER_SETS (the change as data)', () => {
  it('max +2 per exercise, max +5 per workout, only upper days, only the second number', () => {
    const perDay: Record<string, number> = {};
    for (const c of MORE_UPPER_SETS) {
      expect(c.dayKey).toMatch(/^upper-/);
      expect(c.to.sets[0]).toBe(c.from.sets[0]); // weeks 1-3 untouched
      const extra = c.to.sets[1] - c.from.sets[1];
      expect(extra).toBeGreaterThan(0);
      expect(extra).toBeLessThanOrEqual(2);
      perDay[c.dayKey] = (perDay[c.dayKey] ?? 0) + extra;
    }
    expect(perDay).toEqual({ 'upper-a': 4, 'upper-b': 4 });
    expect(Object.values(perDay).every((n) => n <= 5)).toBe(true);
  });

  it('triceps: only the overhead exercises get serie, the pushdown stays', () => {
    const keys = MORE_UPPER_SETS.filter((c) => ['overhead-cable-triceps-extension', 'overhead-triceps-extension', 'cable-pushdown'].includes(c.exerciseKey)).map((c) => c.exerciseKey);
    expect(keys.sort()).toEqual(['overhead-cable-triceps-extension', 'overhead-triceps-extension']);
  });

  it('only exercises that were already in the program, and the seed has the new numbers and notes', () => {
    const slots = buildSeed().slots;
    for (const c of MORE_UPPER_SETS) {
      const slot = slots.find((s) => s.id === seedId('slot', c.dayKey, c.seedLabel))!;
      expect(slot.exerciseKey).toBe(c.exerciseKey);
      expect(slot.sets).toEqual(c.to.sets);
      if (c.to.note) expect(slot.note).toBe(c.to.note);
    }
    expect(slots).toHaveLength(33); // no exercise added or removed
  });

  it('notes that cite the number of serie follow the new numbers', () => {
    const notes = buildSeed().slots.filter((s) => s.sets[1] === 5 && /set from Wk 4/.test(s.note)).map((s) => s.note);
    expect(notes).toHaveLength(2);
    expect(notes.every((n) => n.endsWith('4th and 5th set from Wk 4'))).toBe(true);
    // the exercises with 4 serie keep "4th set"
    const four = buildSeed().slots.filter((s) => s.sets[1] === 4 && /4th set from Wk 4/.test(s.note));
    expect(four.length).toBeGreaterThan(0);
  });
});
