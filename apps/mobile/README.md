# Arogya Mobile

A React Native (Expo) app for customers — browse the catalog, book a test,
and track a sample all the way to delivery, from a phone. Built for the
step 9 build-order item: reaching customers who don't have reliable
desktop/broadband access, which `apps/customer-web` (step 8) was built to
prove out first. This app has since been brought back up to feature parity
with `customer-web`'s later passes (cart, multi-patient profiles, GST
breakdown, address autocomplete, home-visit radius validation, in-app
payments, issues, report insights) — see "How it's put together" below.

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
`lib/format.ts`, `lib/geo.ts` (Haversine distance + suggested time slots),
`context/CartContext.tsx` (AsyncStorage-backed, same shape as
customer-web's cart), and `components/SampleProgress.tsx` (the same
courier-tracking-style stepper, re-implemented with RN `View`/`Text`
since there's no CSS/SVG here) — copied and adapted, not imported, same
reasoning as `customer-web`'s README: no shared `packages/ui` yet.

Navigation is [React Navigation](https://reactnavigation.org) — a bottom
tab navigator (Home / Catalog / Centers / My Lab Tests) nested inside a
native stack that also holds Login, Register, Test/Package detail,
Booking, Booking detail, Payment, and Insights. There's no client-side
route guard primitive like `customer-web`'s `<RequireAuth>`;
`components/RequireAuth.tsx` is the in-screen equivalent — a protected
screen renders it instead of its real content while logged out, with
buttons straight to Login/Register.

- **Home** — quick-action tiles (Full body packages, Book via Call, Book
  via WhatsApp, Centers near me, Track a sample, My Insights), a
  horizontally-scrolling "Shop by category" row (the same six
  hand-picked, verified Unsplash photos as `customer-web`, from
  `lib/segments.ts`), and carousels of tests/packages with a "Book" button
  that jumps straight into the booking screen with that item preselected.
- **Catalog** (tab) — tests/packages with a name search and a Tests/
  Packages toggle; opened via a category tile, it filters to that
  audience (plus anything tagged `EVERYONE`) and shows the same
  "recommended for X" banner as the web app. Each row has both a
  "+ Cart" button (adds to the persistent cart without leaving the list)
  and a "Book" button (jumps straight into booking with that item
  preselected); tapping a row opens its **Test/Package detail** screen
  (full description, prep instructions, normal range, and — for
  packages — the expandable list of included tests), matching
  `customer-web`'s `CatalogDetailPage`. A cart summary bar appears at the
  bottom once anything's added, same as web's `CartBar`.
- **Centers** (tab) — every diagnostic center, "Use my location" via
  `expo-location`, or manual search via the same Nominatim-backed
  `AddressAutocomplete` used everywhere else. Centers more than 30km from
  the chosen location are filtered out entirely, and tapping a card
  selects it (highlighted, with a "Continue to booking" summary card) —
  same behavior as `customer-web`'s `CentersPage`.
- **Book a test** — patient picker (a modal-based dropdown, since RN has
  no native `<select>`) with an inline "Add family member" form; item
  selection is cart-based, pre-populated with anything added from
  Catalog and merged with a preselected test/package/center passed in
  via navigation params, plus a "You might also add" related-items
  section; diagnostic center step supports geolocation or manual search,
  sorted nearest-first; collection step covers walk-in, a searchable
  pickup-point picker, or home-visit with address autocomplete, a
  client-side Haversine radius check against the center's
  `serviceRadiusKm`, and an auto-filled (editable) pincode; date uses the
  native `@react-native-community/datetimepicker`, time is a generated
  slot-chip row (`lib/geo.ts`'s `suggestedSlots`) instead of a free time
  picker; the order summary breaks out Subtotal/GST(18%)/Total, matching
  the backend's own computation exactly.
- **My Lab Tests** (tab, renamed from "My Bookings") / **Booking
  detail** — a customer's own bookings with a patient filter (chips, once
  there's more than one profile); the detail screen shows the
  Subtotal/GST/Total breakdown, a payment status badge with a **Pay**
  button when unpaid, `SampleProgress` plus expandable per-sample status
  history, an uploaded-reports section (clinician insights — out-of-range
  values flagged red, with **Download**), and an issues section (raise
  one, see status).
- **Payment** — Razorpay checkout. The native `react-native-razorpay` SDK
  needs an EAS Build (a compiled binary with the module linked in),
  which this sandboxed environment can't produce (no simulator/emulator/
  device to build for) — so this instead renders Razorpay's own
  `checkout.js` inside a `WebView` and bridges the result back over
  `postMessage`, verified against `POST /payments/verify` exactly like
  `customer-web`'s direct `window.Razorpay` integration.
- **Insights** — patient-scoped (same modal patient picker as Booking),
  Out-of-range/Within-range summary tiles, and per-report grouping with a
  **Download** button — identical computation to `customer-web`'s
  `InsightsPage`, sourced from `GET /reports/mine/values?patientId=`.
- **Report/booking downloads** — there's no `<a download>` on a phone, so
  `api/client.ts`'s `downloadFile()` pulls the PDF to local storage with
  the same Bearer token as any other request (via `expo-file-system`'s
  `File.downloadFileAsync`) and hands it to the OS share sheet
  (`expo-sharing`) so the customer can save it or open it in whichever
  PDF viewer they have.
- **Address autocomplete** (`components/AddressAutocomplete.tsx`) — same
  debounced (400ms), Nominatim-backed `/geocode/search` lookup as
  `customer-web`, re-implemented with `TextInput` + an absolutely
  positioned `FlatList` dropdown instead of a browser `<input>`/`<div>`.
  Used for the booking flow's center search, home-visit address, Centers
  screen search, and the "City/Town/Village" field on the add-patient
  form (which auto-fills the pincode, same as web).
- **Book via Call / Book via WhatsApp** — `Linking.openURL('tel:...')` /
  `Linking.openURL('https://wa.me/...')`, wired to
  `EXPO_PUBLIC_SUPPORT_PHONE` (same placeholder-by-default caveat as
  `customer-web`).

## Known gaps (by design, for now)

- **No custom icon set or webfonts.** `admin-web`/`customer-web` have a
  hand-drawn SVG icon factory and load `Sora`/`Plus Jakarta Sans`; this
  app uses plain text labels (small Unicode glyphs like ✓/✕/⚠ where a
  glance-able marker helps) and the system font, styled with the same
  color tokens (`src/theme.ts`) to stay recognizably "the same app" —
  worth porting the icon set (via `react-native-svg`) and loading the
  webfonts (via `expo-font`) as a follow-up visual-polish pass, the same
  way `customer-web` got one after its first working version.
- **Not run on a real device or simulator/emulator** — this environment
  has neither (no `/dev/kvm` for a hardware-accelerated Android emulator,
  no macOS for an iOS simulator). It was instead verified with a clean
  `tsc --noEmit`, successful Metro bundle exports for both platforms
  (`npx expo export --platform android`, 912 modules; `--platform web`,
  607 modules — no errors either way), and — the closest thing to an
  interactive check available here — driving the real app through Expo's
  web target against a live API (a from-scratch Postgres+PostGIS
  instance, seeded, with the actual NestJS server running) with a
  headless Playwright browser: registered a real account (which
  auto-creates its SELF patient profile, same as the API does for every
  registration), browsed the live catalog, added an item to the cart,
  opened Book a test and confirmed the patient dropdown, cart-derived
  selection, related-items section, and GST-ready summary all render
  correctly, browsed Centers (radius badges, "Use my location", search),
  confirmed "My Lab Tests" render its empty state, and opened Insights
  and confirmed its per-patient empty state — zero JavaScript errors
  across the whole run. The Razorpay `WebView` checkout, PDF
  download/share, and full booking submission (which needs the native
  date/time picker) still need a real device or simulator/emulator pass
  before being treated as field-ready — that's a "hasn't been exercised
  end-to-end here" gap, not a known bug.
