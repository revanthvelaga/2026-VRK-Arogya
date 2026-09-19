# Step 7 — Admin web dashboard

## In plain language

Every module built so far (steps 1–6) only existed as a JSON API — real,
working, but only reachable with something like Postman or `curl`. This
step gives staff and admins an actual screen to work from.

Signing in with an `ADMIN` or `STAFF` phone number and password opens a
console with five areas:

- **Dashboard** — a quick "how are we doing right now" view: booking
  counts by status, how many centers/catalog items/partner labs exist,
  and the most recent bookings.
- **Bookings** — every booking, filterable by status. Opening one shows
  its items and total, lets staff change its status, and — this is the
  operational heart of the console — **initialize and advance the
  samples** for that booking one stage at a time
  (`BOOKED → COLLECTED → ... → DELIVERED`), including routing a sample to
  a partner lab and seeing its full status history.
- **Catalog** — add/edit tests and packages, mark a test in-house or
  routed to a partner lab, and set which **audience** a test/package is
  aimed at (Everyone / Men / Women / Children / Senior Men / Senior
  Women / Fitness) — added after this step's initial build, once the
  customer web app (step 8) needed a real field to drive its "shop by
  category" suggestions rather than guessing from the test name.
- **Centers** — add/edit diagnostic centers, and manage each center's
  pickup points and their recurring visit schedules, all without leaving
  the page.
- **Partner Labs** — add/edit partner labs, and pull up the **SLA
  summary** built in step 6 for any lab — how many routed samples came
  back on time, are breached, at risk, or still in flight.

There's no separate "create an admin" screen yet — public sign-up always
creates a regular customer account, by design (see step 1). For now, an
admin account has to be promoted directly in the database; a proper
admin-invite flow is a natural follow-up once step 8 (notifications) is
in place to actually deliver an invite.

## In technical terms

- `apps/admin-web` — a new Vite + React 18 + TypeScript app, no UI
  framework — a small hand-rolled design system (`src/index.css`, CSS
  custom-property tokens) so the whole console reads as one thing.
- **Auth** (`src/auth/AuthContext.tsx`): logs in against `POST
  /auth/login`, stores `{ accessToken, refreshToken, role }` in
  `localStorage`, and decodes the JWT payload client-side (`sub`/`phone`/
  `role`) purely for display — this is **not** a trust boundary, every
  real authorization decision still happens on the API via its existing
  guards. A login is rejected client-side if the resulting role isn't
  `ADMIN`/`STAFF`, since a `CUSTOMER` token is valid but this console
  isn't for them.
- **API client** (`src/api/client.ts`): a thin `fetch` wrapper
  (`api.get/post/patch/delete`) that attaches `Authorization: Bearer
  <token>`, translates the API's `{ message }` error shape into a
  readable string, and on a `401` clears the session and bounces to
  `/login` — reusing the exact guard behavior already built into every
  protected endpoint.
- **Data fetching** (`src/lib/useApi.ts`): one small hook —
  `{ data, loading, error, reload }` — used by every page instead of
  hand-rolling `useEffect`/`useState` per screen; `reload()` re-runs the
  same fetch after a mutation (e.g. after updating a sample's status).
- **`BookingDetailPage`** is the most involved screen — it's a direct,
  visual front-end for the sample-lifecycle and partner-lab-routing work
  from steps 5–6: it reads `SAMPLE_TRANSITIONS` (mirroring
  `SamplesService`'s `ALLOWED_TRANSITIONS` on the API) to only ever offer
  the statuses a sample can legally move to next, shows the
  partner-lab/turnaround-override fields only when routing to a partner
  lab, and fetches a sample's history on demand.
- Every list screen (catalog, centers, partner labs) follows the same
  shape: a table, a "+ Add" button opening a modal form, row-level
  Edit/Deactivate actions — reusing one `Modal` component and one CSS
  design system throughout.
- No new backend work in this step — the console is built entirely
  against the endpoints steps 1–6 already shipped.

### Try it

```
cd apps/admin-web
npm install
cp .env.example .env
npm run dev            # http://localhost:5173
```

Sign in with any `ADMIN`/`STAFF` phone + password. To get one, register
normally through the API and promote that user in the database — see
[`apps/admin-web/README.md`](../apps/admin-web/README.md).

## What's next

Step 8 (build order item 9) is the **customer mobile app** (React
Native/Expo) — the other half of the two-sided platform, wired to the
same booking/catalog/centers endpoints this console already proves work.
