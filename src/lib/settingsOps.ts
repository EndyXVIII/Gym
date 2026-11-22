import { db } from './db';
import { SETTINGS_ID } from './ids';
import { nextMonday } from './program';
import { write } from './repo';
import { defaultSettings } from './seed';
import type { Settings } from './types';

export async function updateSettings(changes: Partial<Omit<Settings, 'id'>>): Promise<void> {
  await write(async (w) => {
    const current = (await db.settings.get(SETTINGS_ID)) ?? defaultSettings();
    await w.put('settings', { ...current, ...changes, id: SETTINGS_ID });
  });
}

/** Same program, history kept: the block starts again on the next Monday at week 1. */
export async function startNewBlock(today: string): Promise<string> {
  const start = nextMonday(today);
  await updateSettings({ blockStartDate: start, weekOverride: null });
  return start;
}
