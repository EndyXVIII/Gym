import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, X } from 'lucide-react';
import { REPDB_CREDIT, REPDB_URL } from '../data/exerciseImages';
import type { Exercise } from '../lib/types';
import type { ResolvedMedia } from './ExerciseMedia';
import { MuscleMap } from './MuscleMap';
import { cx, IconButton } from './ui';

const POSE_NAMES = ['Posizione iniziale', 'Posizione finale'];

/** Full-screen picture. Swipe (or use the dots) between the start and peak poses. */
export function MediaViewer({ open, onClose, media, exercise, name, bg }: { open: boolean; onClose: () => void; media: ResolvedMedia; exercise: Exercise | undefined; name: string; bg: string | null }) {
  const scroller = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const [index, setIndex] = useState(0);
  const poses = media.kind === 'dataset' ? media.poses : [];

  useEffect(() => {
    if (!open) return;
    setIndex(0);
    const prev = document.activeElement as HTMLElement | null;
    document.documentElement.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => closeBtn.current?.focus());
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = '';
      prev?.focus?.({ preventScroll: true });
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (dir: number) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth, behavior: 'smooth' });
  };

  if (!open) return null;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={name} className="anim-fade fixed inset-0 z-[80] flex flex-col bg-[rgb(4_6_9/0.96)] text-white">
      <div className="flex items-center gap-2 px-2 pt-[max(env(safe-area-inset-top),8px)]">
        <p className="min-w-0 flex-1 truncate px-2 text-[17px] font-semibold">{name}</p>
        <IconButton ref={closeBtn} label="Chiudi" onClick={onClose} className="text-white hover:bg-white/10">
          <X size={26} aria-hidden />
        </IconButton>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center">
        {media.kind === 'dataset' ? (
          <>
            <div
              ref={scroller}
              className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
              onScroll={(e) => {
                const el = e.currentTarget;
                setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
              }}
            >
              {poses.map((src, i) => (
                <figure key={src} className="flex w-full shrink-0 snap-center flex-col items-center px-4">
                  <div className="dark-dim w-full max-w-[min(92vw,70dvh)] overflow-hidden rounded-[22px]" style={bg ? { backgroundColor: bg } : undefined}>
                    <img src={src} alt={`${name}: ${poses.length > 1 ? POSE_NAMES[i] : 'posizione'}`} width={512} height={512} className="block h-auto w-full" draggable={false} />
                  </div>
                  <figcaption className="mt-3 text-[14px] text-white/70">{poses.length > 1 ? POSE_NAMES[i] : 'Posizione'}</figcaption>
                </figure>
              ))}
            </div>
            {poses.length > 1 && (
              <div className="mt-2 flex justify-center gap-2" role="tablist" aria-label="Pose">
                {poses.map((p, i) => (
                  <button
                    key={p}
                    type="button"
                    role="tab"
                    aria-selected={i === index}
                    aria-label={POSE_NAMES[i]}
                    onClick={() => go(i - index)}
                    className="flex h-11 w-11 items-center justify-center"
                  >
                    <span className={cx('h-2 rounded-full transition-all duration-200', i === index ? 'w-6 bg-white' : 'w-2 bg-white/40')} />
                  </button>
                ))}
              </div>
            )}
            <p className="mt-3 px-6 text-center text-[13px] text-white/70">
              <a href={REPDB_URL} target="_blank" rel="nofollow noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
                {REPDB_CREDIT} <ExternalLink size={12} aria-hidden />
              </a>
            </p>
          </>
        ) : media.kind === 'photo' ? (
          <img src={media.url} alt={`Foto di ${name}`} className="mx-auto max-h-[80dvh] max-w-full rounded-[22px] object-contain px-4" />
        ) : media.kind === 'video' ? (
          <video src={media.url} className="mx-auto max-h-[80dvh] max-w-full rounded-[22px] px-4" controls playsInline autoPlay muted loop />
        ) : (
          <div className="mx-auto aspect-[16/12] w-full max-w-[560px] px-4">
            <div className="h-full rounded-[22px] bg-surface p-4" style={{ color: 'var(--text)' }}>
              <MuscleMap primary={exercise?.primary ?? []} secondary={exercise?.secondary ?? []} />
            </div>
          </div>
        )}
      </div>
      <div className="h-[max(env(safe-area-inset-bottom),16px)]" />
    </div>,
    document.body,
  );
}
