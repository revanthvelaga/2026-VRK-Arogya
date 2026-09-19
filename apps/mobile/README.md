# Arogya Mobile

A React Native (Expo) app for customers — browse the catalog, book a test,
and track a sample all the way to delivery, from a phone. Built for the
step 9 build-order item: reaching customers who don't have reliable
desktop/broadband access, which `apps/customer-web` (step 8) was built to
prove out first.

Public sign-up is always forced to `CUSTOMER` on the API, same as
`customer-web` — no admin gating here.

## Running it

1. Have the API running first (see the root README). If you're testing on
   a physical device via Expo Go, `localhost` won't reach your dev
   machine — use your machine's LAN IP instead (e.g.
   `http://192.168.1.20:3000`); a simulator/emulator on the same machine
   can keep using `localhost`.
2. `npm install`
3. `cp .env.example .env` — set `EXPO_PUBLIC_API_URL` per the note above.
4. `npm start` — opens the Expo dev tools; scan the QR code with Expo Go,
   or press `a`/`i` for an Android/iOS simulator, or `w` for a web
   preview (via `react-native-web`, not a target this app is designed
   for — useful for a quick sanity check only).

## How it's put together

Same conventions as `admin-web`/`customer-web`, ported to React Native —
`api/client.ts` (fetch wrapper, JWT in `AsyncStorage` instead of
`localStorage`), `api/types.ts`, `auth/AuthContext.tsx`, `lib/useApi.ts`,
`lib/format.ts`, and `components/SampleProgress.tsx` (the same
courier-tracking-style stepper, re-implemented with RN `View`/`Text`
since there's no CSS/SVG here) — copied and adapted, not imported, same
reasoning as `customer-web`'s README: no shared `packages/ui` yet.

Navigation is [React Navigation](https://reactnavigation.org) — a bottom
tab navigator (Home / Catalog / Centers / Bookings) nested inside a
native stack that also holds Login, Register, Booking, Booking detail,
and Insights. There's no client-side route guard primitive like
`customer-web`'s `<RequireAuth>`; `components/RequireAuth.tsx` is the
in-screen equivalent — a protected screen renders it instead of its real
content while logged out, with buttons straight to Login/Register.

- **Home** — quick-action tiles (Full body packages, Book via Call, Book
  via WhatsApp, Centers near me, Track a sample, My Insights), a
  horizontally-scrolling "Shop by category" row (the same six
  hand-picked, verified Unsplash photos as `customer-web`, from
  `lib/segments.ts`), and carousels of tests/packages with a "Book" button
  that jumps straight into the booking screen with that item preselected.
- **Catalog** (tab) — tests/packages with a name search and a Tests/
  Packages toggle; opened via a category tile, it filters to that
  audience (plus anything tagged `EVERYONE`) and shows the same
  "recommended for X" banner as the web app.
- **Centers** (tab) — every diagnostic center, plus a real "Use my
  location" search via `expo-location` against `GET /centers/nearby`.
- **Book a test** — no cart here (unlike `customer-web`'s pass-2
  redesign): item selection is a straightforward multi-select list,
  optionally preselected from a "Book" tap, same payload shape and
  server-trusts-nothing pricing as the web app. Date/time uses the
  platform's native picker (`@react-native-community/datetimepicker`).
- **My Bookings** (tab) / **Booking detail** — a customer's own bookings,
  and on the detail screen, `SampleProgress` plus expandable per-sample
  status history, same as `customer-web`.
- **Insights** — identical computation to `customer-web`'s `/insights`:
  real numbers derived from `GET /bookings/mine` only, empty state if
  there's no history yet.
- **Book via Call / Book via WhatsApp** — `Linking.openURL('tel:...')` /
  `Linking.openURL('https://wa.me/...')`, wired to
  `EXPO_PUBLIC_SUPPORT_PHONE` (same placeholder-by-default caveat as
  `customer-web`).

## Known gaps (by design, for now)

- **No custom icon set or webfonts.** `admin-web`/`customer-web` have a
  hand-drawn SVG icon factory and load `Sora`/`Plus Jakarta Sans`; this
  app uses plain text labels and the system font, styled with the same
  color tokens (`src/theme.ts`) to stay recognizably "the same app" —
  worth porting the icon set (via `react-native-svg`) and loading the
  webfonts (via `expo-font`) as a follow-up visual-polish pass, the same
  way `customer-web` got one after its first working version.
- **No cart.** `customer-web` moved from a single-item "book this" flow
  to a persistent cart in its own follow-up pass; this app ships with the
  simpler multi-select-on-the-booking-screen flow customer-web started
  with. Worth the same follow-up here once the web pattern is proven
  further.
- **No package detail view.** Matches `customer-web`'s same gap — a
  package card shows price/test-count/turnaround, not the full list of
  included tests.
- **Not tested on a physical device or simulator in this environment**
  (no emulator/device available here) — verified instead via a clean
  `tsc --noEmit` and a successful Metro bundle export
  (`npx expo export --platform android`, 888 modules, no errors). Run it
  through Expo Go or a simulator before treating it as field-ready.
