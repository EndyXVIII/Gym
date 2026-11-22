/** Local calendar date, "YYYY-MM-DD". */
export type ISODate = string;
/** Full ISO timestamp, e.g. "2026-11-23T18:04:11.123Z". */
export type ISOTime = string;

/** Fields every synced record carries. */
export interface SyncFields {
  id: string;
  updatedAt: ISOTime;
  deletedAt: ISOTime | null;
  /** Local only: 1 = changed since the last successful push. Never sent to the server. */
  _dirty?: 0 | 1;
}

export type MuscleKey =
  | 'chest'
  | 'lats'
  | 'upper-back'
  | 'lower-back'
  | 'front-delts'
  | 'side-delts'
  | 'rear-delts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'forearm-flexors'
  | 'forearm-extensors'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'glute-medius'
  | 'calves'
  | 'abs';

export type Confidence = 'high' | 'medium' | 'low';

/** A picture from the RepDB free dataset, copied into /public/exercises. */
export interface DatasetImage {
  source: 'repdb';
  datasetId: string;
  /** File names in /public/exercises, start pose first. One entry for single-pose records. */
  poses: string[];
  confidence: Confidence;
}

export interface Exercise extends SyncFields {
  key: string;
  name: string;
  equipment: string;
  primary: MuscleKey[];
  secondary: MuscleKey[];
  imageHints: string[];
  /** Matched dataset illustration, or null (then the muscle map is shown). */
  image: DatasetImage | null;
  /** My own photo or video (a Media record id). Wins over `image`. */
  photoId: string | null;
  /** Show the muscle map even if an illustration exists. */
  preferMuscleMap: boolean;
  /** null = use the default load step from the settings (2.5 kg out of the box). */
  loadStepKg: number | null;
}

export type DayType = 'upper' | 'lower';

export interface Day extends SyncFields {
  key: string;
  title: string;
  /** ISO weekday: 1 = Monday ... 7 = Sunday. null = not tied to a weekday. */
  weekday: number | null;
  type: DayType;
  estimatedMinutes: number;
  position: number;
}

export type SlotKind = 'compound' | 'isolation';

export interface Superset {
  group: string;
  role: 'a' | 'b';
}

export interface Slot extends SyncFields {
  dayKey: string;
  /** "1", "6a", ... recomputed from position and supersets. */
  label: string;
  exerciseKey: string;
  /** Display name in this slot, e.g. "Bench press (barbell, flat)". */
  name: string;
  /** [weeks 1-3, from week 4]. [0, 3] = hidden until week 4. */
  sets: [number, number];
  reps: string;
  repsMin: number;
  repsMax: number;
  rir: string;
  restSeconds: number;
  /** The rest text as written in the program sheet ("1 min between arms"). */
  restText: string;
  superset: Superset | null;
  kind: SlotKind;
  note: string;
  demo: string;
  position: number;
  /** One set row covers both arms ("between arms" in the rest text). */
  singleArm: boolean;
}

export interface Session extends SyncFields {
  dayKey: string;
  week: number;
  /** blockStartDate of the block this session belongs to. */
  blockStart: ISODate;
  date: ISODate;
  startedAt: ISOTime | null;
  finishedAt: ISOTime | null;
  note: string;
  /** Slot ids skipped in this session. */
  skipped: string[];
  /** "Sostituisci per oggi": slot id -> exercise key used instead, for this session only. */
  substitutions: Record<string, string>;
}

export interface SetLog extends SyncFields {
  sessionId: string;
  /** null = history that belongs to no slot (week1ExtraLog). */
  slotId: string | null;
  exerciseKey: string;
  setIndex: number;
  weightKg: number | null;
  reps: number | null;
  isWarmup: boolean;
  /** Week 1 import: one "weight x reps" per exercise instead of per set. */
  isSummary: boolean;
  /** What I typed in the sheet, e.g. "45x6/7". */
  rawText: string | null;
  note: string | null;
  /** null = planned or edited but not checked yet; it doesn't count anywhere. */
  doneAt: ISOTime | null;
}

export type ThemePref = 'system' | 'dark' | 'light';

export interface Settings extends SyncFields {
  name: string;
  blockStartDate: ISODate;
  /** 1..7, or null to follow the calendar. */
  weekOverride: number | null;
  /** "Serie extra": use the second number of `sets` in weeks 4-6. */
  extraSets: boolean;
  defaultLoadStepKg: number;
  sound: boolean;
  theme: ThemePref;
}

export interface Media extends SyncFields {
  exerciseKey: string;
  kind: 'photo' | 'video';
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  /** Path in the private Storage bucket once uploaded. */
  storagePath: string | null;
}

/** Local only: the bytes of a Media record. */
export interface BlobRecord {
  id: string;
  blob: Blob;
  uploaded: 0 | 1;
}

export interface MetaRecord {
  key: string;
  value: unknown;
}

export type SyncedTable = 'exercises' | 'days' | 'slots' | 'sessions' | 'setLogs' | 'settings' | 'media';
