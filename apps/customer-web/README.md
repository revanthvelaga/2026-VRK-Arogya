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
staff sign into.

- `/` — marketing home page: hero, "how it works", catalog teaser.
- `/catalog` — public browse of tests and packages, each linking straight
  into `/book` with that item pre-selected (via React Router `state`).
- `/centers` — public browse, plus a real "use my location"
  (`navigator.geolocation`) search against `GET /centers/nearby`.
- `/book` (auth required) — the booking form: item selection, center,
  collection mode (walk-in/pickup point/home visit, with the pickup-point
  dropdown filtered to the chosen center), date/time, and a sticky order
  summary. Submits straight to `POST /bookings`.
- `/bookings`, `/bookings/:id` (auth required) — a customer's own bookings
  and, on the detail page, the same `SampleProgress` stepper `admin-web`
  built for staff — the whole point of tracking is that both sides see the
  same picture.

## Known gaps (by design, for now)

- **No shared cart across pages.** `/book` does its own item selection
  rather than reading a global "selected items" state — simpler, and
  avoids needing a cross-page store for an MVP with one booking form.
- **No payment step.** Bookings are created unpaid, same as the API
  supports today; a payment gateway is a later step in the build order.
- **Mobile nav is a horizontal scroll strip, not a hamburger menu**, below
  860px — functional, not polished; worth a real mobile nav pattern later.
