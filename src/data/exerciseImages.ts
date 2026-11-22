import type { Confidence } from '../lib/types';

/**
 * Matches between my library exercises and the RepDB free dataset
 * (github.com/sergei-argutin/exercise-dataset, commit f12da45).
 * Keyed by my exercise key; `datasetId` is the dataset record id, `files` are
 * the record's own image paths (images/flat/...), copied into /public/exercises.
 *
 * Low-confidence matches are listed for transparency but not shown:
 * the app draws the muscle map instead.
 *
 * Exercise data by RepDB (repdb.co), used in-app under the RepDB Free Tier License.
 */
export interface ImageMatch {
  datasetId: string;
  datasetName: string;
  confidence: Confidence;
  files: string[];
  why: string;
}

export const IMAGE_MATCHES: Record<string, ImageMatch | null> = {
  'bench-press': { datasetId: 'bench-press', datasetName: 'Barbell Bench Press', confidence: 'high', files: ['bench-press-start.webp', 'bench-press-peak.webp'], why: 'Same lift, barbell, flat bench.' },
  'lat-pulldown': { datasetId: 'lat-pulldown', datasetName: 'Lat Pulldown', confidence: 'high', files: ['lat-pulldown-start.webp', 'lat-pulldown-peak.webp'], why: 'Same exercise, cable.' },
  'chest-supported-row': { datasetId: 'chest-supported-machine-row', datasetName: 'Chest-Supported Machine Row', confidence: 'high', files: ['chest-supported-machine-row-start.webp', 'chest-supported-machine-row-peak.webp'], why: 'Machine row with a chest pad, as in the slot.' },
  'pec-deck': { datasetId: 'pec-deck', datasetName: 'Pec Deck', confidence: 'high', files: ['pec-deck-start.webp', 'pec-deck-peak.webp'], why: 'Same machine.' },
  'cable-lateral-raise': { datasetId: 'cable-lateral-raise', datasetName: 'Cable Lateral Raise', confidence: 'high', files: ['cable-lateral-raise-start.webp', 'cable-lateral-raise-peak.webp'], why: 'Same exercise, one arm on the cable.' },
  'overhead-cable-triceps-extension': { datasetId: 'cable-overhead-tricep-extension', datasetName: 'Cable Overhead Tricep Extension', confidence: 'high', files: ['cable-overhead-tricep-extension-start.webp', 'cable-overhead-tricep-extension-peak.webp'], why: 'Rope overhead extension facing away from the stack.' },
  'bayesian-cable-curl': { datasetId: 'cable-curl', datasetName: 'Cable Curl', confidence: 'low', files: [], why: 'The dataset has no curl with the cable behind the body; a regular cable curl faces the stack, so the muscle map is shown instead.' },
  'hack-squat': { datasetId: 'hack-squat', datasetName: 'Hack Squat', confidence: 'high', files: ['hack-squat-start.webp', 'hack-squat-peak.webp'], why: 'Same machine.' },
  'lying-leg-curl': { datasetId: 'leg-curl', datasetName: 'Lying Leg Curl', confidence: 'high', files: ['leg-curl-start.webp', 'leg-curl-peak.webp'], why: 'Same machine, lying.' },
  'leg-extension': { datasetId: 'leg-extension', datasetName: 'Leg Extension', confidence: 'high', files: ['leg-extension-start.webp', 'leg-extension-peak.webp'], why: 'Same machine.' },
  'hip-abduction-machine': { datasetId: 'hip-abduction', datasetName: 'Machine Hip Abduction', confidence: 'high', files: ['hip-abduction-start.webp', 'hip-abduction-peak.webp'], why: 'Seated abduction machine.' },
  'standing-calf-raise': { datasetId: 'standing-calf-raise', datasetName: 'Standing Calf Raise', confidence: 'high', files: ['standing-calf-raise-start.webp', 'standing-calf-raise-peak.webp'], why: 'Standing calf raise machine.' },
  'reverse-pec-deck': { datasetId: 'machine-reverse-fly', datasetName: 'Machine Reverse Fly', confidence: 'high', files: ['machine-reverse-fly-start.webp', 'machine-reverse-fly-peak.webp'], why: 'The record says "also known as the reverse pec deck".' },
  'cable-crunch': { datasetId: 'cable-crunch', datasetName: 'Cable Crunch', confidence: 'high', files: ['cable-crunch-start.webp', 'cable-crunch-peak.webp'], why: 'Same exercise, kneeling.' },
  'wrist-curl': { datasetId: 'wrist-curl', datasetName: 'Bilateral Dumbbell Wrist Curl', confidence: 'medium', files: ['wrist-curl-start.webp', 'wrist-curl-peak.webp'], why: 'Palms-up wrist curl with dumbbells; the slot also allows a cable.' },
  'wrist-extension': { datasetId: 'db-reverse-wrist-curl', datasetName: 'Dumbbell Reverse Wrist Curl', confidence: 'high', files: ['db-reverse-wrist-curl-start.webp', 'db-reverse-wrist-curl-peak.webp'], why: 'Palms-down wrist curl = wrist extension.' },
  'machine-chest-press': { datasetId: 'chest-press-machine', datasetName: 'Machine Chest Press', confidence: 'high', files: ['chest-press-machine-start.webp', 'chest-press-machine-peak.webp'], why: 'Same machine.' },
  'single-arm-lat-pulldown': { datasetId: 'one-arm-lat-pulldown', datasetName: 'One-Arm Lat Pulldown', confidence: 'high', files: ['one-arm-lat-pulldown-start.webp', 'one-arm-lat-pulldown-peak.webp'], why: 'Same exercise, one handle.' },
  'seated-cable-row': { datasetId: 'seated-cable-row', datasetName: 'Seated Cable Row', confidence: 'high', files: ['seated-cable-row-start.webp', 'seated-cable-row-peak.webp'], why: 'Same exercise; the grip in the picture is not the wide neutral one.' },
  'machine-or-dumbbell-lateral-raise': { datasetId: 'lateral-raise', datasetName: 'Dumbbell Lateral Raise', confidence: 'medium', files: ['lateral-raise-start.webp', 'lateral-raise-peak.webp'], why: 'The dumbbell option of the slot; the dataset has no padded lateral raise machine.' },
  'preacher-curl': { datasetId: 'preacher-curl', datasetName: 'Preacher Curl', confidence: 'high', files: ['preacher-curl-start.webp', 'preacher-curl-peak.webp'], why: 'EZ bar on the preacher bench.' },
  'overhead-triceps-extension': { datasetId: 'overhead-tricep-extension', datasetName: 'Overhead Tricep Extension', confidence: 'medium', files: ['overhead-tricep-extension-start.webp', 'overhead-tricep-extension-peak.webp'], why: 'The single-dumbbell option of the slot (the rope version is the Upper A picture).' },
  'cable-pushdown': { datasetId: 'tricep-pushdown', datasetName: 'Cable Tricep Pushdown', confidence: 'high', files: ['tricep-pushdown-start.webp', 'tricep-pushdown-peak.webp'], why: 'Same exercise.' },
  'romanian-deadlift': { datasetId: 'romanian-deadlift', datasetName: 'Romanian Deadlift', confidence: 'high', files: ['romanian-deadlift-start.webp', 'romanian-deadlift-peak.webp'], why: 'Same lift, barbell.' },
  'leg-press': { datasetId: 'leg-press', datasetName: 'Leg Press', confidence: 'high', files: ['leg-press-start.webp', 'leg-press-peak.webp'], why: 'Same machine.' },
  'hanging-leg-raise': { datasetId: 'hanging-leg-raise', datasetName: 'Hanging Leg Raise', confidence: 'high', files: ['hanging-leg-raise-start.webp', 'hanging-leg-raise-peak.webp'], why: 'Same exercise.' },
  'rope-hammer-curl': { datasetId: 'cable-hammer-curl', datasetName: 'Cable Hammer Curl', confidence: 'high', files: ['cable-hammer-curl-start.webp', 'cable-hammer-curl-peak.webp'], why: 'Cable curl with a rope and a neutral grip.' },
  'incline-dumbbell': { datasetId: 'incline-db-press', datasetName: 'Incline Dumbbell Press', confidence: 'high', files: ['incline-db-press-start.webp', 'incline-db-press-peak.webp'], why: 'Same lift.' },
};

/** Public URL of a copied dataset file. */
export function exerciseImageUrl(file: string): string {
  return `${import.meta.env.BASE_URL}exercises/${file}`;
}

export const REPDB_CREDIT = 'Exercise data by RepDB (repdb.co)';
export const REPDB_URL = 'https://repdb.co';
