# Scheda

A private workout tracker for one person: my upper/lower program, the weights I lift, session after session.
Mobile-first installable web app (PWA), Italian UI, offline-first, synced to my own Supabase project.

- **Oggi**: this week (Settimana *n* di 7, deload in week 7), today's workout, rest days, sessions done this week, resume.
- **Sessione**: one card per exercise with picture, "Ultima volta" from the most recent log of that exercise on any day, progression hint, set rows (weight − / +, reps, one tap to check), supersets, warm-ups, skip, "Sostituisci per oggi", undo, rest timer, screen kept awake, finish summary with records.
- **Programma**: days, weekdays, exercises, sets/reps/RIR/rest/notes, drag to reorder, supersets, swap exercises (history kept).
- **Storico**: the Excel-like grid (weeks 1-7, top set per cell, tap to edit), history by exercise (search, muscle filter, best set, sparkline, PR badges), session list.
- **Impostazioni**: name, block start and week override, extra sets, load step, sound, theme, JSON/CSV export, JSON import, sync, sign out, credits.

React 19 + TypeScript + Vite + Tailwind CSS 4, Lucide icons, Dexie (IndexedDB) on the device, Supabase (Postgres, Auth, Storage) in the background. No analytics, no trackers, no ads, no third-party scripts.

## Run it locally

```bash
npm install
```

```bash
npm run dev
```

Without Supabase settings the app runs local-only (data in the browser, JSON export/import as backup).
To sync, copy `.env.example` to `.env.local` and fill in your project's URL and key (see below).

```bash
npm test
```

```bash
npm run build && npm run preview
```

`npm test` runs the unit tests (week logic, sets/RIR by week, deload, hidden slots, progression hint,
"Ultima volta" across days, seed import, program editor, export/import, sync with last-write-wins).
`e2e/acceptance.mjs` runs the acceptance checks of the spec in Chromium at 390 × 844 against a
production build with a fake Supabase in memory (needs Playwright; see the comment at the top of the file).

## 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com) (pick an EU region, e.g. Frankfurt). Keep the database password somewhere safe; the app doesn't need it.
2. **SQL Editor → New query**: paste the whole of [`supabase/schema.sql`](supabase/schema.sql) and **Run**. It creates the tables (`settings`, `exercises`, `days`, `slots`, `sessions`, `set_logs`, `media`), row-level security on every table (`auth.uid() = user_id`), the last-write-wins trigger and the private `media` Storage bucket with per-user policies. It is safe to run again.
3. **Authentication → Sign In / Providers**:
   - turn **off** "Allow new users to sign up";
   - in **Email**, keep the provider on and set **Email OTP Length** to **6** (and the expiry to 3600 seconds).
4. **Authentication → Emails → Templates → Magic Link** (this is the template Supabase sends for a sign-in code):
   - Subject: `Il tuo codice per Scheda`
   - Body: paste [`supabase/email-template.html`](supabase/email-template.html). The important part is `{{ .Token }}`, which prints the 6-digit code. Don't put `{{ .ConfirmationURL }}` in it: on iPhone a link opens Safari, not the installed app, and the session wouldn't carry over. That's why the app signs in with a code.
5. **Authentication → Users → Add user → Create new user**: your email, any password, tick **Auto Confirm User**. This is the only user; the app calls `signInWithOtp` with `shouldCreateUser: false`, so nobody else can get in.
6. **Project Settings → API keys** (or **Data API**): copy the **Project URL** and the **anon / publishable** key. That key is meant to be public; row-level security protects the data.
7. Recommended: **Authentication → Emails → SMTP Settings**. Supabase's built-in email sender is rate-limited to a few emails per hour and is meant for testing; any SMTP provider's free tier is plenty for one person.
8. Optional: **Authentication → URL Configuration → Site URL** = your deployed URL.

Your email address is not in the code and not needed as a setting: Supabase only knows your user and refuses codes for any other address. (I left out `ALLOWED_EMAIL` on purpose: anything given to a Vite app ends up in the public JavaScript bundle.)

## 2. Deploy on Vercel

1. Push this repository to GitHub (already there: `EndyXVIII/Gym`). Merge the work branch into `main`, or pick it as the production branch in step 4.
2. [vercel.com](https://vercel.com) → **Add New → Project → Import** `EndyXVIII/Gym`. Vercel detects Vite (`npm run build`, output `dist`; `vercel.json` sets the same).
3. **Environment Variables** (Production and Preview):
   - `VITE_SUPABASE_URL` = the Project URL, e.g. `https://abcd1234.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = the anon / publishable key
4. **Deploy**. If the branch isn't `main`: **Settings → Git → Production Branch**.
5. Open the URL on the Mac to check: you should see "Accedi a Scheda".

`vercel.json` adds the SPA rewrite, a strict Content-Security-Policy (only this site and `*.supabase.co`), `noindex`, and the cache headers the service worker needs. If you use a custom Supabase domain, add it to `connect-src` there.
Netlify works the same way with `netlify.toml` (same build, same variables).

## 2b. Or: deploy on GitHub Pages

Free for public repositories. The site will be at `https://<your-user>.github.io/Gym/`. The workflow in [`.github/workflows/pages.yml`](.github/workflows/pages.yml) runs the tests, builds with the base path `/Gym/`, adds a `404.html` copy of the app for direct links, and publishes.

1. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions**:
   - tab **Variables** → New repository variable `VITE_SUPABASE_URL` = the Project URL;
   - tab **Secrets** → New repository secret `VITE_SUPABASE_ANON_KEY` = the anon / publishable key.
3. **Actions → Deploy to GitHub Pages → Run workflow** (afterwards it runs by itself on every push to `main` or to the work branch). When it's green, the URL is on the run page and in **Settings → Pages**.
4. In Supabase, set **Authentication → URL Configuration → Site URL** to that URL (optional).
5. On the iPhone, follow section 3 with the Pages URL (`…/Gym/`, with the final slash).

Differences from Vercel, all minor for this app:
- Pages can't send headers, so the Content-Security-Policy comes as a `<meta>` tag (production builds always include it, with only this site and your Supabase project in `connect-src`); there is no `X-Frame-Options`.
- Pages has no rewrites: opening a deep link like `…/Gym/storico` in a fresh browser gets a 404 status with the app in it (it still works). The installed app starts at `…/Gym/` and its service worker answers every link itself.
- All your GitHub Pages sites share the origin `<your-user>.github.io`, so they share browser storage. Fine if the other sites are yours; if you publish third-party code on Pages, prefer Vercel (its own origin) for Scheda.
- For a custom domain, add the repository variable `BASE_PATH` = `/`.

## 3. Put it on the iPhone home screen

1. On the iPhone, open the Vercel URL in **Safari**.
2. Tap **Condividi** (the square with the arrow) → scroll down → **Aggiungi alla schermata Home** → name **Scheda** → **Aggiungi**.
3. Close Safari and open **Scheda from the Home Screen**. The installed app has its own storage, separate from Safari, so sign in there.
4. Type your email → **Invia il codice** → the code arrives by email. iOS usually offers it above the keyboard ("Da Mail"); otherwise copy it from Mail. The app signs in when the 6th digit is typed.
5. Done. The program and your week 1 numbers are already there; from now on it works offline and syncs in the background when there's a connection. The dot at the top right shows the sync state (green = synced, amber = changes waiting, ring = offline or not signed in).

Tips: the rest-timer beep follows the ring/silent switch (it mixes with your music); the screen stays on during a session; if you update the app, a banner offers "Aggiorna".

## How the data works

- IndexedDB (Dexie) on the device is the source of truth. Every record has a UUID, `updatedAt` and a soft `deletedAt`; nothing is ever hard-deleted.
- Sync: push records changed locally, pull rows changed on the server after a cursor (server time). Conflicts: last write wins on `updatedAt`, on the client and in a Postgres trigger, so an older copy can never overwrite a newer one.
- Seed records (program + week 1) have deterministic ids (UUID v5 of keys like `slot:upper-a:6a`) and an old timestamp: importing the seed on a second device creates no duplicates and never overwrites real edits.
- Photos/videos: shrunk to 1200 px, stored in IndexedDB and in the private `media` bucket under your user id.
- History belongs to the exercise, not to the slot: "Ultima volta" and the history come from the latest log of that exercise on any day.

## Exercise images

Exercise data by [RepDB](https://repdb.co) (repdb.co).

The illustrations come from the free edition of the RepDB exercise dataset ([github.com/sergei-argutin/exercise-dataset](https://github.com/sergei-argutin/exercise-dataset)), used in-app under its Free Tier License: visible credit (About screen, under every enlarged image, here), no redistribution as a dataset, no generative-AI use. Only the 54 files for my exercises are in `public/exercises`; the dataset itself is not in this repository. To refresh them from a local clone: `node scripts/copy-exercise-images.mjs ../exercise-dataset`.

| My exercise | Dataset id | Confidence |
|---|---|---|
| Bench press | `bench-press` | high |
| Lat pulldown | `lat-pulldown` | high |
| Chest-supported row | `chest-supported-machine-row` | high |
| Pec deck | `pec-deck` | high |
| Cable lateral raise | `cable-lateral-raise` | high |
| Overhead cable triceps extension | `cable-overhead-tricep-extension` | high |
| Bayesian cable curl | `cable-curl` (doubtful: faces the stack) | low → muscle map |
| Hack squat | `hack-squat` | high |
| Lying leg curl | `leg-curl` | high |
| Leg extension | `leg-extension` | high |
| Hip abduction machine | `hip-abduction` | high |
| Standing calf raise | `standing-calf-raise` | high |
| Reverse pec deck | `machine-reverse-fly` | high |
| Cable crunch | `cable-crunch` | high |
| Wrist curl | `wrist-curl` | medium |
| Wrist extension | `db-reverse-wrist-curl` | high |
| Machine chest press | `chest-press-machine` | high |
| Single-arm lat pulldown | `one-arm-lat-pulldown` | high |
| Seated cable row | `seated-cable-row` | high |
| Machine or dumbbell lateral raise | `lateral-raise` | medium |
| Preacher curl | `preacher-curl` | high |
| Overhead triceps extension | `overhead-tricep-extension` | medium |
| Cable pushdown | `tricep-pushdown` | high |
| Romanian deadlift | `romanian-deadlift` | high |
| Leg press | `leg-press` | high |
| Hanging leg raise | `hanging-leg-raise` | high |
| Rope hammer curl | `cable-hammer-curl` | high |
| Incline Dumbbell | `incline-db-press` | high |

Exercises without a picture (or with a doubtful match, or new ones I add) show an SVG muscle map drawn for this app. Any exercise can use my own photo or short video instead (exercise detail → "Mia foto/video").

## Project layout

```
src/
  lib/program.ts         all the week logic (pure functions, unit tested)
  lib/seed.ts            builds the deterministic seed from src/data/seed.json
  lib/db.ts, repo.ts     Dexie schema; every write stamps updatedAt, soft-deletes, supports undo
  lib/sync.ts            push/pull/last-write-wins, photo upload/download
  lib/supabase.ts        Supabase client (lazy-loaded), auth, storage adapter
  screens/               today, session, program, history, settings, auth
  components/            UI kit, sheets, exercise media, muscle map, sparkline
supabase/schema.sql      tables, RLS, trigger, storage bucket
e2e/acceptance.mjs       the spec's acceptance checks in Chromium
```

Icons: [Lucide](https://lucide.dev) (ISC). System font (SF Pro on iOS).
