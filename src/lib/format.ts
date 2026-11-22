import type { ISODate } from './types';

/** 0.5 kg precision everywhere. */
export function roundHalf(kg: number): number {
  return Math.round(kg * 2) / 2;
}

/** Rounds to the nearest multiple of `step`, then to 0.5 kg. */
export function roundToStep(kg: number, step: number): number {
  if (!step || step <= 0) return roundHalf(kg);
  return roundHalf(Math.round(kg / step) * step);
}

/**
 * Parses a weight as typed on an Italian keyboard: "22,5", "22.5", " 80 ".
 * Returns null for empty or invalid input. Rounds to 0.5 kg.
 */
export function parseWeight(input: string): number | null {
  const s = input.trim().replace(/\s+/g, '').replace(',', '.');
  if (s === '') return null;
  if (!/^\d{0,4}(\.\d*)?$/.test(s) || s === '.') return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 2000) return null;
  return roundHalf(n);
}

/** Parses reps as typed. "6/7" -> 6 (the first number). */
export function parseReps(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return Number.isFinite(input) && input >= 0 ? Math.round(input) : null;
  const m = input.trim().match(/^(\d{1,3})/);
  if (!m) return null;
  return Number(m[1]);
}

/** Only keeps characters that can be part of a weight while typing. */
export function sanitizeWeightTyping(input: string): string {
  let s = input.replace(/[^\d.,]/g, '');
  const sep = s.search(/[.,]/);
  if (sep >= 0) s = s.slice(0, sep + 1) + s.slice(sep + 1).replace(/[.,]/g, '');
  return s.slice(0, 6);
}

export function sanitizeRepsTyping(input: string): string {
  return input.replace(/\D/g, '').slice(0, 3);
}

/** 22.5 -> "22,5"; 20 -> "20". */
export function formatKg(kg: number | null | undefined): string {
  if (kg === null || kg === undefined || !Number.isFinite(kg)) return '';
  const r = roundHalf(kg);
  return Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ',');
}

export function formatVolume(kg: number): string {
  return Math.round(kg).toLocaleString('it-IT');
}

/** "20 kg × 10" (or "45 kg × 6/7" for a raw week 1 entry). */
export function formatSet(weightKg: number | null, reps: number | string | null, withUnit = true): string {
  const w = weightKg === null ? '—' : `${formatKg(weightKg)}${withUnit ? ' kg' : ''}`;
  const r = reps === null || reps === '' ? '—' : String(reps);
  return `${w} × ${r}`;
}

export function formatSeconds(total: number): string {
  const s = Math.max(0, Math.round(total));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** Rest for chips: 180 -> "3 min", 150 -> "2:30", 90 -> "1:30", 45 -> "45 s". */
export function formatRest(seconds: number): string {
  if (seconds <= 0) return '0';
  if (seconds < 60) return `${seconds} s`;
  if (seconds % 60 === 0) return `${seconds / 60} min`;
  return formatSeconds(seconds);
}

export const WEEKDAYS_IT = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
export const WEEKDAYS_SHORT_IT = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
const MONTHS_IT = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const MONTHS_SHORT_IT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

/** ISO weekday 1..7 -> "lunedì". */
export function weekdayName(isoWeekday: number | null): string {
  if (!isoWeekday) return 'nessun giorno';
  return WEEKDAYS_IT[(isoWeekday - 1) % 7];
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "2026-11-23" -> "lunedì 23 novembre". */
export function formatDateLong(iso: ISODate): string {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const isoWd = wd === 0 ? 7 : wd;
  return `${WEEKDAYS_IT[isoWd - 1]} ${d} ${MONTHS_IT[m - 1]}`;
}

/** "2026-11-23" -> "23 nov". */
export function formatDateShort(iso: ISODate): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_SHORT_IT[m - 1]}`;
}

/** "2026-11-23" -> "23 nov 2026". */
export function formatDateWithYear(iso: ISODate): string {
  const [y] = iso.split('-');
  return `${formatDateShort(iso)} ${y}`;
}

export function formatDuration(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${String(min % 60).padStart(2, '0')} min`;
}

export function greeting(hour: number): string {
  if (hour < 5) return 'Buonanotte';
  if (hour < 13) return 'Buongiorno';
  if (hour < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
