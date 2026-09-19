# Arogya Admin Web

A React + TypeScript + Vite console for `ADMIN`/`STAFF` accounts — bookings,
sample tracking, the catalog, centers/pickup points, and partner labs. No
UI kit or CSS framework: a small hand-rolled design system (tokens in
`src/index.css`) shared visually with the [build tracker](../../README.md).

## Running it

1. Have the API running first (see [`../api/README`](../api) /
   [the root README](../../README.md#running-the-api-locally)).
2. `npm install`
3. `cp .env.example .env` — set `VITE_API_URL` if the API isn't on
   `localhost:3000`.
4. `npm run dev` — console on http://localhost:5173

### Signing in

The public `POST /auth/register` endpoint always creates a `CUSTOMER`
account — there's no self-service way to become `ADMIN`/`STAFF` yet (see
"Known gaps" below). For local development, register normally and then
promote that user directly in the database:

```sql
UPDATE users SET role = 'ADMIN' WHERE phone = '9999999999';
```

## How it's put together

- `src/api/client.ts` — a small `fetch` wrapper (`api.get/post/patch/delete`)
  that attaches the JWT from `localStorage`, decodes the API's error shape
  into a message, and clears the session + redirects to `/login` on `401`.
- `src/auth/AuthContext.tsx` — decodes the JWT's payload (`sub`/`phone`/`role`)
  client-side for display; **not** a trust boundary — every real
  authorization check still happens on the API.
- `src/lib/useApi.ts` — a `{ data, loading, error, reload }` hook every page
  uses for `GET` requests; `reload()` re-fetches after a mutation.
- `src/pages/` — one file per route. `BookingDetailPage` is the most
  involved: it drives the sample lifecycle (init → advance status →
  optional partner-lab routing → history), directly against the endpoints
  added in steps 5–6 of the build order.

## Known gaps (by design, for now)

- **No admin/staff self-signup.** Matches the API, which intentionally
  forces public registration to `CUSTOMER`.
- **Deactivated catalog/center/pickup-point items disappear from view.**
  The API's list endpoints only ever return active rows (no "show
  inactive" admin view exists yet), so "Deactivate" here is one-way from
  the UI's perspective — consistent with, not a limitation added by, the
  admin console.
- **No customer/user management screen.** Nothing in the API exposes a
  user list yet.
