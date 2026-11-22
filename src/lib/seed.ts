/**
 * Builds the initial records from my program sheet (src/data/seed.json).
 * Pure and deterministic: same ids and timestamps on every device, so
 * importing on two devices never duplicates anything.
 */
import seedJson from '../data/seed.json';
import { IMAGE_MATCHES } from '../data/exerciseImages';
import { seedId, SETTINGS_ID } from './ids';
import { addDays, DEFAULT_BLOCK_START, isSingleArmRest, parseRange, relabel, weekdayFromName } from './program';
import { parseReps } from './format';
import type { Day, DayType, Exercise, MuscleKey, Session, SetLog, Settings, Slot, SlotKind } from './types';

export interface SeedWk1 {
  raw: string;
  weightKg?: number;
  reps?: string;
  skipped?: boolean;
}

export interface SeedSlot {
  label: string;
  exerciseKey: string;
  name: string;
  sets: [number, number];
  reps: string;
  rir: string;
  rest: string;
  restSeconds: number;
  superset: { group: string; role: 'a' | 'b' } | null;
  kind: SlotKind;
  note: string;
  demo: string;
  wk1: SeedWk1 | null;
  wk1Note?: string;
}

export interface SeedData {
  program: { name: string; athlete: string; blockWeeks: number; blockStartDateDefault: string; weekdayToDay: Record<string, string> };
  library: { key: string; name: string; equipment: string; primary: string[]; secondary: string[]; imageHints: string[] }[];
  days: { key: string; dayNumber: number; title: string; weekday: string; type: DayType; estimatedMinutes: number; exercises: SeedSlot[] }[];
  week1ExtraLog: { dayKey: string; exerciseKey: string; week: number; raw: string; weightKg: number; reps: string; note: string }[];
}

export const SEED: SeedData = seedJson as unknown as SeedData;

/** All seed records carry this updatedAt, older than any real edit, so edits always win. */
export const SEED_TIME = '2026-11-16T00:00:00.000Z';
export const SEED_VERSION = 1;

export interface SeedRecords {
  settings: Settings;
  exercises: Exercise[];
  days: Day[];
  slots: Slot[];
  sessions: Session[];
  setLogs: SetLog[];
}

const base = { updatedAt: SEED_TIME, deletedAt: null, _dirty: 1 as const };

export function defaultSettings(name = 'Endi', blockStartDate = DEFAULT_BLOCK_START): Settings {
  return {
    ...base,
    id: SETTINGS_ID,
    name,
    blockStartDate,
    weekOverride: null,
    extraSets: true,
    defaultLoadStepKg: 2.5,
    sound: true,
    theme: 'system',
  };
}

export const slotSeedId = (dayKey: string, label: string) => seedId('slot', dayKey, label);
export const exerciseSeedId = (key: string) => seedId('exercise', key);
export const daySeedId = (key: string) => seedId('day', key);
export const wk1SessionId = (dayKey: string) => seedId('session', 'wk1', dayKey);

/** Parses "45x6/7" style text. */
function parseRaw(raw: string): { weightKg: number | null; reps: number | null } {
  const m = raw.trim().match(/^(\d+(?:[.,]\d+)?)\s*[x×]\s*(.+)$/i);
  if (!m) return { weightKg: null, reps: null };
  return { weightKg: Number(m[1].replace(',', '.')), reps: parseReps(m[2]) };
}

export function buildSeed(seed: SeedData = SEED): SeedRecords {
  const blockStart = seed.program.blockStartDateDefault || DEFAULT_BLOCK_START;
  const settings = defaultSettings(seed.program.athlete || 'Endi', blockStart);

  const exercises: Exercise[] = seed.library.map((x) => {
    const match = IMAGE_MATCHES[x.key];
    const image =
      match && match.confidence !== 'low' && match.files.length > 0
        ? { source: 'repdb' as const, datasetId: match.datasetId, poses: [...match.files], confidence: match.confidence }
        : null;
    return {
      ...base,
      id: exerciseSeedId(x.key),
      key: x.key,
      name: x.name,
      equipment: x.equipment,
      primary: x.primary as MuscleKey[],
      secondary: x.secondary as MuscleKey[],
      imageHints: [...x.imageHints],
      image,
      photoId: null,
      preferMuscleMap: false,
      loadStepKg: null,
    };
  });

  const days: Day[] = [];
  const slots: Slot[] = [];
  const sessions: Session[] = [];
  const setLogs: SetLog[] = [];

  seed.days.forEach((d, dayIndex) => {
    const weekday = weekdayFromName(d.weekday);
    days.push({
      ...base,
      id: daySeedId(d.key),
      key: d.key,
      title: d.title,
      weekday,
      type: d.type,
      estimatedMinutes: d.estimatedMinutes,
      position: d.dayNumber ?? dayIndex + 1,
    });

    const daySlots: Slot[] = d.exercises.map((e, i) => {
      const range = parseRange(e.reps) ?? { min: 8, max: 12 };
      return {
        ...base,
        id: slotSeedId(d.key, e.label),
        dayKey: d.key,
        label: e.label,
        exerciseKey: e.exerciseKey,
        name: e.name,
        sets: [e.sets[0], e.sets[1]],
        reps: e.reps,
        repsMin: range.min,
        repsMax: range.max,
        rir: e.rir,
        restSeconds: e.restSeconds,
        restText: e.rest,
        superset: e.superset ? { group: `${d.key}:${e.superset.group}`, role: e.superset.role } : null,
        kind: e.kind,
        note: e.note,
        demo: e.demo,
        position: i + 1,
        singleArm: isSingleArmRest(e.rest),
      };
    });
    // Labels come from the sheet; relabel() must agree with them.
    slots.push(...relabel(daySlots));

    // Week 1: one summary entry per exercise, dated on the day's weekday.
    const date = addDays(blockStart, (weekday ?? 1) - 1);
    const sessionId = wk1SessionId(d.key);
    const time = `${date}T12:00:00.000Z`;
    const skipped: string[] = [];
    let index = 0;
    for (const e of d.exercises) {
      if (!e.wk1) continue;
      const slotId = slotSeedId(d.key, e.label);
      if (e.wk1.skipped || e.wk1.raw.trim().toLowerCase() === 'x') {
        skipped.push(slotId);
        continue;
      }
      const parsed = parseRaw(e.wk1.raw);
      setLogs.push({
        ...base,
        id: seedId('setlog', 'wk1', d.key, e.label),
        sessionId,
        slotId,
        exerciseKey: e.exerciseKey,
        setIndex: 0,
        weightKg: e.wk1.weightKg ?? parsed.weightKg,
        reps: parseReps(e.wk1.reps ?? '') ?? parsed.reps,
        isWarmup: false,
        isSummary: true,
        rawText: e.wk1.raw,
        note: e.wk1Note ?? null,
        doneAt: addSeconds(time, index++),
      });
    }
    for (const x of seed.week1ExtraLog.filter((x) => x.dayKey === d.key)) {
      setLogs.push({
        ...base,
        id: seedId('setlog', 'wk1-extra', d.key, x.exerciseKey),
        sessionId,
        slotId: null,
        exerciseKey: x.exerciseKey,
        setIndex: 0,
        weightKg: x.weightKg,
        reps: parseReps(x.reps),
        isWarmup: false,
        isSummary: true,
        rawText: x.raw,
        note: x.note,
        doneAt: addSeconds(time, index++),
      });
    }
    sessions.push({
      ...base,
      id: sessionId,
      dayKey: d.key,
      week: 1,
      blockStart,
      date,
      startedAt: time,
      finishedAt: time,
      note: 'Settimana 1 importata dalla scheda.',
      skipped,
      substitutions: {},
    });
  });

  return { settings, exercises, days, slots, sessions, setLogs };
}

function addSeconds(iso: string, s: number): string {
  return new Date(Date.parse(iso) + s * 1000).toISOString();
}
