import { prefillFor, type Performance } from './program';
import type { SetLog } from './types';

export interface SetRowModel {
  /** Stable React key: the log id, or "v:<index>" for a planned row not stored yet. */
  key: string;
  /** null = planned row, prefilled, not stored until I edit or check it. */
  log: SetLog | null;
  setIndex: number;
  isWarmup: boolean;
  /** 1-based number among working sets; null for warm-ups. */
  workingNumber: number | null;
  weightKg: number | null;
  reps: number | null;
  done: boolean;
}

/**
 * Rows of one exercise in a session: the stored logs (sorted by setIndex) plus
 * planned rows until the working sets reach the planned count. Planned rows
 * take last time's values (set i from last time's set i), or the bottom of the
 * rep range when there is no history.
 */
export function buildRows(logs: readonly SetLog[], planned: number, last: Performance | null, repsMin: number): SetRowModel[] {
  const live = logs.filter((l) => !l.deletedAt).sort((a, b) => a.setIndex - b.setIndex || a.id.localeCompare(b.id));
  const working = live.filter((l) => !l.isWarmup).length;
  const missing = Math.max(0, planned - working);
  const nextIndex = live.length ? Math.max(...live.map((l) => l.setIndex)) + 1 : 0;

  const rows: SetRowModel[] = live.map((l) => ({
    key: l.id,
    log: l,
    setIndex: l.setIndex,
    isWarmup: l.isWarmup,
    workingNumber: null,
    weightKg: l.weightKg,
    reps: l.reps,
    done: l.doneAt !== null,
  }));
  for (let i = 0; i < missing; i++) {
    rows.push({
      key: `v:${nextIndex + i}`,
      log: null,
      setIndex: nextIndex + i,
      isWarmup: false,
      workingNumber: null,
      weightKg: null,
      reps: null,
      done: false,
    });
  }
  let n = 0;
  for (const r of rows) {
    if (r.isWarmup) continue;
    const pre = prefillFor(last, n);
    n += 1;
    r.workingNumber = n;
    if (!r.log) {
      r.weightKg = pre.weightKg;
      r.reps = pre.reps ?? (last ? null : repsMin);
    }
  }
  return rows;
}

/** Index for a new warm-up row: before every other row. */
export function warmupIndex(rows: readonly SetRowModel[]): number {
  return rows.length ? Math.min(...rows.map((r) => r.setIndex)) - 1 : -1;
}

/** Index for "Aggiungi serie": after every other row. */
export function appendIndex(rows: readonly SetRowModel[]): number {
  return rows.length ? Math.max(...rows.map((r) => r.setIndex)) + 1 : 0;
}

export function allWorkingDone(rows: readonly SetRowModel[]): boolean {
  const working = rows.filter((r) => !r.isWarmup);
  return working.length > 0 && working.every((r) => r.done);
}
