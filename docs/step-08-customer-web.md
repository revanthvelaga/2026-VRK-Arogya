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

It shipped in three passes, all covered by this one step:

1. A working but plain first version — home page, catalog, centers,
   booking form, my bookings/tracking.
2. A visual redesign of the browsing layer to match real consumer
   health-commerce apps (Tata 1mg, specifically — built against actual
   screenshots of its Labs tab), plus a proper shopping cart replacing
   the original "book this one item" flow.
3. Audience-based suggestions, an insights page, and call/WhatsApp
   booking shortcuts.

What's actually there today:

- **Home page** — an app-like feed: a search bar, quick-action tiles
  (Full body packages, Book via Call, Book via WhatsApp, Centers near
  me, Track a sample, My Insights), a promo banner, horizontal
  carousels of recommended tests / popular packages (each card has its
  own "Add" button straight into the cart), and a **"Shop by
  category"** row — six tiles (Men, Women, Children, Senior Men, Senior
  Women, Fitness), each with a real photo, linking into the catalog
  pre-filtered to that audience.
- **Catalog** — tests and packages as a browsable grid, with sample-type
  filter chips, a name search, and (when arrived at via a "shop by
  category" tile) a banner: "Showing tests recommended for X" with a
  clear action. Every card's "Add" button adds to the cart in place —
  no navigation needed to keep browsing.
- **Cart** — builds up across any page, survives logging in/out
  (`localStorage`-backed), shown via a header cart icon with a count
  badge and a floating "N items added · ₹total · Go to cart" bar. `/book`
  seeds its item checklist from the cart and clears it after a
  successful booking.
- **Centers** — every diagnostic center, plus a real "find centers near
  me" search using the browser's own location against the radius search
  built in step 3.
- **Book a test** — item selection (pre-filled from the cart, still
  editable), a center, how the sample gets collected (walk-in, pickup
  point, or home visit — pickup points filtered to whichever center is
  chosen), and a date/time, with a sticky order summary each line of
  which can be removed. Submitting creates a real booking through the
  exact same validation and pricing rules step 4 built (this page trusts
  nothing — the total shown is a preview, the API recomputes the real
  total from today's prices).
- **My Bookings / booking detail** — every booking a customer has made,
  and on the detail page, **the same sample-tracking stepper built for
  staff** in the admin console's visual-polish pass — Booked → Collected →
  In transit → At center → In-house/Partner lab → Result ready →
  Delivered. Staff and customers look at the identical picture of where a
  sample actually is. Cancelling a booking that's still
  `PENDING`/`CONFIRMED` is one click.
- **Insights** — real numbers computed from the customer's own bookings:
  total bookings, completed count, total spent, tests booked, and the
  next upcoming booking. No placeholder/fabricated data — an account
  with no bookings gets an empty state, not a fake dashboard.
- **Book via Call / Book via WhatsApp** — real `tel:`/`wa.me` deep links
  from the home page's quick actions, wired to a configurable support
  number.

## In technical terms

- `apps/customer-web` — another Vite + React 18 + TypeScript app, same
  stack as `admin-web`, on port `5174` so both can run side by side.
- **No new backend work for the booking/tracking core** (`/auth/*`,
  `/catalog/*`, `/centers*`, `/pickup-points*`, `/bookings*`,
  `/samples/:id/history` already existed and already had the right
  ownership checks — `findOneForUser` on the API side — so a customer
  only ever sees their own data). The one real backend addition, added
  during pass 3, is the `audience` enum column on `Test`/`Package`
  (`src/common/enums/audience.enum.ts`: `EVERYONE | MEN | WOMEN |
  CHILDREN | SENIOR_MEN | SENIOR_WOMEN | FITNESS`, default `EVERYONE`),
  settable via `admin-web`'s catalog forms — see
  [`flows/01-database-erd.md`](../flows/01-database-erd.md).
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
- **`CartContext`** (`src/context/CartContext.tsx`) — a `localStorage`
  -backed `{ kind: 'test' | 'package', id, name, price, meta? }[]`, with
  `add/remove/has/clear/total`. Replaced the original "Book this test"
  `location.state` hand-off (which only carried one item at a time and
  couldn't be built up across pages).
- **`BookingPage`** seeds its item checklist from the cart
  (deduplicated), lets each line be removed directly, and computes a
  running total client-side purely for display — the actual charge is
  always whatever `BookingsService.create()` computes server-side.
  `cart.clear()` runs after a successful submit.
- **`CatalogPage`** reads `?audience=` via `useSearchParams()` and
  filters with `itemAudience === filter || itemAudience === 'EVERYONE'`
  — a filter, not a hidden re-query; unaudienced/general items keep
  showing in every category.
- **`lib/segments.ts`** — the six "shop by category" tiles, each a
  hand-picked (not keyword-searched), individually verified,
  license-free Unsplash photo actually showing the right kind of
  person, plus the `Audience` value it links to.
- **`lib/support.ts`** — builds the `tel:`/`wa.me` links from
  `VITE_SUPPORT_PHONE` (`.env`), which defaults to an obvious placeholder
  number; a real number has to be set before these tiles go anywhere
  near actual users.
- **`InsightsPage`** derives every number shown from `GET /bookings/mine`
  client-side — nothing is a new backend endpoint, and nothing is
  invented when the list is empty.

### Try it

```
cd apps/customer-web
npm install
cp .env.example .env
npm run dev            # http://localhost:5174
```

Register a new account (always `CUSTOMER`), browse the home feed or a
"shop by category" tile, add a few items to the cart, book, then open it
from "My Bookings" to see the tracking stepper — ask an admin/staff user
to initialize and advance its samples from the admin console to watch it
move. Set a test/package's `audience` from the admin console's catalog
form to see it show up under that category's filtered view.

## What's next

Step 9 (build order item 9) is the **customer mobile app** — React
Native/Expo, reaching customers who don't have reliable desktop access,
built against the same endpoints this web app already proved out
(catalog browse, cart, booking, tracking, and now audience-based
suggestions).
