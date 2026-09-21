# Step 11 — Deploying to the cloud (no local server, testable from a phone)

## In plain language

Everything so far has run on one machine at a time — your own laptop, or
a throwaway sandbox — which is fine for building, but means there's
nothing for a phone (or anyone else) to actually reach once that machine
turns off. This step puts the whole app somewhere that stays up on its
own, for free, without a credit card anywhere: the API, the admin
console (`apps/admin-web`), and the customer site (`apps/customer-web`)
all get their own public URL, and the mobile app (Step 9) can be built as
a real installable APK — all reachable from any phone or browser,
anywhere, with nothing running locally at all.

Two free services, no card required on either:

- **[Supabase](https://supabase.com)** — a managed Postgres database.
  Used here purely as "Postgres with PostGIS", not its other features
  (auth, storage, etc.) — this app already has its own auth and file
  storage.
- **[Render](https://render.com)** — runs `apps/api` as a free web
  service, and `apps/admin-web` / `apps/customer-web` as free static
  sites (they're plain Vite builds — HTML/CSS/JS, no server needed to
  run them, just to host the files). Render also offers its own free
  Postgres, but its free tier doesn't allow enabling the PostGIS
  extension this app needs (a permissions restriction, not a missing
  feature) — hence Supabase for the database specifically.

The free API web service sleeps after 15 minutes with no traffic and
takes about a minute to wake back up on the next request — normal for a
free tier, not a bug. (The two static sites don't sleep — there's no
server process behind them to spin down, just files.) The free Supabase
project similarly pauses after 7 days of total inactivity; opening its
dashboard resumes it.

### One-time setup

1. **Create a Supabase project** (free, no card) — supabase.com → New
   project. Once it's up: **Database → Extensions** in the sidebar →
   search `postgis` → enable it.
2. **Get its connection string** — click **Connect** near the top of the
   project dashboard (not under Project Settings — Supabase moved this).
   In the dialog, pick **Session pooler**, not "Direct connection": the
   direct one requires IPv6, which Render's free tier can't reach (it's
   IPv4-only outbound), so it'll time out from there even though it
   works fine from your own machine. Session pooler works over IPv4 on
   every plan, free included, and — unlike transaction mode — behaves
   like a normal persistent connection, which is what this app needs.
   Copy the string and replace `[YOUR-PASSWORD]` with the database
   password you set when creating the project. You'll paste it into
   Render next.
3. **Deploy everything on Render** — render.com → **New → Blueprint** →
   connect this GitHub repo. Render reads [`render.yaml`](../render.yaml)
   at the repo root automatically and proposes three services:
   `arogya-api`, `arogya-admin-web`, `arogya-customer-web`. When it asks
   for the values it can't guess:
   - `arogya-api`'s `DATABASE_URL` — the Supabase connection string from
     step 2
   - `arogya-api`'s `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — optional;
     leave blank to skip payments for now, everything else still works
   - `arogya-admin-web`'s and `arogya-customer-web`'s `VITE_API_URL` —
     **you don't have this yet on a first deploy** (it's `arogya-api`'s
     own URL, which Render only assigns once that service exists). Two
     ways to handle it: leave both blank for this first deploy, then
     once `arogya-api` is live (step 5 below), come back to each static
     site's **Environment** tab, set `VITE_API_URL` there, and click
     **Manual Deploy** to rebuild with it — or just deploy `arogya-api`
     on its own first (uncheck the two static sites in the Blueprint
     screen), note its URL, then apply the Blueprint again to add the
     two web apps with that URL ready to type in immediately.
   JWT secrets are generated for you automatically.
4. **Deploy.** Render builds and starts everything; the API's first boot
   also seeds the catalog/centers/tests automatically (see "In technical
   terms" — there's no shell access on a free plan to run the seed
   script by hand, so the app seeds itself once, the first time it finds
   an empty database).
5. **Check the API's alive** — Render shows you `arogya-api`'s URL
   (`https://arogya-api-xxxx.onrender.com`); open `<that-url>/health` in
   a browser. `{"status":"ok","database":"up",...}` means it's ready —
   and is the URL the two static sites' `VITE_API_URL` needs (step 3).
6. **Open the two web apps** — Render shows each static site its own URL
   too (`https://arogya-admin-web-xxxx.onrender.com`,
   `https://arogya-customer-web-xxxx.onrender.com`). Customer-web: public
   sign-up always creates a `CUSTOMER` account, so just register and go.
   Admin-web needs an `ADMIN`/`STAFF` account, which nothing creates by
   default — register normally on customer-web first, then promote that
   phone number to `ADMIN` directly in Supabase's **SQL Editor** (left
   sidebar): `UPDATE users SET role = 'ADMIN' WHERE phone = '9999999999';`
   — same approach `apps/admin-web/README.md` describes for local dev,
   just run through Supabase's SQL Editor instead of `psql` since there's
   no local database to run it against anymore.

### Building the mobile app against it

1. In `apps/mobile/.env`, set `EXPO_PUBLIC_API_URL` to the Render URL
   from step 5 above.
2. Push that to GitHub (`.env` itself is gitignored — either commit the
   value some other way your team uses, or set it as a build-time secret
   in the EAS project settings; see
   [Expo's docs on environment variables](https://docs.expo.dev/eas/environment-variables/)).
3. **Trigger the build entirely from the Expo dashboard** — nothing needs
   to run on a local machine for this part either. At
   [expo.dev](https://expo.dev): sign in (free) → **Settings →
   Connections → GitHub** → Connect. Then, in your project → **Project
   settings → GitHub**, connect this repository. From there, the
   project's **Builds** page lets you start a new build (platform:
   Android, profile: `preview`, from `eas.json`) straight from the
   website — it runs on Expo's build infrastructure, not yours.
4. When it finishes, the build page gives you a QR code / download
   link — open it on an Android phone to install the APK directly (no
   Play Store needed for this; see `apps/mobile/README.md` for the
   local-CLI version of this same build if you'd rather run it from your
   own machine).

## In technical terms

- **`apps/api/src/app.module.ts`** — `TypeOrmModule.forRootAsync`'s
  factory now checks for a `DATABASE_URL` env var first; when set, it's
  passed straight through as TypeORM's `url` option with
  `ssl: { rejectUnauthorized: false }` (hosted Postgres providers require
  SSL and commonly present a cert chain outside Node's default trust
  store). The five `DB_HOST`/`DB_PORT`/`DB_USERNAME`/`DB_PASSWORD`/
  `DB_NAME` vars are the fallback, used for local dev against
  `docker-compose.yml`'s Postgres — unchanged from before this step.
  `seed/seed.cli.ts`'s standalone `DataSource` got the same `DATABASE_URL`
  branch, so the CLI seed script also works against a cloud database if
  you ever want to run it directly instead of relying on auto-seed.
- **`AppModule implements OnApplicationBootstrap`** — after Nest finishes
  wiring every module (by which point TypeORM's `synchronize: true` has
  already created all tables), it runs one `SELECT COUNT(*) FROM tests`.
  Zero rows means a brand-new database, so it calls the same
  `seedDatabase()` function `seed.cli.ts` already used, once. Any
  non-zero count — including every later restart — skips it entirely, so
  this never re-seeds or clobbers real data once there is any. This
  exists specifically because a free hosting plan (Render's included)
  doesn't provide shell/SSH access to run a one-off script by hand.
- **`render.yaml`** (repo root) — a
  [Render Blueprint](https://render.com/docs/infrastructure-as-code)
  defining three services. `arogya-api`: `runtime: node`,
  `rootDir: apps/api` (this is a monorepo, so Render needs to know which
  subdirectory to build/watch), `healthCheckPath: /health` (the endpoint
  from Step 1's readiness work). `arogya-admin-web` and
  `arogya-customer-web`: `runtime: static`, `staticPublishPath: dist`
  (Vite's default output folder), plus a `routes` rewrite
  (`/* -> /index.html`) so React Router's client-side routes don't 404 on
  a direct link or refresh. `DATABASE_URL`, the two Razorpay keys, and
  both web apps' `VITE_API_URL`/`VITE_SUPPORT_PHONE` are all
  `sync: false` — Render prompts for these once during setup rather than
  storing secrets (or environment-specific URLs) in the committed YAML;
  the JWT secrets use `generateValue: true` instead, so Render mints
  random ones with no input needed.
- **Why not Render's own Postgres**: its free tier rejects
  `CREATE EXTENSION postgis` with a permissions error (superuser
  required, which the free tier doesn't grant) — confirmed against
  Render's own community forum, not an assumption. Supabase's free tier
  has no such restriction; PostGIS is a first-class supported extension
  there, enabled with two clicks in the dashboard.
- **`apps/mobile/eas.json`** (added in the previous mobile-deploy pass)
  already has the `preview` build profile this step's APK build uses —
  nothing new needed there. What's new here is that the build no longer
  needs `eas-cli` run locally at all: EAS's GitHub App lets a build be
  started from expo.dev's own UI once the repo is connected, which is
  the "test it from the cloud, not my machine" path this step is about.
