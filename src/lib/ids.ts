import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';

/** Fixed namespace for Scheda's deterministic ids. Never change it: seed ids derive from it. */
export const SCHEDA_NAMESPACE = 'f38e93ec-2229-4fa5-aaeb-e08a6e638be6';

/**
 * Deterministic UUID (v5) from a readable key, e.g. seedId('slot', 'upper-a', '6a').
 * Importing the seed on two devices gives the same ids, so sync can't duplicate it.
 */
export function seedId(...parts: string[]): string {
  return uuidv5(parts.join(':'), SCHEDA_NAMESPACE);
}

export function newId(): string {
  return uuidv4();
}

export const SETTINGS_ID = seedId('settings');

/** URL-safe key from a name: "Smith machine press" -> "smith-machine-press". */
export function slugify(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'esercizio'
  );
}

/** A key that isn't in `taken`: "bench-press", "bench-press-2", ... */
export function uniqueKey(base: string, taken: Iterable<string>): string {
  const set = new Set(taken);
  if (!set.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const k = `${base}-${i}`;
    if (!set.has(k)) return k;
  }
  return `${base}-${uuidv4().slice(0, 8)}`;
}
