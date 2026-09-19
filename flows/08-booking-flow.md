# Booking flow — every validation step, in order

**Pairs with:** [`flows/drawio/05-bookings-trace.drawio`](./drawio/05-bookings-trace.drawio)

## Objective

Create a booking that validates and prices itself entirely from **live
server data** — never a client-submitted price, and never an assumed
relationship between center/pickup point/items — then write the booking
and all its items in one atomic transaction. This is the one place in
the codebase where Bookings, Catalog, and Centers all meet.

## Classes / entities / DTOs used

| Layer | Name | Role |
|---|---|---|
| Controller | `BookingsController` | `POST /bookings`, `GET /bookings`, `GET /bookings/mine`, `GET /bookings/:id`, `PATCH /bookings/:id/cancel`, `PATCH /bookings/:id/status` |
| Service | `BookingsService` | orchestrates — calls `CentersService`, `PickupPointsService`, `TestsService`, `PackagesService` (imports their modules, never touches their tables directly) |
| DTO | `CreateBookingDto` | `centerId`, `collectionMode`, `pickupPointId?`, `scheduledAt`, `items: [{testId} \| {packageId}]` |
| Entity | `Booking` | `@Entity('bookings')` |
| Entity | `BookingItem` | `@Entity('booking_items')`, exactly one of `testId`/`packageId` set |

## Tables used

| Table | Operations |
|---|---|
| `diagnostic_centers` | `SELECT` (read-only validation lookup) |
| `pickup_points` | `SELECT` (read-only validation lookup, only if `collectionMode = PICKUP_POINT`) |
| `tests` | `SELECT` per item that has a `testId` |
| `packages` | `SELECT` per item that has a `packageId` |
| `bookings` | `INSERT` |
| `booking_items` | `INSERT` × N (one per item), same transaction as the `bookings` insert |

## Conditions checked

Every row below is a real `alt` branch in `BookingsService.create()` — in
this order:

| # | Condition | Outcome |
|---|---|---|
| 1 | `centerId` doesn't resolve to a real center | `404 Not Found` |
| 2 | Center exists but `isActive === false` | `400 Bad Request` |
| 3 | `collectionMode === PICKUP_POINT` but `pickupPointId` missing | `400 Bad Request` |
| 4 | `pickupPointId` set but inactive, or belongs to a **different** center than `centerId` | `400 Bad Request` |
| 5 | `collectionMode` is `WALK_IN`/`HOME_VISIT` but `pickupPointId` was sent anyway | `400 Bad Request` |
| 6 | `scheduledAt` isn't a valid, **future** date/time | `400 Bad Request` |
| 7 | Per item: neither or **both** of `testId`/`packageId` set | `400 Bad Request` |
| 8 | Item's `testId`/`packageId` not found, or found but inactive | `404` / `400` |
| 9 | Price for every item is read from **today's catalog row**, never the request body | not a rejection — the pricing invariant the whole flow exists to protect |
| 10 | Everything from the `bookings` insert onward runs in **one DB transaction** | either the booking + all its items are saved, or none of them are |

### After creation — booking-level status

```mermaid
graph LR
    Pending([PENDING]) -->|admin/staff:<br/>PATCH status CONFIRMED| Confirmed([CONFIRMED])
    Pending -->|owner or admin/staff:<br/>PATCH cancel| Cancelled([CANCELLED])
    Confirmed -->|owner or admin/staff:<br/>PATCH cancel| Cancelled
    Confirmed -->|admin/staff:<br/>PATCH status COMPLETED| Completed([COMPLETED])
```

Cancelling is only allowed from `PENDING` or `CONFIRMED` — a `COMPLETED`
or already-`CANCELLED` booking rejects further cancellation with
`400 Bad Request`. This is a **separate, coarser** status chain from each
sample's own lifecycle — see [`09-sample-lifecycle-flow.md`](./09-sample-lifecycle-flow.md).

## How it flows

```mermaid
sequenceDiagram
    actor C as Customer
    participant Ctrl as BookingsController
    participant Svc as BookingsService
    participant Centers as CentersService
    participant Pickup as PickupPointsService
    participant Tests as TestsService
    participant Pkgs as PackagesService
    participant DB as PostgreSQL

    C->>Ctrl: POST /bookings<br/>{ centerId, collectionMode, pickupPointId?,<br/>scheduledAt, items: [{testId} | {packageId}] }
    Ctrl->>Svc: create(customerId, dto)

    Svc->>Centers: findOne(centerId)
    alt center not found
        Centers-->>Svc: throw NotFoundException
        Svc-->>C: 404 Not Found
    end
    alt center.isActive === false
        Svc-->>C: 400 Bad Request "center is not active"
    end

    alt collectionMode === PICKUP_POINT
        alt pickupPointId missing
            Svc-->>C: 400 Bad Request "pickupPointId is required"
        end
        Svc->>Pickup: findOne(pickupPointId)
        alt inactive OR belongs to a different center
            Svc-->>C: 400 Bad Request "pickup point not found for this center"
        end
    else collectionMode is WALK_IN or HOME_VISIT
        alt pickupPointId was set anyway
            Svc-->>C: 400 Bad Request "pickupPointId only valid for PICKUP_POINT"
        end
    end

    Svc->>Svc: parse scheduledAt
    alt not a valid future date/time
        Svc-->>C: 400 Bad Request "scheduledAt must be a valid future date/time"
    end

    loop for each item in dto.items
        alt neither or both of testId/packageId set
            Svc-->>C: 400 Bad Request "exactly one of testId or packageId"
        end
        alt item has testId
            Svc->>Tests: findOne(testId)
            alt not found or inactive
                Svc-->>C: 404 / 400
            end
            Note right of Svc: price = test.price — the CURRENT<br/>catalog price, never client-submitted
        else item has packageId
            Svc->>Pkgs: findOne(packageId)
            alt not found or inactive
                Svc-->>C: 404 / 400
            end
            Note right of Svc: price = package.price
        end
    end

    Svc->>Svc: totalAmount = sum(item prices)

    rect rgb(230, 240, 255)
    Note over Svc,DB: everything below runs in ONE database transaction
    Svc->>DB: INSERT INTO bookings (..., status='PENDING', total_amount)
    Svc->>DB: INSERT INTO booking_items (...) x N
    end

    DB-->>Svc: Booking with items[]
    Svc-->>Ctrl: Booking
    Ctrl-->>C: 201 Created + JSON
```
