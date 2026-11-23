/**
 * Which muscles a workout (or a week) hit. Pure functions, unit tested.
 *
 * Every working set done counts 1 for the exercise's primary muscles and 0.5 for its
 * secondary ones (warm-ups never count). The map colours muscles by how many "serie"
 * they got, in five steps, on a fixed scale so different weeks can be compared.
 */
import { ALL_MUSCLES } from './muscles';
import { isWorkingDone } from './program';
import type { Exercise, MuscleKey, SetLog } from './types';

export type MuscleCredits = Partial<Record<MuscleKey, number>>;

export const SECONDARY_WEIGHT = 0.5;
/** Serie that fill the colour scale: one workout / one week. */
export const FULL_AT_SESSION = 6;
export const FULL_AT_WEEK = 12;
export const HEAT_LEVELS = 5;

type MuscleSource = Pick<Exercise, 'primary' | 'secondary'>;

export function creditsFor(logs: readonly SetLog[], exercises: ReadonlyMap<string, MuscleSource>): MuscleCredits {
  const out: MuscleCredits = {};
  for (const l of logs) {
    if (!isWorkingDone(l)) continue;
    const ex = exercises.get(l.exerciseKey);
    if (!ex) continue;
    for (const m of ex.primary) out[m] = (out[m] ?? 0) + 1;
    for (const m of ex.secondary) if (!ex.primary.includes(m)) out[m] = (out[m] ?? 0) + SECONDARY_WEIGHT;
  }
  return out;
}

export function sumCredits(list: readonly MuscleCredits[]): MuscleCredits {
  const out: MuscleCredits = {};
  for (const c of list) for (const [m, v] of Object.entries(c) as [MuscleKey, number][]) out[m] = (out[m] ?? 0) + v;
  return out;
}

/** What a region of the body map shows: the generic "avambracci" lights both forearm regions. */
export function regionValue(credits: MuscleCredits, region: MuscleKey): number {
  const own = credits[region] ?? 0;
  if (region === 'forearm-flexors' || region === 'forearm-extensors') return own + (credits.forearms ?? 0);
  return own;
}

/** 0 = not trained, 1..5 = steps of the colour scale (a fraction of `fullAt`). */
export function heatLevel(value: number, fullAt: number): number {
  if (value <= 0) return 0;
  const f = value / fullAt;
  if (f < 0.2) return 1;
  if (f < 0.4) return 2;
  if (f < 0.6) return 3;
  if (f < 0.85) return 4;
  return 5;
}

/** Level per muscle key, for the map. */
export function heatLevels(credits: MuscleCredits, fullAt: number): Partial<Record<MuscleKey, number>> {
  const out: Partial<Record<MuscleKey, number>> = {};
  for (const m of ALL_MUSCLES) {
    const level = heatLevel(regionValue(credits, m), fullAt);
    if (level > 0) out[m] = level;
  }
  return out;
}

export interface RankedMuscle {
  muscle: MuscleKey;
  value: number;
}

/** Trained muscles, most serie first (ties in body order). */
export function rankedMuscles(credits: MuscleCredits): RankedMuscle[] {
  return ALL_MUSCLES.map((muscle) => ({ muscle, value: credits[muscle] ?? 0 }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value || ALL_MUSCLES.indexOf(a.muscle) - ALL_MUSCLES.indexOf(b.muscle));
}

/** Muscles with nothing at all ("forearms" is covered by flexors and extensors). */
export function untrainedMuscles(credits: MuscleCredits): MuscleKey[] {
  return ALL_MUSCLES.filter((m) => m !== 'forearms' && regionValue(credits, m) === 0);
}

export function totalSerie(credits: MuscleCredits): number {
  return Object.values(credits).reduce((a, b) => a + b, 0);
}

/** 3 -> "3", 2.5 -> "2,5" (Italian decimal comma). */
export function formatSerie(value: number): string {
  const r = Math.round(value * 2) / 2;
  return Number.isInteger(r) ? String(r) : String(r).replace('.', ',');
}
