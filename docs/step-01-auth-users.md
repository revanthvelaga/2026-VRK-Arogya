# Step 1 — Foundation: database schema + login system

## In plain language

Every app needs two things before anything else can be built: a place to
store data, and a way for people to prove who they are (log in). This step
built both.

- **The database blueprint** (`schema.sql`) — a complete list of every
  piece of information the app will ever need to store: customers, staff,
  diagnostic centers, tests, bookings, samples, reports, and so on. Think
  of it as the filing-cabinet layout before any files are put in.
- **The login system** — customers, staff, and admins can create an
  account with their name, phone number, and a password, and log in.
  Each account is tagged with a role (`ADMIN`, `STAFF`, or `CUSTOMER`) so
  the app can later decide what each type of person is allowed to do
  (e.g. only admins can add new lab tests).

Nothing customer-facing exists yet — no screens, no booking. This is the
plumbing underneath.

## In technical terms

- `schema.sql` — full PostgreSQL + PostGIS schema for the platform:
  `users`, `diagnostic_centers`, `pickup_points`, `pickup_point_schedules`,
  `partner_labs`, `tests`, `packages`, `package_tests`, `bookings`,
  `booking_items`, `samples`, `sample_status_history`, `reports`. PostGIS's
  `GEOGRAPHY(POINT, 4326)` type is used wherever a real-world lat/lng is
  stored, so radius queries (`ST_DWithin`) work natively.
- `docker-compose.yml` — a local `postgis/postgis:16-3.4` container for
  development.
- `apps/api` — a NestJS backend skeleton:
  - `users` module — `User` TypeORM entity + `UsersService` (create,
    find by phone/id, bcrypt password hashing/verification).
  - `auth` module — `POST /auth/register` and `POST /auth/login`, issuing
    a short-lived JWT **access token** and a longer-lived **refresh
    token**, both signed with secrets from `.env`. Public self-registration
    is always forced to the `CUSTOMER` role in `AuthService`.
  - `common` — the `Role` enum, a `@Roles(...)` decorator, and two guards
    (`JwtAuthGuard`, `RolesGuard`) that later modules attach to protected
    routes.
  - `synchronize: true` is on for dev, so TypeORM creates/updates tables
    from the entity decorators automatically — turn this off and use
    migrations before production.

### Try it

```bash
docker compose up -d
cd apps/api && npm install
cp .env.example .env
npm run start:dev
```

```
POST /auth/register  { "fullName": "Jane Doe", "phone": "9999999999", "password": "secret123" }
POST /auth/login      { "phone": "9999999999", "password": "secret123" }
```

Both return `{ accessToken, refreshToken, role }`.

## What's next

Step 2 builds the **catalog** — the list of lab tests and packages
customers can browse and admins can manage.
