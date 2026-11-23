/**
 * All the program and week logic, as pure functions (no database, no React).
 * Tested in program.test.ts.
 */
import { formatKg, roundToStep } from './format';
import type { ISODate, Session, SetLog, Settings, Slot, SlotKind } from './types';

/** The block is 6 weeks: weeks 1-3 with the first number of sets, weeks 4-6 with the second. */
export const BLOCK_WEEKS = 6;
export const DEFAULT_BLOCK_START: ISODate = '2026-11-16';
export const DEFAULT_LOAD_STEP = 2.5;

/* ------------------------------------------------------------------ dates */

function parts(iso: ISODate): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number);
  return [y, m, d];
}

/** Days from `a` to `b` (b - a), ignoring time zones and DST. */
export function daysBetween(a: ISODate, b: ISODate): number {
  const [ay, am, ad] = parts(a);
  const [by, bm, bd] = parts(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export function addDays(iso: ISODate, n: number): ISODate {
  const [y, m, d] = parts(iso);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Local calendar date of a Date (the phone's time zone). */
export function toISODate(date: Date): ISODate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayISO(now = new Date()): ISODate {
  return toISODate(now);
}

/** 1 = Monday ... 7 = Sunday. */
export function isoWeekday(iso: ISODate): number {
  const [y, m, d] = parts(iso);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

/** The Monday of the week that contains `iso`. */
export function mondayOf(iso: ISODate): ISODate {
  return addDays(iso, 1 - isoWeekday(iso));
}

/** Today if it is a Monday, otherwise the coming Monday. */
export function nextMonday(iso: ISODate): ISODate {
  const wd = isoWeekday(iso);
  return wd === 1 ? iso : addDays(iso, 8 - wd);
}

export const WEEKDAY_NAMES_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** "Monday" -> 1. */
export function weekdayFromName(name: string | null | undefined): number | null {
  if (!name) return null;
  const i = WEEKDAY_NAMES_EN.findIndex((n) => n.toLowerCase() === name.toLowerCase());
  return i >= 0 ? i + 1 : null;
}

/* ------------------------------------------------------------------ weeks */

/** Calendar week of the block: 1 on the start date's week, 2 seven days later... (can be < 1 or > 6). */
export function calendarWeek(blockStart: ISODate, today: ISODate): number {
  return Math.floor(daysBetween(blockStart, today) / 7) + 1;
}

export interface WeekInfo {
  /** The week the app uses for sets, RIR and labels (1..6). */
  week: number;
  /** Week from the calendar, before clamping (can be < 1 or > 6). */
  calendar: number;
  overridden: boolean;
  /** Past week 6 and not overridden: offer "Inizia un nuovo blocco". */
  completed: boolean;
  /** The block starts in the future. */
  notStarted: boolean;
}

export function weekInfo(settings: Pick<Settings, 'blockStartDate' | 'weekOverride'>, today: ISODate): WeekInfo {
  const calendar = calendarWeek(settings.blockStartDate, today);
  const override = settings.weekOverride;
  const overridden = typeof override === 'number' && override >= 1 && override <= BLOCK_WEEKS;
  const week = overridden ? override : Math.min(BLOCK_WEEKS, Math.max(1, calendar));
  return {
    week,
    calendar,
    overridden,
    completed: !overridden && calendar > BLOCK_WEEKS,
    notStarted: !overridden && calendar < 1,
  };
}

/** The date of a given weekday within a given week of the block. */
export function dateInBlock(blockStart: ISODate, week: number, isoWd: number): ISODate {
  return addDays(mondayOf(blockStart), (week - 1) * 7 + (isoWd - 1));
}

/* ------------------------------------------------------------------ sets */

/**
 * Working sets for a slot in a week.
 * Weeks 1-3: first number. Weeks 4-6: second number (first if "serie extra" is off).
 */
export function setsForWeek(sets: readonly [number, number], week: number, extraSets = true): number {
  const [base, from4] = sets;
  if (clampWeek(week) <= 3) return base;
  return extraSets ? from4 : base;
}

export function isSlotHidden(slot: Pick<Slot, 'sets'>, week: number, extraSets = true): boolean {
  return setsForWeek(slot.sets, week, extraSets) === 0;
}

/** True when the Sets column shows an arrow (3 → 4, 0 → 3). */
export function hasExtraSets(sets: readonly [number, number]): boolean {
  return sets[1] !== sets[0];
}

export function formatSetsColumn(sets: readonly [number, number]): string {
  return hasExtraSets(sets) ? `${sets[0]} → ${sets[1]}` : String(sets[0]);
}

function clampWeek(week: number): number {
  return Math.min(BLOCK_WEEKS, Math.max(1, Math.round(week)));
}

/* ------------------------------------------------------------------ ranges and RIR */

export interface Range {
  min: number;
  max: number;
}

/** "6-10" -> {6, 10}; "1" -> {1, 1}; "0–1" (en dash) works too. */
export function parseRange(text: string | null | undefined): Range | null {
  if (!text) return null;
  const m = text.trim().match(/^(\d+)\s*(?:[-–—]\s*(\d+))?$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = m[2] === undefined ? a : Number(m[2]);
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

export function formatRange(r: Range): string {
  return r.min === r.max ? String(r.min) : `${r.min}-${r.max}`;
}

/**
 * Target RIR shown on a card.
 * Week 1: listed + 1 ("0-1" -> "1-2"). Weeks 2-5: as listed.
 * Week 6: 1 for compounds, 0 for isolations.
 */
export function targetRir(rir: string, kind: SlotKind, week: number): string {
  const w = clampWeek(week);
  if (w === 6) return kind === 'compound' ? '1' : '0';
  const r = parseRange(rir);
  if (!r) return rir;
  if (w === 1) return formatRange({ min: r.min + 1, max: r.max + 1 });
  return formatRange(r);
}

export interface WeekRule {
  title: string;
  text: string;
}

/** One line with this week's rule, for the Oggi screen. */
export function weekRule(week: number): WeekRule {
  const w = clampWeek(week);
  if (w === 1) return { title: 'Impara gli esercizi', text: 'Lascia una ripetizione in più in riserva rispetto al RIR indicato.' };
  if (w <= 3) return { title: 'RIR indicato', text: 'Aggiungi ripetizioni, poi carico.' };
  if (w <= 5) return { title: 'Serie extra', text: 'Se recuperi bene, usa il secondo numero dove c’è la freccia (3 → 4, 0 → 3).' };
  return { title: 'Settimana più dura', text: 'Isolamenti a cedimento, multiarticolari a 1 RIR.' };
}

/** The rules of the program sheet, translated, for the "Regole" sheet. */
export const PROGRAM_RULES: { title: string; text: string }[] = [
  { title: 'Intensità', text: 'RIR = ripetizioni in riserva. 0 = non potevi farne un’altra. I multiarticolari si fermano a 1-2 RIR, gli isolamenti arrivano a 0. L’ultima ripetizione deve essere sempre una vera fatica.' },
  { title: 'Progressione', text: 'Parti dal fondo del range di ripetizioni e aggiungi ripetizioni a ogni sessione. Quando tutte le serie arrivano in cima al range, aggiungi il salto di carico più piccolo.' },
  { title: 'Recupero', text: 'Recupero completo sui multiarticolari. Per gli altri esercizi usa il recupero indicato: ogni esercizio ha il suo timer.' },
  { title: 'Riscaldamento', text: '2-3 serie più leggere prima del primo esercizio di ogni gruppo muscolare. Non contano come serie.' },
  { title: 'Range di ripetizioni', text: 'Multiarticolari 6-10, isolamenti 8-12, alzate laterali e deltoidi posteriori 10-15.' },
  { title: 'Settimana 1', text: 'Impara gli esercizi. Lascia una ripetizione in più in riserva rispetto al RIR indicato.' },
  { title: 'Settimane 2-3', text: 'RIR indicato. Aggiungi ripetizioni, poi carico.' },
  { title: 'Settimane 4-5', text: 'Se recuperi bene, passa al secondo numero dove la colonna Serie ha una freccia (3 → 4, 0 → 3): sono le serie extra per schiena, spalle, braccia e avambracci.' },
  { title: 'Settimana 6', text: 'La settimana più dura: isolamenti a cedimento, multiarticolari a 1 RIR.' },
];

/* ------------------------------------------------------------------ order and labels */

export function isSingleArmRest(restText: string | null | undefined): boolean {
  return !!restText && /between arms/i.test(restText);
}

/** Labels follow the order: "1", "2", "3"... (every exercise is done on its own, no supersets). */
export function relabel<T extends Pick<Slot, 'id' | 'position' | 'label'>>(slots: readonly T[]): T[] {
  return [...slots].sort((a, b) => a.position - b.position).map((s, i) => ({ ...s, label: String(i + 1) }));
}

/** After a reorder: positions 1..n in the given order, labels to match. */
export function normalizeOrder<T extends Pick<Slot, 'id' | 'position' | 'label'>>(ordered: readonly T[]): T[] {
  return relabel(ordered.map((s, i) => ({ ...s, position: i + 1 })));
}

/* ------------------------------------------------------------------ history */

export function isWorkingDone(log: SetLog): boolean {
  return !log.deletedAt && !log.isWarmup && log.doneAt !== null;
}

/** Sort key of a session in time: date, then start time. */
export function sessionSortKey(s: Pick<Session, 'date' | 'startedAt' | 'finishedAt'>): string {
  return `${s.date}|${s.startedAt ?? s.finishedAt ?? ''}`;
}

export interface Performance {
  session: Session;
  /** Working sets, in set order. */
  sets: SetLog[];
}

/**
 * "Ultima volta": the most recent session (any day) with working sets of this
 * exercise. Warm-ups and unchecked rows are ignored. If `before` is given, only
 * sessions earlier than it count (used when reopening a past session).
 */
export function lastPerformance(
  exerciseKey: string,
  logs: readonly SetLog[],
  sessions: ReadonlyMap<string, Session> | Record<string, Session>,
  opts: { excludeSessionId?: string; before?: Pick<Session, 'date' | 'startedAt' | 'finishedAt'> } = {},
): Performance | null {
  const get = (id: string): Session | undefined =>
    sessions instanceof Map ? sessions.get(id) : (sessions as Record<string, Session>)[id];
  const bySession = new Map<string, SetLog[]>();
  for (const l of logs) {
    if (l.exerciseKey !== exerciseKey || !isWorkingDone(l)) continue;
    if (opts.excludeSessionId && l.sessionId === opts.excludeSessionId) continue;
    const arr = bySession.get(l.sessionId);
    if (arr) arr.push(l);
    else bySession.set(l.sessionId, [l]);
  }
  const limit = opts.before ? sessionSortKey(opts.before) : null;
  let best: Performance | null = null;
  let bestKey = '';
  for (const [sid, sets] of bySession) {
    const s = get(sid);
    if (!s || s.deletedAt) continue;
    const key = sessionSortKey(s);
    if (limit !== null && key >= limit) continue;
    if (!best || key > bestKey) {
      best = { session: s, sets };
      bestKey = key;
    }
  }
  if (best) best.sets = [...best.sets].sort((a, b) => a.setIndex - b.setIndex || (a.doneAt ?? '').localeCompare(b.doneAt ?? ''));
  return best;
}

/** Text of the "Ultima volta" line: the top set ("70 kg × 6"), raw reps for week 1 entries. */
export function performanceLabel(p: Performance): { weightKg: number | null; reps: string } {
  const top = topSet(p.sets);
  if (!top) return { weightKg: null, reps: '' };
  return { weightKg: top.weightKg, reps: displayReps(top) };
}

/** Reps as shown in history: raw "6/7" for week 1 summaries, the number otherwise. */
export function displayReps(log: Pick<SetLog, 'reps' | 'rawText' | 'isSummary'>): string {
  if (log.isSummary && log.rawText) {
    const m = log.rawText.match(/x\s*(.+)$/i);
    if (m) return m[1].trim();
  }
  return log.reps === null ? '—' : String(log.reps);
}

/** Prefill for working set `index` (0-based) from last time. */
export function prefillFor(p: Performance | null, index: number): { weightKg: number | null; reps: number | null } {
  if (!p || p.sets.length === 0) return { weightKg: null, reps: null };
  const s = p.sets[Math.min(index, p.sets.length - 1)];
  return { weightKg: s.weightKg, reps: s.reps };
}

/** Heaviest set; ties go to more reps. */
export function topSet<T extends Pick<SetLog, 'weightKg' | 'reps'>>(sets: readonly T[]): T | null {
  let best: T | null = null;
  for (const s of sets) {
    if (!best || compareSets(s, best) > 0) best = s;
  }
  return best;
}

/** >0 if a beats b: more weight, or more reps at the same weight. */
export function compareSets(a: Pick<SetLog, 'weightKg' | 'reps'>, b: Pick<SetLog, 'weightKg' | 'reps'>): number {
  const aw = a.weightKg ?? 0;
  const bw = b.weightKg ?? 0;
  if (aw !== bw) return aw - bw;
  return (a.reps ?? 0) - (b.reps ?? 0);
}

export interface ProgressionHint {
  kind: 'load' | 'reps' | 'first';
  weightKg: number | null;
  reps: number | null;
  text: string;
}

/**
 * Never forced. If every working set of the last session reached the top of the
 * range: last load + one load step (start again at the bottom of the range).
 * Otherwise: one more rep than last time at the same load.
 */
export function progressionHint(last: Performance | null, range: Range, loadStepKg: number): ProgressionHint {
  if (!last || last.sets.length === 0) {
    return { kind: 'first', weightKg: null, reps: range.min, text: `Prima volta: scegli un carico per ${range.min}-${range.max} rip.` };
  }
  const top = topSet(last.sets)!;
  const load = top.weightKg;
  const allTop = last.sets.every((s) => (s.reps ?? 0) >= range.max);
  if (allTop && load !== null) {
    const next = roundToStep(load + loadStepKg, 0.5);
    return {
      kind: 'load',
      weightKg: next,
      reps: range.min,
      text: `Aumenta: ${formatKg(next)} kg (+${formatKg(loadStepKg)}), riparti da ${range.min} rip.`,
    };
  }
  const reps = (top.reps ?? range.min - 1) + 1;
  return {
    kind: 'reps',
    weightKg: load,
    reps,
    text: load === null ? `Obiettivo: ${reps} rip.` : `Obiettivo: ${formatKg(load)} kg × ${reps} (una rip. in più)`,
  };
}

/**
 * Ids of working sets that beat every earlier working set of the same exercise
 * (more weight, or more reps at the same weight). The very first set is not a PR.
 */
export function personalRecords(
  logs: readonly SetLog[],
  sessions: ReadonlyMap<string, Session> | Record<string, Session>,
): Set<string> {
  const get = (id: string): Session | undefined =>
    sessions instanceof Map ? sessions.get(id) : (sessions as Record<string, Session>)[id];
  const rows = logs
    .filter((l) => isWorkingDone(l) && l.weightKg !== null)
    .map((l) => ({ l, s: get(l.sessionId) }))
    .filter((x): x is { l: SetLog; s: Session } => !!x.s && !x.s.deletedAt)
    .sort(
      (a, b) =>
        sessionSortKey(a.s).localeCompare(sessionSortKey(b.s)) ||
        (a.l.doneAt ?? '').localeCompare(b.l.doneAt ?? '') ||
        a.l.setIndex - b.l.setIndex,
    );
  const best = new Map<string, SetLog>();
  const prs = new Set<string>();
  for (const { l } of rows) {
    const prev = best.get(l.exerciseKey);
    if (!prev) {
      best.set(l.exerciseKey, l);
      continue;
    }
    if (compareSets(l, prev) > 0) {
      prs.add(l.id);
      best.set(l.exerciseKey, l);
    }
  }
  return prs;
}

/** Sum of weight × reps over working sets (warm-ups never count). */
export function volumeKg(logs: readonly SetLog[]): number {
  let v = 0;
  for (const l of logs) if (isWorkingDone(l) && l.weightKg !== null && l.reps !== null) v += l.weightKg * l.reps;
  return v;
}

export function workingSetCount(logs: readonly SetLog[]): number {
  return logs.filter(isWorkingDone).length;
}

/* ------------------------------------------------------------------ day summary */

export interface DayPlanSummary {
  exercises: number;
  sets: number;
}

export function dayPlanSummary(slots: readonly Slot[], week: number, extraSets: boolean): DayPlanSummary {
  let exercises = 0;
  let sets = 0;
  for (const s of slots) {
    if (s.deletedAt) continue;
    const n = setsForWeek(s.sets, week, extraSets);
    if (n > 0) {
      exercises += 1;
      sets += n;
    }
  }
  return { exercises, sets };
}
