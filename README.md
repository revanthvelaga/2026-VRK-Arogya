# Arogya — Diagnostic Lab Booking Platform

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full system design.

**New here?** Read [`docs/`](./docs) — one short write-up per delivered step,
in plain language, with no coding background assumed.

## Repo layout

```
arogya/
├── apps/
│   ├── mobile/          # React Native (Expo) customer + staff app — not started yet
│   ├── admin-web/        # React admin dashboard — not started yet
│   └── api/              # NestJS backend
├── packages/
│   └── shared-types/     # Shared TS interfaces (DTOs) — not started yet
├── docs/                  # Plain-language + technical write-up per step
├── schema.sql             # PostGIS-enabled DB schema (reference / manual apply)
├── docker-compose.yml     # local Postgres+PostGIS
└── .github/workflows/     # CI: lint, test, build on push — not started yet
```

## Status

- [x] Database schema (PostGIS-enabled) + ERD — [`docs/step-01-auth-users.md`](./docs/step-01-auth-users.md)
- [x] NestJS API skeleton: auth module + roles + users — [`docs/step-01-auth-users.md`](./docs/step-01-auth-users.md)
- [x] Catalog module (tests, packages, admin CRUD) — [`docs/step-02-catalog.md`](./docs/step-02-catalog.md)
- [x] Diagnostic center + pickup-point module with radius search — [`docs/step-03-centers-pickup-points.md`](./docs/step-03-centers-pickup-points.md)
- [ ] Booking flow
- [ ] Sample lifecycle + admin status updates
- [ ] Partner-lab routing + SLA tracking
- [ ] Admin web dashboard
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
```

See [`docs/`](./docs) for detailed, step-by-step explanations of each module.
