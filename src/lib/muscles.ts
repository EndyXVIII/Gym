import type { MuscleKey } from './types';

export const MUSCLE_LABELS: Record<MuscleKey, string> = {
  chest: 'petto',
  lats: 'dorsali',
  'upper-back': 'alto schiena',
  'lower-back': 'lombari',
  'front-delts': 'deltoidi anteriori',
  'side-delts': 'deltoidi laterali',
  'rear-delts': 'deltoidi posteriori',
  biceps: 'bicipiti',
  triceps: 'tricipiti',
  forearms: 'avambracci',
  'forearm-flexors': 'flessori avambraccio',
  'forearm-extensors': 'estensori avambraccio',
  quads: 'quadricipiti',
  hamstrings: 'femorali',
  glutes: 'glutei',
  'glute-medius': 'gluteo medio',
  calves: 'polpacci',
  abs: 'addominali',
};

export const ALL_MUSCLES = Object.keys(MUSCLE_LABELS) as MuscleKey[];

export function muscleLabel(m: string): string {
  return MUSCLE_LABELS[m as MuscleKey] ?? m;
}

/** "forearms" covers both flexors and extensors when filtering. */
export function muscleMatches(filter: MuscleKey, muscles: readonly MuscleKey[]): boolean {
  if (muscles.includes(filter)) return true;
  if (filter === 'forearms') return muscles.includes('forearm-flexors') || muscles.includes('forearm-extensors');
  if (filter === 'forearm-flexors' || filter === 'forearm-extensors') return muscles.includes('forearms');
  return false;
}

export const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: 'bilanciere',
  dumbbell: 'manubri',
  cable: 'cavo',
  machine: 'macchina',
  bodyweight: 'corpo libero',
  'ez-bar': 'bilanciere EZ',
  kettlebell: 'kettlebell',
  band: 'elastico',
  smith: 'Smith machine',
  other: 'altro',
};

export function equipmentLabel(e: string): string {
  return EQUIPMENT_LABELS[e] ?? e;
}
