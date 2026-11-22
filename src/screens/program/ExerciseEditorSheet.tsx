import { useEffect, useState, type ReactNode } from 'react';
import { useSettings } from '../../app/SettingsContext';
import { updateExercise } from '../../lib/programOps';
import { ALL_MUSCLES, EQUIPMENT_LABELS, muscleLabel } from '../../lib/muscles';
import { formatKg } from '../../lib/format';
import type { Exercise, MuscleKey } from '../../lib/types';
import { Sheet } from '../../components/Sheet';
import { cx, Field, inputClass } from '../../components/ui';

const STEPS = [0.5, 1, 1.25, 2, 2.5, 5];

/** Library exercise: name, equipment, muscles, load step (and, in the media section, its picture). */
export function ExerciseEditorSheet({ open, onClose, exercise, children }: { open: boolean; onClose: () => void; exercise: Exercise | undefined; children?: ReactNode }) {
  const settings = useSettings();
  const [name, setName] = useState(exercise?.name ?? '');
  useEffect(() => setName(exercise?.name ?? ''), [exercise?.name, open]);
  if (!exercise) return null;

  const toggle = (list: 'primary' | 'secondary', m: MuscleKey) => {
    const other = list === 'primary' ? 'secondary' : 'primary';
    const has = exercise[list].includes(m);
    const next = has ? exercise[list].filter((x) => x !== m) : [...exercise[list], m];
    void updateExercise(exercise.id, { [list]: next, [other]: exercise[other].filter((x) => x !== m) });
  };

  return (
    <Sheet open={open} onClose={onClose} title="Esercizio in libreria">
      <div className="flex flex-col gap-4 pb-2">
        <Field label="Nome" htmlFor="ex-name" hint="Vale per tutti i giorni che usano questo esercizio.">
          <input id="ex-name" lang="en" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== exercise.name && void updateExercise(exercise.id, { name: name.trim() })} />
        </Field>
        <Field label="Attrezzo" htmlFor="ex-eq">
          <select id="ex-eq" className={inputClass} value={exercise.equipment} onChange={(e) => void updateExercise(exercise.id, { equipment: e.target.value })}>
            {[...new Set([...Object.keys(EQUIPMENT_LABELS), exercise.equipment])].map((k) => (
              <option key={k} value={k}>
                {EQUIPMENT_LABELS[k] ?? k}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Scatto di carico (pulsanti − e +)" htmlFor="ex-step">
          <select
            id="ex-step"
            className={inputClass}
            value={exercise.loadStepKg ?? ''}
            onChange={(e) => void updateExercise(exercise.id, { loadStepKg: e.target.value === '' ? null : Number(e.target.value) })}
          >
            <option value="">Predefinito ({formatKg(settings.defaultLoadStepKg)} kg)</option>
            {STEPS.map((s) => (
              <option key={s} value={s}>
                {formatKg(s)} kg
              </option>
            ))}
          </select>
        </Field>
        <MusclePicker label="Muscoli principali" selected={exercise.primary} onToggle={(m) => toggle('primary', m)} tone="accent" />
        <MusclePicker label="Muscoli secondari" selected={exercise.secondary} onToggle={(m) => toggle('secondary', m)} tone="muted" />
        {children}
      </div>
    </Sheet>
  );
}

function MusclePicker({ label, selected, onToggle, tone }: { label: string; selected: MuscleKey[]; onToggle: (m: MuscleKey) => void; tone: 'accent' | 'muted' }) {
  return (
    <fieldset>
      <legend className="mb-1.5 px-1 text-[13px] font-medium text-muted">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {ALL_MUSCLES.map((m) => {
          const on = selected.includes(m);
          return (
            <button
              key={m}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(m)}
              className={cx(
                'pressable min-h-10 rounded-full border px-3 text-[14px]',
                on
                  ? tone === 'accent'
                    ? 'border-transparent bg-[var(--upper)] font-semibold text-on-accent'
                    : 'border-transparent bg-[color-mix(in_srgb,var(--upper)_30%,var(--raised))] font-semibold text-ink'
                  : 'border-line bg-raised text-muted',
              )}
            >
              {muscleLabel(m)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
