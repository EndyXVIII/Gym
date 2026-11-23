// Acceptance checks from the spec, run in Chromium at 390 x 844 against the
// production build, with a fake Supabase (auth, REST and storage) in memory.
//
//   VITE_SUPABASE_URL=https://test.supabase.co VITE_SUPABASE_ANON_KEY=test npm run build
//   npx vite preview --port 4173 &
//   node e2e/acceptance.mjs            (needs Playwright: npm i -D playwright && npx playwright install chromium)
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('Playwright is missing: npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const SUPABASE = 'https://test.supabase.co';
const UID = '11111111-1111-4111-8111-111111111111';
const EMAIL = 'me@example.com';
const results = [];
const errors = [];

function ok(name, cond, detail = '') {
  results.push({ name, ok: !!cond, detail });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

/* ------------------------------------------------------------------ fake Supabase */
const server = { tables: new Map(), files: new Map(), clock: Date.parse('2026-11-23T08:00:00Z'), online: true, otpSent: 0 };
const tableOf = (n) => server.tables.get(n) ?? server.tables.set(n, new Map()).get(n);

function jwt() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, email: EMAIL, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 * 24 * 365 })}.sig`;
}

async function fakeSupabase(route) {
  const req = route.request();
  const url = new URL(req.url());
  const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  if (!server.online) return route.abort('internetdisconnected');
  if (url.pathname === '/auth/v1/otp') {
    server.otpSent += 1;
    return json(200, {});
  }
  if (url.pathname === '/auth/v1/verify') {
    const body = req.postDataJSON();
    if (body.token !== '123456') return json(403, { code: 'otp_expired', msg: 'Token has expired or is invalid' });
    const now = Math.floor(Date.now() / 1000);
    return json(200, {
      access_token: jwt(),
      token_type: 'bearer',
      expires_in: 3600 * 24 * 365,
      expires_at: now + 3600 * 24 * 365,
      refresh_token: 'refresh',
      user: { id: UID, aud: 'authenticated', role: 'authenticated', email: EMAIL, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
    });
  }
  if (url.pathname === '/auth/v1/user') return json(200, { id: UID, aud: 'authenticated', role: 'authenticated', email: EMAIL, app_metadata: {}, user_metadata: {} });
  if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
  const rest = url.pathname.match(/^\/rest\/v1\/(\w+)$/);
  if (rest) {
    const t = tableOf(rest[1]);
    if (req.method() === 'POST') {
      for (const r of req.postDataJSON()) {
        const old = t.get(r.id);
        if (old && Date.parse(r.updated_at) < Date.parse(old.updated_at)) continue; // last write wins
        server.clock += 1;
        t.set(r.id, { ...r, server_updated_at: new Date(server.clock).toISOString() });
      }
      return route.fulfill({ status: 201, body: '' });
    }
    if (req.method() === 'GET') {
      const gt = url.searchParams.get('server_updated_at')?.replace(/^gt\./, '');
      const limit = Number(url.searchParams.get('limit') ?? 1000);
      const rows = [...t.values()]
        .filter((r) => !gt || Date.parse(r.server_updated_at) > Date.parse(gt))
        .sort((a, b) => a.server_updated_at.localeCompare(b.server_updated_at))
        .slice(0, limit);
      return json(200, rows);
    }
  }
  if (url.pathname.startsWith('/storage/v1/object/')) {
    const path = url.pathname.replace(/^\/storage\/v1\/object\/(authenticated\/)?media\//, '');
    if (req.method() === 'POST' || req.method() === 'PUT') {
      server.files.set(path, req.postDataBuffer());
      return json(200, { Key: `media/${path}` });
    }
    if (req.method() === 'GET') return server.files.has(path) ? route.fulfill({ status: 200, body: server.files.get(path) }) : json(404, { error: 'not found' });
    if (req.method() === 'DELETE') return json(200, []);
  }
  return json(404, { message: `not mocked: ${req.method()} ${url.pathname}` });
}

/* ------------------------------------------------------------------ helpers */
const browser = await chromium.launch();

async function newPage(date, { serviceWorkers = 'block', signedIn = false } = {}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    colorScheme: 'dark',
    serviceWorkers,
  });
  await context.route(`${SUPABASE}/**`, fakeSupabase);
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${date}: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`${date}: ${e.message}`));
  await page.clock.install({ time: new Date(date) });
  if (!signedIn) await context.addInitScript(() => localStorage.setItem('scheda:auth-skip', '1'));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  return { context, page };
}

async function lastTimeOf(page, name) {
  const card = page.getByRole('article', { name: new RegExp(`^${name}`) });
  await card.scrollIntoViewIfNeeded();
  return (await card.getByText(/^Ultima volta:/).innerText()).replace(/\s+/g, ' ').trim();
}

async function startDay(page, title) {
  const btn = page.getByRole('button', { name: 'Inizia', exact: true });
  if (await btn.count()) await btn.first().click();
  else {
    await page.getByRole('button', { name: new RegExp(`^${title}`) }).first().click();
    await page.getByRole('button', { name: `Inizia ${title}` }).click();
  }
  await page.waitForURL(/\/sessione\//);
  await page.waitForTimeout(400);
}

/* ------------------------------------------------------------------ 1. weeks and Monday */
{
  const { context, page } = await newPage('2026-11-22T10:00:00+01:00');
  ok('1a. Sunday 22 November shows week 1', await page.getByText('Settimana 1 di 6').isVisible());
  await context.close();
}
{
  const { context, page } = await newPage('2026-11-23T08:30:00+01:00');
  ok('1b. Monday 23 November shows week 2', await page.getByText('Settimana 2 di 6').isVisible());
  ok('1c. Monday offers Upper A', await page.getByRole('region', { name: /Allenamento di oggi: Upper A/ }).isVisible());
  await startDay(page, 'Upper A');
  const bench = await lastTimeOf(page, 'Bench press');
  const lat = await lastTimeOf(page, 'Lat pulldown');
  ok('1d. Bench press: Ultima volta 20 kg x 10', bench.includes('20 kg × 10'), bench);
  ok('1e. Lat pulldown: Ultima volta 70 kg x 6', lat.includes('70 kg × 6'), lat);

  /* 2. Upper A logged completely with one thumb: every set is one tap on the check */
  const checks = page.getByRole('button', { name: /^Segna serie \d+ come fatta/ });
  let taps = 0;
  while ((await checks.count()) > 0) {
    const b = checks.first();
    await b.scrollIntoViewIfNeeded();
    await b.click();
    taps += 1;
    await page.waitForTimeout(60);
  }
  ok('2a. All 22 sets of Upper A checked with one tap each', taps === 22, `${taps} taps`);
  const timer = await page.getByRole('timer').getAttribute('aria-label').catch(() => null);
  ok('2b. Rest timer running after the last set', !!timer && timer.startsWith('Recupero'), timer ?? 'none');
  await page.getByRole('button', { name: 'Termina allenamento' }).click();
  const summary = await page.getByRole('dialog', { name: 'Termina allenamento' }).innerText();
  ok('2c. Finish summary counts 22 sets', /Serie fatte\s*22/.test(summary.replace(/\n/g, ' ').replace(/\s+/g, ' ')) || summary.includes('22'), summary.split('\n').slice(0, 6).join(' / '));
  // The summary shows the muscles of this workout on the body map.
  const dlg = page.getByRole('dialog', { name: 'Termina allenamento' });
  const mapLabel = await dlg.getByRole('img', { name: /^Mappa muscolare/ }).first().getAttribute('aria-label');
  ok('9a. The summary has the muscle map with the trained muscles', !!mapLabel && /petto/.test(mapLabel) && /dorsali/.test(mapLabel) && /bicipiti/.test(mapLabel) && !/quadricipiti/.test(mapLabel), mapLabel?.slice(0, 80));
  const listText = (await dlg.getByRole('list', { name: 'Serie per muscolo' }).first().innerText()).replace(/\s+/g, ' ');
  ok('9b. The summary lists serie per muscle (petto 6 = 3 bench + 3 pec deck)', /petto 6/.test(listText), listText.slice(0, 90));
  await dlg.getByRole('radio', { name: 'Settimana' }).click();
  await page.waitForTimeout(400);
  const weekText = (await dlg.innerText()).replace(/\s+/g, ' ');
  ok('9c. The summary can switch to the whole week', /Settimana 2: 1 allenamento, 22 serie/.test(weekText), weekText.match(/Settimana 2: [^·]*/)?.[0]);
  await dlg.getByRole('radio', { name: 'Questo allenamento' }).click();
  await page.getByRole('button', { name: 'Salva allenamento' }).click();
  await page.waitForURL(BASE + '/');
  const week = await page
    .waitForFunction(() => document.querySelector('#week-sessions')?.textContent?.includes('1/4'), null, { timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  ok('2d. Back on Oggi with 1/4 sessions this week', week);
  // Oggi shows the week's muscles; the Storico tab has the week navigator.
  const mini = await page.getByRole('img', { name: /Mappa dei muscoli allenati questa settimana/ }).count();
  ok('9d. Oggi shows the muscle map of the week', mini === 1);
  await page.getByRole('button', { name: /Muscoli della settimana: apri la mappa/ }).click();
  await page.waitForURL(/\/storico/);
  await page.waitForTimeout(500);
  const wk2 = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  ok('9e. Storico > Muscoli opens on week 2 with its numbers', /Settimana 2/.test(wk2) && /1 allenamento · 22 serie/.test(wk2) && /petto 6/.test(wk2) && /\+2/.test(wk2), wk2.match(/Settimana 2.{0,60}/)?.[0]);
  await page.getByRole('radio', { name: /^Settimana 1/ }).click();
  await page.waitForTimeout(500);
  const wk1 = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  ok('9f. Week 1 (from my seed numbers) shows quadricipiti 4 and petto 4', /quadricipiti 4/.test(wk1) && /petto 4/.test(wk1), wk1.match(/quadricipiti.{0,12}/)?.[0]);
  await context.close();
}

/* ------------------------------------------------------------------ 1/3. Tuesday and Friday */
{
  const { context, page } = await newPage('2026-11-24T18:00:00+01:00');
  await startDay(page, 'Lower A');
  const hack = await lastTimeOf(page, 'Hack squat');
  const rpd = await lastTimeOf(page, 'Reverse pec deck');
  const le = await lastTimeOf(page, 'Leg extension');
  ok('1f. Tuesday: Hack squat 45 kg x 6', hack.includes('45 kg × 6'), hack);
  ok('3a. Tuesday: Reverse pec deck 40 kg x 10', rpd.includes('40 kg × 10'), rpd);
  ok('3b. Tuesday: Leg extension 85 kg x 10 (Friday entry)', le.includes('85 kg × 10'), le);
  ok('4a. [0, 3] slot hidden in week 2 (Wrist extension on Lower A)', (await page.getByRole('article', { name: /^Wrist extension/ }).count()) === 0);
  await context.close();
}
{
  const { context, page } = await newPage('2026-11-27T18:00:00+01:00');
  await startDay(page, 'Lower B');
  const clr = await lastTimeOf(page, 'Cable lateral raise');
  ok('3c. Friday: Cable lateral raise 30 kg x 10', clr.includes('30 kg × 10'), clr);
  await context.close();
}

/* ------------------------------------------------------------------ 4. a 6-week block, no deload, more serie from week 4 */
const heroText = async (page, title) => (await page.getByRole('region', { name: new RegExp(`Allenamento di oggi: ${title}`) }).innerText()).replace(/\s+/g, ' ');
{
  // Monday of week 3: serie as in the first weeks.
  const { context, page } = await newPage('2026-11-30T08:30:00+01:00');
  ok('4a. Week 3: Upper A has 7 exercises and 22 serie', /7 esercizi/.test(await heroText(page, 'Upper A')) && /22 serie/.test(await heroText(page, 'Upper A')), (await heroText(page, 'Upper A')).slice(0, 80));
  await startDay(page, 'Upper A');
  ok('4a2. Week 3: overhead cable triceps still 4 serie', (await page.getByRole('article', { name: /^Overhead cable triceps/ }).innerText()).includes('4 × 8-12'));
  await context.close();
}
{
  // Monday of week 4: +4 serie on Upper A, the new numbers on the exercises.
  const { context, page } = await newPage('2026-12-07T08:30:00+01:00');
  const hero = await heroText(page, 'Upper A');
  ok('4b. Week 4: Upper A has 29 serie (was 25)', /7 esercizi/.test(hero) && /29 serie/.test(hero), hero.slice(0, 80));
  await startDay(page, 'Upper A');
  const chips = async (name) => (await page.getByRole('article', { name }).innerText()).replace(/\s+/g, ' ');
  ok('4c. Week 4: overhead cable triceps 6 serie (was 4)', (await chips(/^Overhead cable triceps/)).includes('6 × 8-12'));
  ok('4d. Week 4: cable lateral raise 5 serie, chest-supported row 4 serie', (await chips(/^Cable lateral raise/)).includes('5 × 10-15') && (await chips(/^Chest-supported row/)).includes('4 × 6-10'));
  ok('4d2. Week 4: same reps, RIR and rest on the added serie', (await chips(/^Overhead cable triceps/)).includes('RIR 0-1') && (await chips(/^Overhead cable triceps/)).includes('Recupero 1:30'));
  await context.close();
}
{
  // Thursday of week 4: Upper B has 30 serie (was 26).
  const { context, page } = await newPage('2026-12-10T08:30:00+01:00');
  const hero = await heroText(page, 'Upper B');
  ok('4e. Week 4: Upper B has 30 serie (was 26)', /8 esercizi/.test(hero) && /30 serie/.test(hero), hero.slice(0, 80));
  await context.close();
}
{
  // Tuesday of week 4: the lower days are as before.
  const { context, page } = await newPage('2026-12-08T18:00:00+01:00');
  ok('4f1. Week 4: Lower A still 9 exercises and 29 serie', /9 esercizi/.test(await heroText(page, 'Lower A')) && /29 serie/.test(await heroText(page, 'Lower A')));
  await startDay(page, 'Lower A');
  ok('4f. Week 4: Wrist extension appears with 3 sets', (await page.getByRole('article', { name: /^Wrist extension/ }).innerText()).includes('3 × 10-15'));
  await context.close();
}
{
  // Week 6 is the last one: no deload badge, no half sets, RIR as for week 6.
  const { context, page } = await newPage('2026-12-21T08:30:00+01:00');
  ok('4g. Monday 21 December is "Settimana 6 di 6"', await page.getByText('Settimana 6 di 6').isVisible());
  const body = (await page.locator('body').innerText()).toLowerCase();
  ok('4h. No "scarico" anywhere in week 6', !body.includes('scarico'));
  await startDay(page, 'Upper A');
  const bench = (await page.getByRole('article', { name: /^Bench press/ }).innerText()).replace(/\s+/g, ' ');
  const lat = (await page.getByRole('article', { name: /^Lat pulldown/ }).innerText()).replace(/\s+/g, ' ');
  ok('4i. Week 6: bench 3 serie at RIR 1, lat pulldown 4 serie', bench.includes('3 × 6-10') && bench.includes('RIR 1') && lat.includes('4 × 6-10'), `${bench.slice(0, 60)} | ${lat.slice(0, 60)}`);
  await context.close();
}
{
  // After week 6 the block is complete.
  const { context, page } = await newPage('2026-12-28T08:30:00+01:00');
  ok('4j. After week 6: the card "Blocco completato" is there', await page.getByRole('region', { name: 'Blocco completato' }).isVisible());
  ok('4k. It says 6 settimane fatte', (await page.getByRole('region', { name: 'Blocco completato' }).innerText()).toLowerCase().includes('6 settimane fatte'));
  ok('4l. Progress shows week 6 of 6, no week 7', await page.getByText('Settimana 6 di 6').isVisible() && !(await page.locator('body').innerText()).includes('Settimana 7'));
  await page.getByRole('button', { name: 'Inizia un nuovo blocco' }).click();
  await page.waitForTimeout(600);
  ok('4m. "Inizia un nuovo blocco" starts again from week 1', await page.getByText('Settimana 1 di 6').isVisible());
  await context.close();
}
{
  // The grid and the muscle tab have 6 weeks.
  const { context, page } = await newPage('2026-11-24T09:00:00+01:00');
  await page.goto(`${BASE}/storico`, { waitUntil: 'networkidle' });
  await page.getByRole('radio', { name: 'Griglia' }).click();
  const headers = (await page.locator('table').first().locator('thead th').allInnerTexts()).map((t) => t.trim());
  ok('4n. The history grid has 6 week columns (Sett. 1-6)', headers.length === 7 && headers[6] === 'Sett. 6' && !headers.join(' ').includes('Scarico'), headers.join(' | '));
  await page.getByRole('radio', { name: 'Muscoli' }).click();
  await page.getByRole('radiogroup', { name: 'Settimana' }).waitFor();
  const chipsCount = await page.getByRole('radiogroup', { name: 'Settimana' }).getByRole('radio').count();
  ok('4o. The muscle tab has 6 week buttons', chipsCount === 6, String(chipsCount));
  await page.goto(`${BASE}/impostazioni`, { waitUntil: 'networkidle' });
  const opts = await page.getByLabel('Settimana corrente').locator('option').allInnerTexts();
  ok('4p. Settings: automatic + weeks 1-6, no week 7', opts.length === 7 && !opts.join(' ').includes('7') && (await page.locator('main').innerText()).toLowerCase().includes('blocco di 6 settimane'), opts.join(' | '));
  await context.close();
}
{
  // A device that already has the program (old sets, migration not done yet) gets the new numbers.
  const { context, page } = await newPage('2026-12-07T08:30:00+01:00');
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('scheda');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(['slots', 'meta'], 'readwrite');
          const store = tx.objectStore('slots');
          store.getAll().onsuccess = (e) => {
            for (const s of e.target.result) {
              if (s.exerciseKey === 'overhead-cable-triceps-extension') store.put({ ...s, sets: [4, 4] });
              if (s.exerciseKey === 'chest-supported-row') store.put({ ...s, sets: [3, 3] });
            }
          };
          tx.objectStore('meta').delete('migrations');
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const hero = await heroText(page, 'Upper A');
  ok('4q. An old device is updated at start: Upper A has 29 serie in week 4', /29 serie/.test(hero), hero.slice(0, 80));
  await context.close();
}

/* ------------------------------------------------------------------ 5. swap keeps history */
{
  const { context, page } = await newPage('2026-11-24T09:00:00+01:00');
  await page.goto(`${BASE}/programma/upper-a`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^1 Bench press/ }).click();
  await page.getByRole('button', { name: 'Sostituisci', exact: true }).click();
  await page.getByRole('searchbox').fill('Smith machine press');
  await page.getByRole('button', { name: /Nuovo esercizio: «Smith machine press»/ }).click();
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  ok('5a. Slot 1 now uses the new exercise', (await page.locator('ol li').first().innerText()).includes('Smith machine press'));
  await page.goto(`${BASE}/storico/esercizio/bench-press`, { waitUntil: 'networkidle' });
  ok('5b. Bench press history is still there', (await page.locator('main').innerText()).includes('20 × 10'));
  await context.close();
}

/* ------------------------------------------------------------------ 6. offline, reload, sync */
{
  const { context, page } = await newPage('2026-11-23T09:00:00+01:00', { serviceWorkers: 'allow', signedIn: true });
  await page.waitForURL(/\/accedi/);
  ok('6a. First launch asks to sign in', true);
  await page.getByRole('textbox', { name: 'Email' }).fill(EMAIL);
  await page.getByRole('button', { name: 'Invia il codice' }).click();
  await page.getByRole('textbox', { name: 'Codice' }).fill('123456');
  await page.waitForURL(BASE + '/');
  ok('6b. Signed in with the 6-digit code', server.otpSent === 1);
  await page.waitForTimeout(1500);
  ok('6c. First sync pushed the program', (server.tables.get('slots')?.size ?? 0) === 33, `${server.tables.get('slots')?.size ?? 0} slots on the server`);
  // Make sure the service worker controls the page, then go offline.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'networkidle' });
  await context.setOffline(true);
  server.online = false;
  await startDay(page, 'Upper A');
  await page.getByRole('button', { name: /^Segna serie 1 come fatta/ }).first().click();
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(800);
  const done = await page.getByRole('button', { name: /fatta: tocca per riaprirla/ }).count();
  ok('6d. Offline: the set is still there after a reload', done === 1, `${done} done set(s)`);
  ok('6e. Offline: the dot says offline', ((await page.getByRole('status', { name: /Sincronizzazione/ }).first().getAttribute('aria-label')) ?? '').includes('Offline'));
  await context.setOffline(false);
  server.online = true;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(2500);
  const remote = [...(server.tables.get('set_logs')?.values() ?? [])].filter((r) => r.data.doneAt && !r.data.isSummary);
  ok('6f. Back online: the set reached the server', remote.length === 1 && remote[0].data.weightKg === 20, `${remote.length} new set(s) on the server`);
  await context.close();
}

/* ------------------------------------------------------------------ 8. no supersets, old data is migrated */
{
  const { context, page } = await newPage('2026-11-23T09:00:00+01:00');
  // Make this device look like an old one: pairs with a/b labels and no rest on the "a".
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('scheda');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('slots', 'readwrite');
          const store = tx.objectStore('slots');
          store.getAll().onsuccess = (e) => {
            for (const s of e.target.result) {
              if (s.dayKey !== 'upper-a') continue;
              if (s.exerciseKey === 'overhead-cable-triceps-extension') store.put({ ...s, label: '6a', superset: { group: 'upper-a:6', role: 'a' }, restSeconds: 0 });
              if (s.exerciseKey === 'bayesian-cable-curl') store.put({ ...s, label: '6b', superset: { group: 'upper-a:6', role: 'b' } });
            }
          };
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.goto(`${BASE}/programma/upper-a`, { waitUntil: 'networkidle' });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const rows = (await page.locator('ol li').allInnerTexts()).map((t) => t.replace(/\s+/g, ' '));
  ok('8a. Old a/b labels become 6 and 7 after the update', rows.length === 7 && /^6 .*Overhead cable triceps/.test(rows[5]) && /^7 .*Bayesian/.test(rows[6]), `${rows[5]?.slice(0, 40)} | ${rows[6]?.slice(0, 40)}`);
  ok('8b. The old "a" exercise now has a rest (1:30), not "subito la b"', /1:30/.test(rows[5]) && !/subito/.test(rows[5]), rows[5]?.slice(-40));
  const bodyProgram = (await page.locator('body').innerText()).toLowerCase();
  ok('8c. Programma never says "superserie"', !bodyProgram.includes('superserie') && !bodyProgram.includes('poi subito'));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Inizia', exact: true }).click();
  await page.waitForURL(/\/sessione\//);
  await page.waitForTimeout(500);
  const bodySession = (await page.locator('body').innerText()).toLowerCase();
  ok('8d. The session never says "superserie" or "poi subito la b"', !bodySession.includes('superserie') && !bodySession.includes('poi subito'));
  // checking a set of the former "a" exercise starts its own rest timer (it was 0 before)
  const card = page.getByRole('article', { name: /^Overhead cable triceps/ });
  await card.scrollIntoViewIfNeeded();
  await card.getByRole('button', { name: /^Segna serie 1 come fatta/ }).click();
  await page.waitForTimeout(300);
  const timer = await page.getByRole('timer').getAttribute('aria-label');
  ok('8e. The former "a" exercise starts a 1:30 rest by itself', timer === 'Recupero: 1:30', timer ?? 'no timer');
  await context.close();
}

/* ------------------------------------------------------------------ 7. grid */
{
  const { context, page } = await newPage('2026-11-24T09:00:00+01:00');
  await page.goto(`${BASE}/storico`, { waitUntil: 'networkidle' });
  await page.getByRole('radio', { name: 'Griglia' }).click();
  const grid = await page.locator('table').allInnerTexts();
  const all = grid.join(' ').replace(/\s+/g, ' ');
  const expected = ['20×10', '70×6', '45×6', '35×7', '30×10', '85×8', '60×8', '90×8', '70×8', '40×10', '50×8', '30×15', '25×6', '24×8', '60×6', '45×6/7', '50×10', '85×10', 'saltato'];
  const missing = expected.filter((x) => !all.includes(x));
  ok('7a. The grid shows every week 1 number', missing.length === 0, missing.length ? `missing ${missing.join(', ')}` : '19 values');
  await page.getByRole('button', { name: /^Lat pulldown.*, settimana 1:/ }).click();
  const w = page.getByRole('textbox', { name: 'Peso serie 1 (kg)' });
  await w.fill('72,5');
  await w.blur();
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.goto(`${BASE}/storico/esercizio/lat-pulldown`, { waitUntil: 'networkidle' });
  ok('7b. Editing a cell updates the exercise history', (await page.locator('main').innerText()).includes('72,5 × 6'));
  await context.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
console.log(errors.length ? `Console errors:\n${errors.join('\n')}` : 'No console errors');
process.exit(failed.length || errors.length ? 1 : 0);
