/**
 * Data fixes for records that already exist on a device (or come from an old backup).
 * Every migration is idempotent: it only touches what still needs fixing, and its
 * edits are normal writes, so they sync like any other change.
 */
import { db, getMeta, setMeta } from './db';
import { SETTINGS_ID } from './ids';
import { BLOCK_WEEKS, relabel } from './program';
import { write } from './repo';
import { FORMER_SUPERSET_REST_SECONDS, slotSeedId } from './seed';
import type { Settings, Slot } from './types';

/**
 * Supersets are gone (a busy gym makes them impractical): every exercise is its own,
 * numbered 1..n in order. An exercise that was the "a" of a pair had no rest ("go
 * straight to b"), so it gets a normal one. Exercises, history and order are untouched.
 * Returns how many slots were changed.
 */
export async function migrateNoSupersets(): Promise<number> {
  const live = (await db.slots.toArray()).filter((s) => !s.deletedAt);
  const byDay = new Map<string, Slot[]>();
  for (const s of live) byDay.set(s.dayKey, [...(byDay.get(s.dayKey) ?? []), s]);

  const fixes: Slot[] = [];
  for (const slots of byDay.values()) {
    const numbered = relabel(slots);
    const byId = new Map(numbered.map((s) => [s.id, s]));
    for (const s of slots) {
      const label = byId.get(s.id)!.label;
      const wasPaired = !!s.superset;
      if (!wasPaired && s.label === label) continue;
      const noRest = wasPaired && s.restSeconds === 0;
      fixes.push({
        ...s,
        label,
        superset: null,
        restSeconds: noRest ? FORMER_SUPERSET_REST_SECONDS : s.restSeconds,
        restText: noRest ? `${FORMER_SUPERSET_REST_SECONDS} s` : s.restText,
      });
    }
  }
  if (fixes.length === 0) return 0;
  await write(async (w) => {
    for (const s of fixes) await w.put('slots', s);
  });
  return fixes.length;
}

/* ------------------------------------------------------------------ more sets on the upper days */

export interface SetsChange {
  dayKey: string;
  /** The label of the slot in the original sheet ("6a"): its id comes from it, so it never changes. */
  seedLabel: string;
  exerciseKey: string;
  from: { sets: [number, number]; note?: string };
  to: { sets: [number, number]; note?: string };
}

/**
 * More serie from week 4 (the second number of `sets`) for triceps, biceps, side delts, lats
 * and upper back. Weeks 1-3 are untouched, reps/RIR/rest stay those of the exercise.
 * Max +2 per exercise and +5 per workout; the lower days are not touched.
 *
 * Direct serie per week from week 4, before -> after:
 *   tricipiti 9 -> 12, deltoidi laterali 11 -> 13, dorsali 14 -> 16, alto schiena 6 -> 8, bicipiti 11 -> 12.
 * Check them with `node scripts/count-direct-sets.mjs --before <old seed.json>`.
 */
export const MORE_UPPER_SETS: SetsChange[] = [
  // Upper A (+4): overhead triceps first, a set more on the rows and the lateral raise
  { dayKey: 'upper-a', seedLabel: '3', exerciseKey: 'chest-supported-row', from: { sets: [3, 3] }, to: { sets: [3, 4] } },
  {
    dayKey: 'upper-a',
    seedLabel: '5',
    exerciseKey: 'cable-lateral-raise',
    from: { sets: [3, 4], note: 'Keeps tension at the bottom where dumbbells have none; 4th set from Wk 4' },
    to: { sets: [3, 5], note: 'Keeps tension at the bottom where dumbbells have none; 4th and 5th set from Wk 4' },
  },
  { dayKey: 'upper-a', seedLabel: '6a', exerciseKey: 'overhead-cable-triceps-extension', from: { sets: [4, 4] }, to: { sets: [4, 6] } },
  // Upper B (+4)
  { dayKey: 'upper-b', seedLabel: '3', exerciseKey: 'seated-cable-row', from: { sets: [3, 3] }, to: { sets: [3, 4] } },
  {
    dayKey: 'upper-b',
    seedLabel: '4a',
    exerciseKey: 'machine-or-dumbbell-lateral-raise',
    from: { sets: [3, 4], note: 'Different resistance curve from Upper A; easy to add lengthened partials; 4th set from Wk 4' },
    to: { sets: [3, 5], note: 'Different resistance curve from Upper A; easy to add lengthened partials; 4th and 5th set from Wk 4' },
  },
  { dayKey: 'upper-b', seedLabel: '5a', exerciseKey: 'preacher-curl', from: { sets: [4, 4] }, to: { sets: [4, 5] } },
  { dayKey: 'upper-b', seedLabel: '5b', exerciseKey: 'overhead-triceps-extension', from: { sets: [3, 3] }, to: { sets: [3, 4] } },
];

const MIGRATIONS_DONE = 'migrations';

async function isDone(id: string): Promise<boolean> {
  return ((await getMeta<string[]>(MIGRATIONS_DONE)) ?? []).includes(id);
}

async function markDone(id: string): Promise<void> {
  const done = (await getMeta<string[]>(MIGRATIONS_DONE)) ?? [];
  if (!done.includes(id)) await setMeta(MIGRATIONS_DONE, [...done, id]);
}

/**
 * Applies MORE_UPPER_SETS to a device that already has the program. The seed never overwrites
 * existing records, so this is how the change reaches the phone. It runs once, and only on a
 * slot that still has exactly the old numbers: if I changed it by hand, it is left alone.
 * Returns how many slots were changed.
 */
export async function migrateMoreUpperSets(): Promise<number> {
  const id = 'more-upper-sets-v1';
  if (await isDone(id)) return 0;
  const fixes: Slot[] = [];
  for (const c of MORE_UPPER_SETS) {
    const slot = await db.slots.get(slotSeedId(c.dayKey, c.seedLabel));
    if (!slot || slot.deletedAt) continue;
    if (slot.sets[0] !== c.from.sets[0] || slot.sets[1] !== c.from.sets[1]) continue;
    fixes.push({ ...slot, sets: [c.to.sets[0], c.to.sets[1]], note: c.to.note !== undefined && slot.note === c.from.note ? c.to.note : slot.note });
  }
  if (fixes.length) {
    await write(async (w) => {
      for (const s of fixes) await w.put('slots', s);
    });
  }
  await markDone(id);
  return fixes.length;
}

/* ------------------------------------------------------------------ the block is 6 weeks */

/** A week override beyond the last week of the block (the old week 7) goes back to "automatic". */
export async function migrateWeekOverride(): Promise<boolean> {
  const settings = await db.settings.get(SETTINGS_ID);
  if (!settings || settings.deletedAt || settings.weekOverride === null || settings.weekOverride <= BLOCK_WEEKS) return false;
  await write((w) => w.put<Settings>('settings', { ...settings, weekOverride: null }));
  return true;
}

export async function runMigrations(): Promise<void> {
  await migrateNoSupersets();
  await migrateMoreUpperSets();
  await migrateWeekOverride();
}
