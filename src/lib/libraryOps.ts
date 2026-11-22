import { db } from './db';
import { newId, slugify, uniqueKey } from './ids';
import { nowISO, type Writer } from './repo';
import type { Exercise } from './types';

/**
 * A new library exercise. Muscles and equipment start from `template` (the
 * exercise it replaces), so the muscle map is right until I edit them.
 */
export async function createExercise(w: Writer, name: string, template?: Exercise | null): Promise<Exercise> {
  const keys = (await db.exercises.toArray()).map((e) => e.key);
  const ex: Exercise = {
    id: newId(),
    key: uniqueKey(slugify(name), keys),
    name: name.trim(),
    equipment: template?.equipment ?? 'machine',
    primary: template ? [...template.primary] : [],
    secondary: template ? [...template.secondary] : [],
    imageHints: [name.trim().toLowerCase()],
    image: null,
    photoId: null,
    preferMuscleMap: false,
    loadStepKg: template?.loadStepKg ?? null,
    updatedAt: nowISO(),
    deletedAt: null,
  };
  return w.put('exercises', ex);
}
