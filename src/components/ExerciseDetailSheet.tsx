import type { ReactNode } from 'react';
import { ExternalLink, StickyNote } from 'lucide-react';
import { equipmentLabel, muscleLabel } from '../lib/muscles';
import { formatKg } from '../lib/format';
import type { Exercise, Slot } from '../lib/types';
import { Sheet } from './Sheet';
import { Chip } from './ui';

/** Exercise detail: the note from my sheet, the "Guarda" button, muscles, image controls. */
export function ExerciseDetailSheet({
  open,
  onClose,
  exercise,
  slot,
  loadStep,
  children,
  media,
}: {
  open: boolean;
  onClose: () => void;
  exercise: Exercise | undefined;
  slot: Slot | null;
  loadStep: number;
  children?: ReactNode;
  media?: ReactNode;
}) {
  const title = slot && slot.exerciseKey === exercise?.key ? slot.name : (exercise?.name ?? slot?.name ?? 'Esercizio');
  const demo = slot && slot.exerciseKey === exercise?.key ? slot.demo : `https://www.youtube.com/results?search_query=${encodeURIComponent(`${exercise?.name ?? ''} proper form`)}`;
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {media && <div className="mb-4">{media}</div>}
      {slot?.note && slot.exerciseKey === exercise?.key && (
        <div className="mb-4 flex gap-3 rounded-2xl bg-raised p-3">
          <StickyNote size={18} className="mt-0.5 shrink-0 text-muted" aria-hidden />
          <p className="text-[15px] leading-relaxed" lang="en">
            {slot.note}
          </p>
        </div>
      )}
      <a
        href={demo}
        target="_blank"
        rel="noopener noreferrer"
        className="pressable flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-[17px] font-semibold text-on-accent"
      >
        <ExternalLink size={20} aria-hidden /> Guarda
      </a>
      <p className="mt-1.5 text-center text-[12px] text-muted">Apre una ricerca su YouTube in una nuova scheda</p>

      {exercise && (
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3">
          <div className="col-span-2">
            <dt className="mb-1.5 text-[13px] font-medium text-muted">Muscoli principali</dt>
            <dd className="flex flex-wrap gap-1.5">
              {exercise.primary.length ? exercise.primary.map((m) => <Chip key={m} tone="accent">{muscleLabel(m)}</Chip>) : <span className="text-muted">non indicati</span>}
            </dd>
          </div>
          {exercise.secondary.length > 0 && (
            <div className="col-span-2">
              <dt className="mb-1.5 text-[13px] font-medium text-muted">Secondari</dt>
              <dd className="flex flex-wrap gap-1.5">
                {exercise.secondary.map((m) => (
                  <Chip key={m} tone="muted">
                    {muscleLabel(m)}
                  </Chip>
                ))}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-[13px] font-medium text-muted">Attrezzo</dt>
            <dd className="text-[15px]">{equipmentLabel(exercise.equipment)}</dd>
          </div>
          <div>
            <dt className="text-[13px] font-medium text-muted">Scatto di carico</dt>
            <dd className="text-[15px] tnum">{formatKg(loadStep)} kg</dd>
          </div>
        </dl>
      )}
      {children}
    </Sheet>
  );
}
