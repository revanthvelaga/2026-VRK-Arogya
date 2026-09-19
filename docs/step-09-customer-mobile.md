# Step 9 — Customer mobile app

## In plain language

Step 8 built a customer web app and proved out the whole booking/tracking
experience against the real API. But the original reason for building a
customer-facing app on React Native in the first place — reaching people
who may not have a reliable desktop or broadband connection, which
matters for the villagers this platform exists to serve — was never
satisfied by a website alone. This step is that phone app.

It's the same core experience as the web app, built natively:

- **Home** — quick-action tiles (Full body packages, Book via Call, Book
  via WhatsApp, Centers near me, Track a sample, My Insights), a
  horizontally-scrolling "Shop by category" row with the same six
  real, hand-picked photos as the web app, and carousels of tests/
  packages you can book straight from.
- **Catalog** — search and browse tests/packages, filtered to a category
  when you arrive from a "shop by category" tile, with the same
  "recommended for X" banner as the web app.
- **Centers** — every diagnostic center, plus a real "use my location"
  search (the phone's actual GPS, via `expo-location`) against the same
  radius search the web app uses.
- **Book a test** — pick tests/packages, a center, how the sample's
  collected (walk-in / pickup point / home visit), and a date & time
  using the phone's native date/time picker. Submits to the exact same
  `POST /bookings` endpoint, with the exact same "the API recomputes the
  real total, this screen's total is a preview" rule.
- **My Bookings / booking detail** — every booking, and on the detail
  screen, the identical sample-tracking stepper (Booked → Collected →
  In transit → At center → In-house/Partner lab → Result ready →
  Delivered) as both other apps — the whole point of tracking is
  everyone, staff and customer, phone and browser, sees the same
  picture.
- **Insights** — the same real numbers as the web app's insights page:
  total bookings, completed count, total spent, tests booked, next
  upcoming booking — computed from the customer's own bookings, nothing
  invented.

## In technical terms

- `apps/mobile` — Expo SDK 57 / React Native 0.86 / React 19, TypeScript,
  scaffolded with `create-expo-app`'s `blank-typescript` template.
- **No backend changes.** Every endpoint this app calls
  (`/auth/*`, `/catalog/*`, `/centers*`, `/pickup-points*`, `/bookings*`,
  `/samples/:id/history`) already existed from steps 1–8; the `audience`
  field on `Test`/`Package` (added during step 8's later pass) just gets
  reused here too.
- **Navigation**: [React Navigation](https://reactnavigation.org) — a
  bottom tab navigator (Home / Catalog / Centers / Bookings) nested
  inside a native stack that also holds Login, Register, Booking,
  Booking detail, and Insights (`@react-navigation/native`,
  `native-stack`, `bottom-tabs`).
- **Session storage**: `@react-native-async-storage/async-storage`
  instead of `localStorage` — `api/client.ts` is the same fetch wrapper
  pattern as the other two apps, with an async `loadSession()`/
  `setSession()` instead of a synchronous one, and a hand-rolled base64
  decode for the JWT payload since `atob` isn't available in the Hermes
  JS runtime.
- **No route-guard primitive.** React Navigation doesn't have an
  equivalent to a React Router `<RequireAuth>` wrapper around a route
  element, so `components/RequireAuth.tsx` renders in place of a
  protected screen's real content while logged out (a "log in to
  continue" prompt with buttons straight to Login/Register) — same idea,
  applied per-screen instead of per-route.
- **Location**: `expo-location`'s `requestForegroundPermissionsAsync()` +
  `getCurrentPositionAsync()` in place of the web app's
  `navigator.geolocation`, feeding the same `/centers/nearby?lat=&lng=`
  endpoint.
- **Date/time picker**: `@react-native-community/datetimepicker` — there's
  no `<input type="datetime-local">` on a phone, so this uses the
  platform's native picker UI instead.
- **Design**: `src/theme.ts` mirrors the same color tokens as
  `admin-web`/`customer-web`'s `index.css` (the light "premium
  healthcare" palette, not a dark theme) — plain `StyleSheet` objects per
  screen/component instead of CSS, since React Native has no CSS engine.
  No custom webfonts or icon set yet (see the app's own README "Known
  gaps" — this is the one deliberate corner cut in this pass, the same
  way `customer-web` shipped a plain first version before its own
  visual-polish pass).
- **Shares its API/domain layer with the other two apps**, copied and
  adapted rather than imported (`api/types.ts`, `lib/format.ts`,
  `lib/useApi.ts`, `lib/segments.ts`, and `components/SampleProgress.tsx`
  re-implemented with RN `View`/`Text` instead of `div`/CSS) — same
  reasoning as before: no shared `packages/ui`/`packages/shared-types`
  yet, flagged as worth extracting once a third app needs the same
  pieces (now literally true — this is that third app).

### Try it

```
cd apps/mobile
npm install
cp .env.example .env
npm start            # scan the QR with Expo Go, or press a/i for a simulator
```

No physical device or simulator/emulator was available in the
environment this was built in (no `/dev/kvm`, no macOS). It was verified
three ways instead: a clean `tsc --noEmit`; a successful Metro bundle
export (`npx expo export --platform android`, 888 modules, no errors);
and, closest to an actual interactive run, driving the real app through
Expo's web target (`react-native-web`) in a headless browser against the
live API — registered a real account, browsed real catalog/center data,
and confirmed the booking screen correctly preselects a tapped item,
runs a live total, and lets you pick a center and collection mode. The
one thing that couldn't be exercised this way is the date/time step:
`@react-native-community/datetimepicker` has no web implementation, so
full booking submission is still unverified end-to-end — that's a gap in
this verification, not a known bug, but it means a real Expo Go/simulator
run is still needed before treating this as field-ready.

## What's next

Step 10 (build order item 10) is **notifications (push/SMS) + report PDF
upload/download**. Push notifications in particular now have a real
place to land — this app's booking/sample-status screens are exactly
what a "your sample has been collected" or "your results are ready" push
would deep-link into.
