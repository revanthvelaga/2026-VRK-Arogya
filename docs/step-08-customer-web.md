# Step 8 — Customer web app

## In plain language

Steps 1–7 gave staff a console to run the lab from. This step gives
**customers** a place to actually do the thing the whole platform exists
for: book a test.

The original plan (see `ARCHITECTURE.md`) puts the customer-facing app on
React Native — one phone app that reaches people who may not have a
reliable desktop, which matters for the villagers this platform is meant
to serve. That's still happening. This step adds a **web** version
alongside it, not instead of it, because every endpoint a customer needs
already existed from steps 1–7 — building the web version cost nothing on
the backend and let the booking/tracking experience get proven out before
building the same thing a second time in React Native.

What's actually there:

- **Home page** — what the platform does, how booking works, a "book a
  test" call to action.
- **Catalog** — every test and package, with price and turnaround time up
  front. Clicking "Book this test" jumps straight into the booking form
  with that item already selected.
- **Centers** — every diagnostic center, plus a real "find centers near
  me" search using the browser's own location (or typed-in coordinates)
  against the radius search built in step 3.
- **Book a test** — select tests/packages, a center, how the sample gets
  collected (walk in, a pickup point, or a home visit — with the pickup
  point list filtered to whichever center is chosen), and a date/time. A
  running order summary sits alongside the whole time. Submitting creates
  a real booking through the exact same validation and pricing rules
  step 4 built (this page trusts nothing — the total shown is a preview,
  the API recomputes the real total from today's prices).
- **My Bookings / booking detail** — every booking a customer has made,
  and on the detail page, **the same sample-tracking stepper built for
  staff** in the admin console's visual-polish pass — Booked → Collected →
  In transit → At center → In-house/Partner lab → Result ready →
  Delivered. Staff and customers look at the identical picture of where a
  sample actually is.
- Cancelling a booking that's still `PENDING`/`CONFIRMED` is one click.

## In technical terms

- `apps/customer-web` — another Vite + React 18 + TypeScript app, same
  stack as `admin-web`, on port `5174` so both can run side by side.
- **No new backend work.** Every call this app makes — `/auth/register`,
  `/auth/login`, `/catalog/tests`, `/catalog/packages`, `/centers`,
  `/centers/nearby`, `/pickup-points`, `/bookings`, `/bookings/mine`,
  `/bookings/:id`, `/bookings/:id/cancel`, `/bookings/:id/samples`,
  `/samples/:id/history` — already existed and already had the right
  ownership checks (`findOneForUser` on the API side), so a customer only
  ever sees their own data.
- **Shares its design system with `admin-web`**, copied rather than
  imported (`api/client.ts`, `api/types.ts`, `lib/useApi.ts`,
  `lib/format.ts`, the icon set, `Spinner`/`EmptyState`, and — the
  important one — `SampleProgress`, the tracking stepper). The monorepo
  doesn't have a shared UI package yet (`packages/shared-types` is still
  just a planned folder), so this is deliberate duplication, flagged in
  `apps/customer-web/README.md` as worth extracting once a third app needs
  the same pieces.
- **`AuthContext` has no role gate** — unlike the admin console, any
  authenticated user (a `CUSTOMER`, or technically `STAFF`/`ADMIN` too,
  harmlessly) can use this site, since booking for yourself has no
  privilege requirement on the API.
- **`BookingPage`** is the most involved screen: it reads `location.state`
  set by the "Book this test" / "Book this package" / "Book at this
  center" links from the catalog/centers pages to pre-select an item or
  center, fetches pickup points scoped to whichever center is chosen, and
  computes a running total client-side purely for display — the actual
  charge is always whatever `BookingsService.create()` computes
  server-side.

### Try it

```
cd apps/customer-web
npm install
cp .env.example .env
npm run dev            # http://localhost:5174
```

Register a new account (always `CUSTOMER`), browse the catalog, book a
test, then open it from "My Bookings" to see the tracking stepper — ask
an admin/staff user to initialize and advance its samples from the admin
console to watch it move.

## What's next

Step 9 (build order item 9) is the **customer mobile app** — React
Native/Expo, reaching customers who don't have reliable desktop access,
built against the same endpoints this web app already proved out.
