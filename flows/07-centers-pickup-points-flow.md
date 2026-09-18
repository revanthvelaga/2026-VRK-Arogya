# Centers & pickup points flow — "find near me" and radius validation

## Nearby search (customer finding a pickup point)

```mermaid
sequenceDiagram
    actor C as Customer (has GPS lat/lng)
    participant Ctrl as PickupPointsController
    participant Svc as PickupPointsService
    participant DB as PostgreSQL + PostGIS

    C->>Ctrl: GET /pickup-points/nearby?lat=17.68&lng=83.21&radiusKm=10
    Ctrl->>Svc: findNearby(lat, lng, radiusKm)
    Svc->>DB: SELECT *, ST_Distance(location, point)/1000 AS distance_km<br/>FROM pickup_points<br/>WHERE is_active = true<br/>AND ST_DWithin(location, point, radiusKm * 1000)<br/>ORDER BY distance_km ASC
    Note right of DB: ST_DWithin does the radius filter using the<br/>GIST spatial index — fast even with many rows
    DB-->>Svc: rows, nearest first, each with distance_km
    Svc-->>Ctrl: PickupPoint[] & distanceKm
    Ctrl-->>C: 200 OK + JSON, sorted nearest-first
```

## Admin adds a pickup point — radius validation

```mermaid
sequenceDiagram
    actor A as Admin
    participant Ctrl as PickupPointsController
    participant Svc as PickupPointsService
    participant Centers as centers table
    participant DB as PostGIS

    A->>Ctrl: POST /pickup-points<br/>{ centerId, name, latitude, longitude }
    Ctrl->>Svc: create(dto)
    Svc->>Centers: SELECT * FROM diagnostic_centers WHERE id = centerId
    alt center not found
        Centers-->>Svc: no row
        Svc-->>Ctrl: throw NotFoundException
        Ctrl-->>A: 404 Not Found
    end
    Svc->>DB: SELECT ST_Distance(center_point, pickup_point)/1000
    DB-->>Svc: distanceKm
    alt distanceKm > center.serviceRadiusKm
        Svc-->>Ctrl: throw BadRequestException<br/>"Pickup point is Xkm from the center,<br/>outside its Ykm service radius"
        Ctrl-->>A: 400 Bad Request
    end
    Svc->>DB: INSERT INTO pickup_points (..., distance_km)
    DB-->>Svc: saved PickupPoint
    Svc-->>Ctrl: PickupPoint
    Ctrl-->>A: 201 Created
```

## Why this matters

The distance check is never trusted to the client — a customer's phone
or an admin's form could send any `latitude`/`longitude`, so the API
always recomputes the real distance in PostGIS (`ST_Distance` on
`geography` columns, which accounts for the Earth's curvature) before
accepting or rejecting the write. The same pattern — **recompute,
don't trust** — shows up again in the booking flow for prices; see
[`08-booking-flow.md`](./08-booking-flow.md).
