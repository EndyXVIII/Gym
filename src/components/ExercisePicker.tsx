import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Plus, Search } from 'lucide-react';
import { loadLibrary } from '../lib/queries';
import { muscleLabel } from '../lib/muscles';
import { Sheet } from './Sheet';
import { ExerciseThumb } from './ExerciseThumb';
import { cx, inputClass, Skeleton } from './ui';

/** Pick a library exercise, or type the name of a new one. */
export function ExercisePicker({
  open,
  onClose,
  title,
  currentKey,
  onPick,
  onCreate,
  hint,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  currentKey?: string;
  onPick: (exerciseKey: string) => void;
  onCreate: (name: string) => void;
  hint?: string;
}) {
  const library = useLiveQuery(loadLibrary, []);
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const list = useMemo(() => {
    if (!library) return [];
    if (!query) return library;
    return library.filter((e) => e.name.toLowerCase().includes(query) || e.primary.some((m) => muscleLabel(m).includes(query)));
  }, [library, query]);
  const exact = library?.some((e) => e.name.toLowerCase() === query);

  const close = () => {
    setQ('');
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} title={title} initialFocus={false}>
      {hint && <p className="mb-3 text-[14px] text-muted">{hint}</p>}
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          aria-label="Cerca o scrivi un nome"
          placeholder="Cerca o scrivi un nome nuovo"
          className={cx(inputClass, 'pl-11')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          enterKeyHint="search"
        />
      </div>
      <ul className="mt-3 flex flex-col gap-1">
        {query && !exact && (
          <li>
            <button
              type="button"
              className="pressable flex min-h-14 w-full items-center gap-3 rounded-2xl border border-dashed border-line px-3 text-left"
              onClick={() => {
                const name = q.trim();
                setQ('');
                onCreate(name);
              }}
            >
              <Plus size={20} className="text-[var(--upper-ink)]" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate text-[16px] font-medium">Nuovo esercizio: «{q.trim()}»</span>
                <span className="block text-[13px] text-muted">Lo aggiungo alla libreria, con uno storico tutto suo</span>
              </span>
            </button>
          </li>
        )}
        {!library && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}
        {list.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              className={cx('pressable flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-left hover:bg-raised', e.key === currentKey && 'bg-raised')}
              onClick={() => {
                setQ('');
                onPick(e.key);
              }}
            >
              <ExerciseThumb exercise={e} size={44} className="rounded-[12px]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-semibold">{e.name}</span>
                <span className="block truncate text-[13px] text-muted">{e.primary.map(muscleLabel).join(', ') || 'muscoli non indicati'}</span>
              </span>
              {e.key === currentKey && <Check size={18} className="shrink-0 text-success-ink" aria-label="attuale" />}
            </button>
          </li>
        ))}
        {library && list.length === 0 && !query && <li className="py-6 text-center text-muted">La libreria è vuota.</li>}
      </ul>
    </Sheet>
  );
}
