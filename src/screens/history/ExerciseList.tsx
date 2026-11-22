import { EmptyState } from '../../components/ui';

/** History by exercise (step 3). */
export function ExerciseList() {
  return (
    <div className="px-4">
      <EmptyState title="In arrivo" text="Lo storico per esercizio arriva nel prossimo passo." />
    </div>
  );
}
