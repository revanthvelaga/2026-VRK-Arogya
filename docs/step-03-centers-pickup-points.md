# Step 3 — Diagnostic centers, pickup points, and "find one near me"

## In plain language

A lab has one home base (the **diagnostic center**) and serves a region
around it — say, a 20km radius. Within that region, the lab arranges
**pickup points**: village panchayat offices or similar spots where staff
show up on a schedule (e.g. "every Tuesday, 9–11 AM") to collect samples
from customers who can't come in person.

This step adds:
- A way for admins to register a diagnostic center (with its location and
  service radius) and its pickup points.
- A safety check: a pickup point can't be added if it's actually outside
  the center's stated service radius — the app calculates the real-world
  distance and rejects it if it's too far, instead of silently accepting
  a mistake.
- A **"find near me"** search: given a customer's location (from their
  phone's GPS, for example), the app can answer "which centers cover me?"
  and "which pickup points are close enough for me to use?" — sorted
  nearest-first.
- A way to attach a recurring visit schedule to each pickup point.

## In technical terms

- `apps/api/src/centers` — a new NestJS module:
  - **`DiagnosticCenter`** entity — `name`, `address`, `location`
    (PostGIS `geography(Point, 4326)`), `serviceRadiusKm`, `ownerId`,
    `isActive`. (`is_active` was added to `diagnostic_centers` in
    `schema.sql` alongside this entity, mirroring the pattern already used
    for pickup points, tests, and packages.)
  - **`PickupPoint`** entity — `centerId`, `name`, `location`,
    `villageName`, `distanceKm` (cached), `isActive`.
  - **`PickupPointSchedule`** entity — `pickupPointId`, `dayOfWeek`
    (0–6), `startTime`, `endTime`.
  - `location` columns use TypeORM's native `geography`/`Point` column
    type, so entities read/write plain GeoJSON
    (`{ type: 'Point', coordinates: [lng, lat] }`) — TypeORM handles the
    `ST_AsGeoJSON` / `ST_GeomFromGeoJSON` conversion automatically.
- **Radius validation** (`PickupPointsService`) — on create/update, the
  real distance between the pickup point and its center is computed with
  a raw `ST_Distance(...)::geography` query; if it exceeds
  `serviceRadiusKm`, the request is rejected with `400 Bad Request`.
- **Nearby search** — both `CentersService.findNearby()` and
  `PickupPointsService.findNearby()` use PostGIS `ST_DWithin` (fast,
  index-friendly radius filter) combined with `ST_Distance` for
  nearest-first ordering, built with TypeORM's `QueryBuilder` so the raw
  SQL functions can be mixed with normal entity mapping.
- Endpoints (see `centers.controller.ts` / `pickup-points.controller.ts`):
  - `GET /centers`, `GET /centers/nearby?lat=&lng=` — public.
  - `GET /pickup-points?centerId=`, `GET /pickup-points/nearby?lat=&lng=&radiusKm=` — public.
  - `GET /pickup-points/:id/schedules` — public.
  - All writes (`POST`/`PATCH`/`DELETE` on centers, pickup points, and
    schedules) — `ADMIN` only.
  - `DELETE` on centers/pickup points is a soft delete (`isActive = false`),
    consistent with the catalog module.

### Try it

```
GET /centers/nearby?lat=17.6868&lng=83.2185
GET /pickup-points/nearby?lat=17.6868&lng=83.2185&radiusKm=10

POST /centers            (ADMIN)
{ "name": "Arogya Diagnostics HQ", "latitude": 17.6868, "longitude": 83.2185, "serviceRadiusKm": 20 }

POST /pickup-points       (ADMIN)
{ "centerId": "<center-id>", "name": "Rachapalle Panchayat Office", "latitude": 17.71, "longitude": 83.25 }
# rejected with 400 if that point is further than the center's serviceRadiusKm

POST /pickup-points/:id/schedules   (ADMIN)
{ "dayOfWeek": 2, "startTime": "09:00", "endTime": "11:00" }
```

## What's next

Step 5 (build order item 5) is the **booking flow** — letting a customer
pick tests/packages and a collection mode (walk-in, pickup point, or home
visit), which is what `bookings` and `booking_items` in `schema.sql` exist
for.
