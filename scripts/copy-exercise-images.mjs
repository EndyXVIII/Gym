// Copies ONLY the images matched in src/data/exerciseImages.ts from a local
// clone of the RepDB free dataset (github.com/sergei-argutin/exercise-dataset)
// into public/exercises. Never the whole dataset (RepDB Free Tier License, term 3).
//
//   git clone --depth 1 https://github.com/sergei-argutin/exercise-dataset ../exercise-dataset
//   node scripts/copy-exercise-images.mjs ../exercise-dataset
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dataset = path.resolve(process.argv[2] ?? '../exercise-dataset');
const src = fs.readFileSync(path.join(root, 'src/data/exerciseImages.ts'), 'utf8');
const json = JSON.parse(fs.readFileSync(path.join(dataset, 'exercises.json'), 'utf8'));
const records = new Map(json.exercises.map((e) => [e.id, e]));

const out = path.join(root, 'public/exercises');
fs.mkdirSync(out, { recursive: true });

const re = /datasetId: '([^']+)'[^}]*?confidence: '(\w+)', files: \[([^\]]*)\]/g;
let copied = 0;
for (const m of src.matchAll(re)) {
  const [, id, confidence, list] = m;
  const files = [...list.matchAll(/'([^']+)'/g)].map((x) => x[1]);
  if (confidence === 'low' || files.length === 0) continue;
  const rec = records.get(id);
  if (!rec) throw new Error(`No dataset record "${id}"`);
  const paths = Object.values(rec.images.flat);
  for (const f of files) {
    const rel = paths.find((p) => path.basename(p) === f);
    if (!rel) throw new Error(`${f} is not an image of record "${id}" (${paths.join(', ')})`);
    fs.copyFileSync(path.join(dataset, rel), path.join(out, f));
    copied += 1;
  }
}
console.log(`copied ${copied} files to public/exercises`);
