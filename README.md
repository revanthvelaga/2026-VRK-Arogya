# Arogya — Diagnostic Lab Booking Platform

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full system design.

**New here?** Read [`docs/`](./docs) — one short write-up per delivered step,
in plain language, with no coding background assumed.

**Want to see how it fits together?** [`flows/`](./flows) has pictorial
diagrams — the full database ER diagram, the module dependency graph, a
class-level diagram, and a sequence diagram for every feature flow
(auth, catalog, centers/pickup points, booking, sample lifecycle,
partner-lab routing), rendered inline by GitHub. For editable,
draw.io-style boxes-and-arrows versions — every API endpoint traced URI →
guard → DTO → controller → service → DB table → response, plus a
server/firewall/deployment diagram — see [`flows/drawio/`](./flows/drawio).

## Repo layout

```
arogya/
├── apps/
│   ├── mobile/          # React Native (Expo) customer + staff app — not started yet
│   ├── customer-web/     # React customer site — browse, book, track a sample
│   ├── admin-web/        # React admin dashboard
│   └── api/              # NestJS backend
├── packages/
│   └── shared-types/     # Shared TS interfaces (DTOs) — not started yet
├── docs/                  # Plain-language + technical write-up per step
├── flows/                 # Pictorial diagrams: ERD, module graph, class diagram, feature flows
├── schema.sql             # PostGIS-enabled DB schema (reference / manual apply)
├── docker-compose.yml     # local Postgres+PostGIS
└── .github/workflows/     # CI: lint, test, build on push — not started yet
```

## Status

- [x] Database schema (PostGIS-enabled) + ERD — [`docs/step-01-auth-users.md`](./docs/step-01-auth-users.md)
- [x] NestJS API skeleton: auth module + roles + users — [`docs/step-01-auth-users.md`](./docs/step-01-auth-users.md)
- [x] Catalog module (tests, packages, admin CRUD) — [`docs/step-02-catalog.md`](./docs/step-02-catalog.md)
- [x] Diagnostic center + pickup-point module with radius search — [`docs/step-03-centers-pickup-points.md`](./docs/step-03-centers-pickup-points.md)
- [x] Booking flow — [`docs/step-04-bookings.md`](./docs/step-04-bookings.md)
- [x] Sample lifecycle + admin status updates — [`docs/step-05-sample-lifecycle.md`](./docs/step-05-sample-lifecycle.md)
- [x] Partner-lab routing + SLA tracking — [`docs/step-06-partner-lab-routing.md`](./docs/step-06-partner-lab-routing.md)
- [x] Admin web dashboard — [`docs/step-07-admin-web-dashboard.md`](./docs/step-07-admin-web-dashboard.md)
- [x] Customer web app (added ahead of the mobile app, same endpoints) — [`docs/step-08-customer-web.md`](./docs/step-08-customer-web.md)
- [ ] Customer mobile app
- [ ] Notifications (push/SMS) + report PDF upload/download
- [ ] Dockerize + GitHub Actions CI, deployment guide

## Running the API locally

1. `docker compose up -d` — starts Postgres+PostGIS on port 5432
2. `cd apps/api && npm install`
3. `cp .env.example .env` and adjust secrets
4. `npm run start:dev` — API on http://localhost:3000
   - `synchronize: true` in `app.module.ts` auto-creates tables from the
     TypeORM entities on first run (dev convenience — switch to proper
     migrations before production). `schema.sql` is the PostGIS reference
     for tables not yet modeled as entities.

### Try it

```
POST /auth/register  { "fullName": "...", "phone": "9999999999", "password": "..." }
POST /auth/login      { "phone": "9999999999", "password": "..." }
```

Both return `{ accessToken, refreshToken, role }`. Use `Authorization: Bearer <accessToken>`
on protected routes.

```
GET    /catalog/tests           # public
GET    /catalog/packages        # public
POST   /catalog/tests           # ADMIN only
PATCH  /catalog/tests/:id       # ADMIN only
DELETE /catalog/tests/:id       # ADMIN only
POST   /catalog/packages        # ADMIN only
PATCH  /catalog/packages/:id    # ADMIN only
DELETE /catalog/packages/:id    # ADMIN only

GET    /centers                       # public
GET    /centers/nearby?lat=&lng=      # public — centers that cover this point
POST   /centers                       # ADMIN only
PATCH  /centers/:id                   # ADMIN only
DELETE /centers/:id                   # ADMIN only

GET    /pickup-points?centerId=       # public
GET    /pickup-points/nearby?lat=&lng=&radiusKm=   # public
POST   /pickup-points                 # ADMIN only
PATCH  /pickup-points/:id             # ADMIN only
DELETE /pickup-points/:id             # ADMIN only
POST   /pickup-points/:id/schedules   # ADMIN only

POST   /bookings              # any authenticated user — books for themselves
GET    /bookings/mine         # any authenticated user — their own bookings
GET    /bookings              # ADMIN/STAFF only — all bookings
GET    /bookings/:id          # owner, or ADMIN/STAFF
PATCH  /bookings/:id/cancel   # owner, or ADMIN/STAFF
PATCH  /bookings/:id/status   # ADMIN/STAFF only

POST   /bookings/:bookingId/samples   # ADMIN/STAFF only — seeds one sample per booking item
GET    /bookings/:bookingId/samples   # owner, or ADMIN/STAFF
PATCH  /samples/:id/status            # ADMIN/STAFF only — moves one sample forward
GET    /samples/:id/history           # owner, or ADMIN/STAFF — full status audit trail
GET    /partner-labs/:id/sla          # ADMIN/STAFF only — turnaround target vs. actual per sample

GET    /partner-labs           # ADMIN/STAFF only
GET    /partner-labs/:id       # ADMIN/STAFF only
POST   /partner-labs           # ADMIN only
PATCH  /partner-labs/:id       # ADMIN only
```

See [`docs/`](./docs) for detailed, step-by-step explanations of each module.

## Running the admin web console locally

With the API already running (above):

1. `cd apps/admin-web && npm install`
2. `cp .env.example .env`
3. `npm run dev` — console on http://localhost:5173

See [`apps/admin-web/README.md`](./apps/admin-web/README.md) — including
how to get an `ADMIN` account to sign in with, since public registration
always creates a `CUSTOMER`.

## Running the customer web app locally

With the API already running (above):

1. `cd apps/customer-web && npm install`
2. `cp .env.example .env`
3. `npm run dev` — site on http://localhost:5174 (a different port from
   `admin-web`'s 5173, so both can run side by side)

Anyone can register here — public sign-up is always a `CUSTOMER` account.
See [`apps/customer-web/README.md`](./apps/customer-web/README.md).
