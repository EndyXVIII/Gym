import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Expand } from 'lucide-react';
import { db } from '../lib/db';
import { useInView, usePrefersReducedMotion } from '../lib/hooks';
import { exerciseImageUrl } from '../data/exerciseImages';
import type { Exercise } from '../lib/types';
import { MuscleMap } from './MuscleMap';
import { MediaViewer } from './MediaViewer';
import { cx } from './ui';

export type ResolvedMedia =
  | { kind: 'photo' | 'video'; url: string; mime: string }
  | { kind: 'dataset'; poses: string[]; datasetId: string }
  | { kind: 'map' };

/** Own photo/video > matched illustration > muscle map. Never a broken image. */
export function useResolvedMedia(exercise: Exercise | undefined): ResolvedMedia {
  const photoId = exercise?.photoId ?? null;
  const own = useLiveQuery(async () => {
    if (!photoId) return null;
    const [rec, blob] = await Promise.all([db.media.get(photoId), db.blobs.get(photoId)]);
    if (!rec || rec.deletedAt || !blob) return null;
    return { blob: blob.blob, kind: rec.kind, mime: rec.mime };
  }, [photoId]);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!own) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(own.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [own]);

  if (own && url) return { kind: own.kind, url, mime: own.mime };
  if (exercise?.image && !exercise.preferMuscleMap && exercise.image.poses.length) {
    return { kind: 'dataset', poses: exercise.image.poses.map(exerciseImageUrl), datasetId: exercise.image.datasetId };
  }
  return { kind: 'map' };
}

/** Background colour of a solid-background illustration (its corner pixel), cached per URL. */
const bgCache = new Map<string, string>();
function sampleBackground(img: HTMLImageElement): string | null {
  const cached = bgCache.get(img.src);
  if (cached) return cached;
  try {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 4;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, 4, 4, 0, 0, 4, 4);
    const [r, g, b] = ctx.getImageData(1, 1, 1, 1).data;
    const color = `rgb(${r} ${g} ${b})`;
    bgCache.set(img.src, color);
    return color;
  } catch {
    return null;
  }
}

/**
 * The picture at the top of an exercise card: 16:10, rounded frame.
 * Two poses crossfade every 1.2 s while on screen (static with reduced motion).
 * Tap for full screen.
 */
export function ExerciseMedia({ exercise, name, className }: { exercise: Exercise | undefined; name: string; className?: string }) {
  const media = useResolvedMedia(exercise);
  const [broken, setBroken] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const inView = useInView(ref, '80px');
  const reduced = usePrefersReducedMotion();
  const [pose, setPose] = useState(0);
  const [bg, setBg] = useState<string | null>(null);

  const poses = media.kind === 'dataset' ? media.poses : [];
  const animate = poses.length > 1 && inView && !reduced && !open;
  useEffect(() => {
    if (!animate) {
      if (reduced) setPose(0);
      return;
    }
    const id = window.setInterval(() => setPose((p) => (p + 1) % poses.length), 1200);
    return () => window.clearInterval(id);
  }, [animate, poses.length, reduced]);
  useEffect(() => setBroken(false), [exercise?.image?.datasetId, exercise?.photoId]);

  const showMap = media.kind === 'map' || (media.kind === 'dataset' && broken);
  const label =
    media.kind === 'photo' ? `Foto di ${name}` : media.kind === 'video' ? `Video di ${name}` : showMap ? `Muscoli di ${name}` : `Illustrazione di ${name}`;

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${label}: apri a schermo intero`}
        className={cx('group relative block aspect-[16/10] w-full overflow-hidden rounded-[22px] border border-line bg-raised', !showMap && media.kind === 'dataset' && 'dark-dim', className)}
        style={bg && !showMap ? { backgroundColor: bg } : undefined}
      >
        {showMap && exercise && <MuscleMap primary={exercise.primary} secondary={exercise.secondary} className="p-2" />}
        {showMap && !exercise && <MuscleMap primary={[]} secondary={[]} className="p-2" showLegend={false} />}
        {media.kind === 'dataset' &&
          !broken &&
          poses.map((src, i) => (
            <img
              key={src}
              src={src}
              alt=""
              width={512}
              height={512}
              loading="lazy"
              decoding="async"
              draggable={false}
              onLoad={(e) => i === 0 && setBg(sampleBackground(e.currentTarget))}
              onError={() => setBroken(true)}
              className={cx(
                'absolute inset-0 m-auto h-full w-auto object-contain transition-opacity duration-500 ease-in-out',
                i === pose ? 'opacity-100' : 'opacity-0',
              )}
            />
          ))}
        {media.kind === 'photo' && <img src={media.url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        {media.kind === 'video' && <video src={media.url} className="absolute inset-0 h-full w-full object-cover" muted loop playsInline autoPlay={!reduced} preload="metadata" aria-hidden />}
        {poses.length > 1 && !broken && (
          <span className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5" aria-hidden>
            {poses.map((p, i) => (
              <span key={p} className={cx('h-1.5 rounded-full transition-all duration-300', i === pose ? 'w-4 bg-[rgb(0_0_0/0.55)]' : 'w-1.5 bg-[rgb(0_0_0/0.25)]')} />
            ))}
          </span>
        )}
        <span className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(0_0_0/0.35)] text-white opacity-80" aria-hidden>
          <Expand size={15} />
        </span>
      </button>
      <MediaViewer open={open} onClose={() => setOpen(false)} media={showMap ? { kind: 'map' } : media} exercise={exercise} name={name} bg={bg} />
    </>
  );
}
