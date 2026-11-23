/**
 * Data fixes for records that already exist on a device (or come from an old backup).
 * Every migration is idempotent: it only touches what still needs fixing, and its
 * edits are normal writes, so they sync like any other change.
 */
import { db } from './db';
import { relabel } from './program';
import { write } from './repo';
import { FORMER_SUPERSET_REST_SECONDS } from './seed';
import type { Slot } from './types';

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

export async function runMigrations(): Promise<void> {
  await migrateNoSupersets();
}
