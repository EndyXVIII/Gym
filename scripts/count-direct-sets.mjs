// Counts the DIRECT sets per muscle (the exercise's primary muscles) in the program, per week,
// plus the sets per day and per week. Optionally compares with an earlier version of the
// program and checks the rules of a change.
//
//   node scripts/count-direct-sets.mjs                       the program in src/data/seed.json
//   node scripts/count-direct-sets.mjs --before old.json     before/after tables + rule checks
//   git show HEAD:src/data/seed.json > /tmp/before.json      (a way to get the "before" file)
//   node scripts/count-direct-sets.mjs --json                machine-readable (used by the tests)
//
// "Direct" = sets of exercises that list the muscle as PRIMARY. An exercise with two primary
// muscles (the rows: upper back + lats) counts for both. Sets: weeks 1-3 use the first number of
// `sets`, weeks 4-6 the second (the "serie extra" column, shown with an arrow in the sheet).
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const afterPath = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--before') ?? path.join(root, 'src/data/seed.json');
const beforePath = value('--before');

export const BLOCK_WEEKS = 6;

const MUSCLE_IT = {
  chest: 'petto', lats: 'dorsali', 'upper-back': 'alto schiena', 'lower-back': 'lombari', 'front-delts': 'deltoidi anteriori',
  'side-delts': 'deltoidi laterali', 'rear-delts': 'deltoidi posteriori', biceps: 'bicipiti', triceps: 'tricipiti', forearms: 'avambracci',
  'forearm-flexors': 'flessori avambraccio', 'forearm-extensors': 'estensori avambraccio', quads: 'quadricipiti', hamstrings: 'femorali',
  glutes: 'glutei', 'glute-medius': 'gluteo medio', calves: 'polpacci', abs: 'addominali',
};

/** The goals of this change (direct sets per week from week 4). Every other muscle must stay as it was. */
const TARGETS = { triceps: 12, 'side-delts': 13, lats: 16, 'upper-back': 8, biceps: 12 };
const MAX_PER_EXERCISE = 2;
const MAX_PER_DAY = 5;

export function analyse(seed) {
  const primary = Object.fromEntries(seed.library.map((e) => [e.key, e.primary]));
  const slots = [];
  for (const d of seed.days) for (const s of d.exercises) slots.push({ id: `${d.key}:${s.label}`, day: d.key, type: d.type, title: d.title, exerciseKey: s.exerciseKey, name: s.name, sets: s.sets, reps: s.reps, rir: s.rir, restSeconds: s.restSeconds, wk1: s.wk1 ?? null });
  const muscles = {};
  const add = (period, muscle, n) => {
    muscles[muscle] ??= { early: 0, late: 0, byDay: {} };
    muscles[muscle][period] += n;
  };
  for (const s of slots) {
    for (const m of primary[s.exerciseKey] ?? []) {
      add('early', m, s.sets[0]);
      add('late', m, s.sets[1]);
      muscles[m].byDay[s.day] ??= { early: 0, late: 0 };
      muscles[m].byDay[s.day].early += s.sets[0];
      muscles[m].byDay[s.day].late += s.sets[1];
    }
  }
  const days = {};
  for (const d of seed.days) {
    const own = slots.filter((s) => s.day === d.key);
    days[d.key] = {
      title: d.title,
      type: d.type,
      exercisesEarly: own.filter((s) => s.sets[0] > 0).length,
      exercisesLate: own.filter((s) => s.sets[1] > 0).length,
      early: own.reduce((n, s) => n + s.sets[0], 0),
      late: own.reduce((n, s) => n + s.sets[1], 0),
    };
  }
  const weeks = Array.from({ length: BLOCK_WEEKS }, (_, i) => {
    const week = i + 1;
    const key = week <= 3 ? 'early' : 'late';
    return { week, total: Object.values(days).reduce((n, d) => n + d[key], 0), byDay: Object.fromEntries(Object.entries(days).map(([k, d]) => [k, d[key]])) };
  });
  return { slots, muscles, days, weeks };
}

/** Rule checks of the change: before -> after. Returns a list of {rule, ok, detail}. */
export function check(before, after) {
  const out = [];
  const rule = (name, ok, detail = '') => out.push({ rule: name, ok, detail });
  const b = new Map(before.slots.map((s) => [s.id, s]));
  const a = new Map(after.slots.map((s) => [s.id, s]));
  rule('Stessi esercizi (nessuno aggiunto o tolto)', b.size === a.size && [...b.keys()].every((k) => a.has(k) && a.get(k).exerciseKey === b.get(k).exerciseKey));
  const changed = [...a.values()].filter((s) => s.sets[0] !== b.get(s.id)?.sets[0] || s.sets[1] !== b.get(s.id)?.sets[1]);
  rule('Settimane 1-3 invariate (primo numero di ogni esercizio)', [...a.values()].every((s) => s.sets[0] === b.get(s.id)?.sets[0]));
  rule('Giorni lower invariati', changed.every((s) => s.type === 'upper'), changed.filter((s) => s.type !== 'upper').map((s) => s.id).join(', '));
  rule('Solo aumenti', changed.every((s) => s.sets[1] > b.get(s.id).sets[1]));
  const biggest = Math.max(0, ...changed.map((s) => s.sets[1] - b.get(s.id).sets[1]));
  rule(`Al massimo +${MAX_PER_EXERCISE} serie per esercizio`, biggest <= MAX_PER_EXERCISE, `massimo trovato: +${biggest}`);
  const perDay = {};
  for (const s of changed) perDay[s.day] = (perDay[s.day] ?? 0) + (s.sets[1] - b.get(s.id).sets[1]);
  rule(`Al massimo +${MAX_PER_DAY} serie per seduta`, Object.values(perDay).every((n) => n <= MAX_PER_DAY), Object.entries(perDay).map(([k, n]) => `${k} +${n}`).join(', '));
  rule('Ripetizioni, RIR e recuperi invariati', [...a.values()].every((s) => s.reps === b.get(s.id).reps && s.rir === b.get(s.id).rir && s.restSeconds === b.get(s.id).restSeconds));
  rule('Numeri della settimana 1 invariati', [...a.values()].every((s) => JSON.stringify(s.wk1) === JSON.stringify(b.get(s.id).wk1)));
  for (const [m, target] of Object.entries(TARGETS)) rule(`${MUSCLE_IT[m]}: ${before.muscles[m]?.late ?? 0} -> ${target}`, (after.muscles[m]?.late ?? 0) === target, `dopo: ${after.muscles[m]?.late ?? 0}`);
  const others = Object.keys({ ...before.muscles, ...after.muscles }).filter((m) => !(m in TARGETS));
  rule('Gli altri muscoli restano uguali (settimane 1-3 e dalla 4)', others.every((m) => (before.muscles[m]?.late ?? 0) === (after.muscles[m]?.late ?? 0) && (before.muscles[m]?.early ?? 0) === (after.muscles[m]?.early ?? 0)), others.filter((m) => (before.muscles[m]?.late ?? 0) !== (after.muscles[m]?.late ?? 0)).join(', '));
  const upper = Object.values(after.days).filter((d) => d.type === 'upper');
  rule('Ogni muscolo-obiettivo resta allenato in entrambi i giorni upper', Object.keys(TARGETS).every((m) => upper.every((d) => (after.muscles[m]?.byDay[Object.keys(after.days).find((k) => after.days[k] === d)]?.late ?? 0) > 0)));
  return out;
}

const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map((_, i) => (i === 0 ? '---' : '---:')).join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
const sign = (n) => (n > 0 ? `+${n}` : n < 0 ? `${n}` : '0');

if (import.meta.url === `file://${process.argv[1]}`) {
  const after = analyse(JSON.parse(fs.readFileSync(afterPath, 'utf8')));
  const before = beforePath ? analyse(JSON.parse(fs.readFileSync(beforePath, 'utf8'))) : null;
  if (flag('--json')) {
    console.log(JSON.stringify({ after, before, checks: before ? check(before, after) : null }, null, 1));
    process.exit(0);
  }
  const keys = Object.keys({ ...(before?.muscles ?? {}), ...after.muscles }).sort((x, y) => (after.muscles[y]?.late ?? 0) - (after.muscles[x]?.late ?? 0) || x.localeCompare(y));
  console.log('Serie dirette per muscolo, a settimana\n');
  if (before) {
    console.log(table(['Muscolo', 'Sett. 1-3 prima', 'Sett. 1-3 dopo', 'Dalla sett. 4 prima', 'Dalla sett. 4 dopo', 'Differenza', 'Obiettivo'], keys.map((m) => [MUSCLE_IT[m], before.muscles[m]?.early ?? 0, after.muscles[m]?.early ?? 0, before.muscles[m]?.late ?? 0, `**${after.muscles[m]?.late ?? 0}**`, sign((after.muscles[m]?.late ?? 0) - (before.muscles[m]?.late ?? 0)), TARGETS[m] ?? '—'])));
  } else {
    console.log(table(['Muscolo', 'Sett. 1-3', 'Dalla sett. 4'], keys.map((m) => [MUSCLE_IT[m], after.muscles[m].early, after.muscles[m].late])));
  }
  console.log('\nSerie per giorno\n');
  console.log(table(['Giorno', 'Esercizi sett. 1-3', 'Serie sett. 1-3', ...(before ? ['Serie sett. 1-3 prima'] : []), 'Esercizi dalla 4', 'Serie dalla 4', ...(before ? ['Serie dalla 4 prima', 'Differenza'] : [])], Object.entries(after.days).map(([k, d]) => [d.title, d.exercisesEarly, d.early, ...(before ? [before.days[k].early] : []), d.exercisesLate, `**${d.late}**`, ...(before ? [before.days[k].late, sign(d.late - before.days[k].late)] : [])])));
  console.log('\nSerie per settimana (tutti e 4 i giorni)\n');
  console.log(table(['Settimana', ...Object.values(after.days).map((d) => d.title), 'Totale', ...(before ? ['Totale prima'] : [])], after.weeks.map((w, i) => [`Sett. ${w.week}`, ...Object.values(w.byDay), `**${w.total}**`, ...(before ? [before.weeks[i].total] : [])])));
  if (before) {
    console.log('\nDistribuzione dei muscoli-obiettivo tra i giorni (serie dirette dalla sett. 4, dopo)\n');
    const dayKeys = Object.keys(after.days);
    console.log(table(['Muscolo', ...dayKeys.map((k) => after.days[k].title), 'Totale'], Object.keys(TARGETS).map((m) => [MUSCLE_IT[m], ...dayKeys.map((k) => after.muscles[m].byDay[k]?.late ?? 0), `**${after.muscles[m].late}**`])));
    console.log('\nCosa è cambiato, esercizio per esercizio (dalla sett. 4)\n');
    const rows = after.slots.filter((s) => s.sets[1] !== before.slots.find((x) => x.id === s.id).sets[1]).map((s) => { const o = before.slots.find((x) => x.id === s.id); return [s.title, s.name.replace(/\s*\(.*$/, ''), `${o.sets[0]} → ${o.sets[1]}`, `${s.sets[0]} → ${s.sets[1]}`, sign(s.sets[1] - o.sets[1])]; });
    console.log(table(['Giorno', 'Esercizio', 'Serie prima', 'Serie dopo', 'Differenza'], rows));
    console.log('\nControllo delle regole\n');
    const results = check(before, after);
    for (const r of results) console.log(`${r.ok ? 'OK  ' : 'ERR '} ${r.rule}${r.detail ? `  (${r.detail})` : ''}`);
    if (results.some((r) => !r.ok)) process.exitCode = 1;
  }
}
