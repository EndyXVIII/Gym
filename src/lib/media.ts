/**
 * My own photo or short video for an exercise. Stored privately: the bytes in
 * IndexedDB (and in a private Supabase Storage bucket when signed in), the
 * metadata as a synced Media record.
 */
import { db } from './db';
import { newId } from './ids';
import { action, notifyLocalChange, nowISO } from './repo';
import type { Exercise, Media } from './types';

export const MAX_PHOTO_PX = 1200;
export const MAX_VIDEO_BYTES = 60 * 1024 * 1024;

export class MediaError extends Error {}

/** Resizes a photo so the long side is at most 1200 px (JPEG, quality 0.85). */
export async function shrinkPhoto(file: Blob, maxPx = MAX_PHOTO_PX): Promise<{ blob: Blob; width: number; height: number }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  } catch {
    throw new MediaError('Non riesco a leggere questa immagine.');
  }
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new MediaError('Il browser non può ridimensionare la foto.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new MediaError('Non riesco a salvare la foto.');
  return { blob, width, height };
}

/** Sets a photo or video as the exercise's picture (replacing the previous one). */
export async function setExerciseMedia(exercise: Exercise, file: File): Promise<Media> {
  const isVideo = file.type.startsWith('video/');
  let blob: Blob = file;
  let width: number | null = null;
  let height: number | null = null;
  if (isVideo) {
    if (file.size > MAX_VIDEO_BYTES) throw new MediaError('Il video è troppo grande (massimo 60 MB): accorcialo e riprova.');
  } else {
    const shrunk = await shrinkPhoto(file);
    blob = shrunk.blob;
    width = shrunk.width;
    height = shrunk.height;
  }
  const media: Media = {
    id: newId(),
    exerciseKey: exercise.key,
    kind: isVideo ? 'video' : 'photo',
    mime: isVideo ? file.type || 'video/mp4' : 'image/jpeg',
    size: blob.size,
    width,
    height,
    storagePath: null,
    updatedAt: nowISO(),
    deletedAt: null,
  };
  await db.blobs.put({ id: media.id, blob, uploaded: 0 });
  await action('Foto dell’esercizio', async (w) => {
    if (exercise.photoId) await w.remove('media', exercise.photoId);
    await w.put('media', media);
    await w.patch<Exercise>('exercises', exercise.id, { photoId: media.id, preferMuscleMap: false });
  });
  notifyLocalChange();
  return media;
}

export async function removeExerciseMedia(exercise: Exercise): Promise<void> {
  if (!exercise.photoId) return;
  const id = exercise.photoId;
  await action('Foto rimossa', async (w) => {
    await w.remove('media', id);
    await w.patch<Exercise>('exercises', exercise.id, { photoId: null });
  });
}

/** The bytes of a media record, if they are on this device. */
export async function getMediaBlob(id: string): Promise<Blob | null> {
  return (await db.blobs.get(id))?.blob ?? null;
}
