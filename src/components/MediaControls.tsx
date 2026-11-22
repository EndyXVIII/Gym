import { useRef, useState } from 'react';
import { Camera, ImageOff, Map as MapIcon, Trash2 } from 'lucide-react';
import { MediaError, removeExerciseMedia, setExerciseMedia } from '../lib/media';
import { updateExercise } from '../lib/programOps';
import type { Exercise } from '../lib/types';
import { Button } from './ui';
import { toast } from './Toast';

/** Replace the picture with my own photo or short video (camera or library), or go back. */
export function MediaControls({ exercise }: { exercise: Exercise }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      await setExerciseMedia(exercise, file);
      toast.show(file.type.startsWith('video/') ? 'Video salvato' : 'Foto salvata', { tone: 'success' });
    } catch (e) {
      toast.show(e instanceof MediaError ? e.message : 'Non sono riuscito a salvare il file.', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="px-1 text-[13px] font-medium text-muted">Immagine</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" icon={<Camera size={18} aria-hidden />} disabled={busy} onClick={() => input.current?.click()}>
          {exercise.photoId ? 'Cambia foto' : 'Mia foto/video'}
        </Button>
        {exercise.photoId ? (
          <Button variant="secondary" icon={<Trash2 size={18} aria-hidden />} onClick={() => void removeExerciseMedia(exercise)}>
            Togli foto
          </Button>
        ) : (
          <Button
            variant="secondary"
            icon={exercise.preferMuscleMap ? <ImageOff size={18} aria-hidden /> : <MapIcon size={18} aria-hidden />}
            disabled={!exercise.image}
            onClick={() => void updateExercise(exercise.id, { preferMuscleMap: !exercise.preferMuscleMap })}
          >
            {exercise.preferMuscleMap ? 'Illustrazione' : 'Mappa muscoli'}
          </Button>
        )}
      </div>
      <p className="px-1 text-[12px] text-muted">Le foto vengono ridotte a 1200 px e restano private: sul telefono e nel tuo spazio Supabase.</p>
      <input
        ref={input}
        type="file"
        accept="image/*,video/*"
        className="sr-only"
        aria-label="Scegli una foto o un video"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
