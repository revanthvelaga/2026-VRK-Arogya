# Arogya — Diagnostic Lab Booking Platform

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full system design.

## Repo layout

```
arogya/
├── apps/
│   ├── mobile/          # React Native (Expo) customer + staff app — not started yet
│   ├── admin-web/        # React admin dashboard — not started yet
│   └── api/              # NestJS backend
├── packages/
│   └── shared-types/     # Shared TS interfaces (DTOs) — not started yet
├── schema.sql             # PostGIS-enabled DB schema (reference / manual apply)
├── docker-compose.yml     # local Postgres+PostGIS
└── .github/workflows/     # CI: lint, test, build on push — not started yet
```

## Status

- [x] Database schema (PostGIS-enabled) + ERD
- [x] NestJS API skeleton: auth module + roles + users
- [x] Catalog module (tests, packages, admin CRUD)
- [ ] Diagnostic center + pickup-point module with radius search
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
```
