# Arogya Customer Web

A React + TypeScript + Vite site for customers — browse the catalog, book a
test, and track a sample all the way to delivery. Register/login is open to
anyone (public sign-up is always forced to `CUSTOMER` on the API); no admin
gating here, unlike `admin-web`.

This exists alongside the planned React Native (Expo) customer app rather
than instead of it — see [`ARCHITECTURE.md`](../../ARCHITECTURE.md). Villages
without reliable smartphone access still need the mobile app; this gives
anyone with a browser a way to book today, and proves out the booking/
tracking UX before building it a second time in React Native.

No backend changes were needed to build this — every endpoint it uses
(`/auth/*`, `/catalog/*`, `/centers*`, `/pickup-points*`, `/bookings*`,
`/samples/:id/history`) already existed from steps 1–7.

## Running it

1. Have the API running first (see the root README).
2. `npm install`
3. `cp .env.example .env` — set `VITE_API_URL` if the API isn't on
   `localhost:3000`.
4. `npm run dev` — site on http://localhost:5174 (`admin-web` uses 5173,
   so both can run at once)

## How it's put together

Shares its design system and utility layer with `admin-web` — same color
tokens, fonts, icon set, `useApi` hook, and `SampleProgress` stepper
component — copied rather than imported, since the monorepo doesn't have a
shared `packages/ui` yet (`packages/shared-types` is still just a folder
name in the architecture doc). Worth extracting once a third app needs the
same pieces.

Layout is a top nav + footer (`Layout.tsx`/`TopNav.tsx`), not the sidebar
`admin-web` uses — this is a public site people land on, not a console
staff sign into. Visually modeled on consumer health-commerce apps
(Tata 1mg, in particular) rather than a plain form-driven site: rich
carousel cards with a gradient "photo" header (no real photography in the
catalog data, so a deterministic per-item gradient stands in for it),
category chips, quick-action tiles, and a persistent add-to-cart flow
instead of a single-item "book this" link.

- `/` — an app-like home feed: search bar, quick-action tiles, a promo
  banner, and horizontal carousels of recommended tests / popular
  packages, each card with its own "Add" button.
- `/catalog` — tests and packages as a browsable grid, with sample-type
  filter chips and a name search on the tests tab. Every card's "Add"
  button adds to the cart in place — no navigation needed to keep
  browsing.
- `/centers` — public browse, plus a real "use my location"
  (`navigator.geolocation`) search against `GET /centers/nearby`.
- **Cart** (`context/CartContext.tsx`) — a `localStorage`-backed
  selection of tests/packages, built up from any page (works before
  login too — added items survive registering/signing in) via a
  header cart icon (with a count badge) and a floating bottom bar
  ("N items added · ₹total · Go to cart") that appears once something's
  in it. `/book` seeds its item checklist from the cart, and clears it
  after a successful booking.
- `/book` (auth required) — the booking form: item selection (pre-filled
  from the cart, still editable), center, collection mode (walk-in/pickup
  point/home visit, with the pickup-point dropdown filtered to the chosen
  center), date/time, and a sticky order summary each line of which can
  be removed directly. Submits straight to `POST /bookings`.
- `/bookings`, `/bookings/:id` (auth required) — a customer's own bookings
  and, on the detail page, the same `SampleProgress` stepper `admin-web`
  built for staff — the whole point of tracking is that both sides see the
  same picture.
- **Shop by category** (home page) — six audience segments (Men, Women,
  Children, Senior Men, Senior Women, Fitness), each a real photo tile
  (hand-picked, license-free Unsplash photos — not a keyword search, so
  each one actually shows the right kind of person) linking to
  `/catalog?audience=X`. This is backed by a real `audience` field on
  `Test`/`Package` (API step 3's catalog module, extended this pass), sett
  able from `admin-web`'s catalog forms — not a client-side guess from the
  test name. Catalog filters to that audience (plus anything tagged
  `EVERYONE`) and shows a "Showing tests recommended for X" banner with a
  clear action.
- `/insights` (auth required) — real numbers computed from the customer's
  own `/bookings/mine`: total bookings, completed count, total spent,
  tests booked, and the next upcoming booking. Nothing here is
  placeholder/fabricated data — an account with no bookings gets an empty
  state, not a fake dashboard.
- **Book via call / Book via WhatsApp** (home page quick actions) — real
  `tel:`/`wa.me` links, wired to `VITE_SUPPORT_PHONE` (see `.env.example`).
  Defaults to an obvious placeholder number — set a real one before this
  goes anywhere near actual users.

## Known gaps (by design, for now)

- **No payment step.** Bookings are created unpaid, same as the API
  supports today; a payment gateway is a later step in the build order.
- **Mobile nav is a horizontal scroll strip, not a hamburger menu**, below
  860px — functional, not polished; worth a real mobile nav pattern later.
- **No package detail view yet.** A package card shows its price, test
  count, and turnaround, but not the full list of included tests — noted
  as a follow-up, not built in this pass.
- **Card art is a gradient standing in for photography** (there's no
  image field in the catalog data model) — a deterministic hash of each
  item's id picks one of six gradients, so a given test/package always
  gets the same one rather than a random one on every render. The six
  audience-segment photos are real, hand-picked images (see above) — only
  individual test/package cards use the gradient placeholder.
- **"Upload prescription" isn't built.** The reference design had a
  fourth quick-action tile for it; there's no file-upload endpoint yet
  (that's step 10, report PDF upload/download), so it isn't faked here.
