import { Dumbbell } from 'lucide-react';
import { exerciseImageUrl } from '../data/exerciseImages';
import { muscleGroup } from '../lib/muscles';
import type { Exercise } from '../lib/types';
import { useResolvedMedia } from './ExerciseMedia';
import { cx } from './ui';

const GROUP_VAR = { push: '--push', pull: '--pull', legs: '--legs', core: '--core' } as const;

function Fallback({ exercise, size }: { exercise: Exercise | undefined; size: number }) {
  const g = GROUP_VAR[muscleGroup(exercise?.primary[0] ?? 'chest')];
  return (
    <span
      aria-hidden
      className="flex h-full w-full items-center justify-center"
      style={{ background: `linear-gradient(135deg, color-mix(in srgb, var(${g}) 85%, white), var(${g}))`, color: 'var(--on-accent)' }}
    >
      <Dumbbell size={Math.round(size * 0.46)} />
    </span>
  );
}

function OwnThumb({ exercise, size }: { exercise: Exercise; size: number }) {
  const media = useResolvedMedia(exercise);
  if (media.kind === 'photo') return <img src={media.url} alt="" className="h-full w-full object-cover" />;
  if (media.kind === 'dataset') return <img src={media.poses[0]} alt="" loading="lazy" decoding="async" className="dark-dim h-full w-full object-cover" />;
  return <Fallback exercise={exercise} size={size} />;
}

/** Small square picture of an exercise: my photo, the illustration, or a coloured tile. */
export function ExerciseThumb({ exercise, size = 52, className }: { exercise: Exercise | undefined; size?: number; className?: string }) {
  const showOwn = !!exercise?.photoId;
  const poses = exercise?.image && !exercise.preferMuscleMap ? exercise.image.poses : [];
  return (
    <span
      className={cx('relative inline-block shrink-0 overflow-hidden rounded-[16px] border border-[color-mix(in_srgb,var(--text)_10%,transparent)] bg-raised', className)}
      style={{ width: size, height: size }}
    >
      {showOwn && exercise ? (
        <OwnThumb exercise={exercise} size={size} />
      ) : poses.length ? (
        <img src={exerciseImageUrl(poses[0])} alt="" loading="lazy" decoding="async" width={size} height={size} className="dark-dim h-full w-full object-cover" />
      ) : (
        <Fallback exercise={exercise} size={size} />
      )}
    </span>
  );
}
