# Step 4 — Booking flow: turning a catalog + a location into an order

## In plain language

This is the step where the app becomes usable end-to-end for a customer.
A logged-in customer can now:

1. Pick one or more tests and/or packages from the catalog.
2. Choose how the sample gets collected: **walk in** to the diagnostic
   center, get picked up at a **pickup point**, or a **home visit**.
3. Pick a date/time.
4. Submit it — the app checks everything makes sense (the center is real
   and active, the pickup point actually belongs to that center, the
   tests/packages are real and still offered, the time isn't in the past)
   and calculates the total price itself, using today's catalog prices —
   never a price the customer's device sends.

The customer can see their own bookings and cancel one that hasn't been
completed yet. Admins and staff can see every booking (they'll need this
to run the lab) and move a booking's status forward
(`PENDING → CONFIRMED → COMPLETED`, or `CANCELLED`).

## In technical terms

- `apps/api/src/bookings` — a new NestJS module:
  - **`Booking`** entity — `customerId`, `centerId`, `pickupPointId`
    (nullable), `collectionMode` (`WALK_IN` / `PICKUP_POINT` /
    `HOME_VISIT`), `scheduledAt`, `status` (`PENDING` / `CONFIRMED` /
    `CANCELLED` / `COMPLETED`), `totalAmount`, with a `OneToMany` to...
  - **`BookingItem`** entity — `bookingId`, and exactly one of `testId` /
    `packageId`, plus the `price` that was charged for it at booking time
    (a price snapshot, so later catalog price changes don't rewrite
    history).
  - New shared enums: `CollectionMode`, `BookingStatus` (in
    `common/enums`), matching `schema.sql`'s `collection_mode` and
    `booking_status` types.
  - A `CurrentUser` param decorator (`common/decorators`) pulls the
    authenticated user off the request, typed via a new
    `AuthenticatedUser` interface (`common/types`) that mirrors what
    `JwtStrategy.validate()` already returns.
- **`BookingsService.create()`** does all the real work, and trusts
  nothing from the client except IDs:
  1. Loads the center via `CentersService`, rejects if inactive.
  2. If `collectionMode` is `PICKUP_POINT`, requires `pickupPointId`,
     loads it via `PickupPointsService`, and rejects if it's inactive or
     doesn't belong to the given center. Rejects `pickupPointId` being
     set for any other mode.
  3. Rejects a `scheduledAt` that isn't a valid future timestamp.
  4. For each item, requires exactly one of `testId`/`packageId`, loads
     the real record via `TestsService`/`PackagesService`, rejects it if
     inactive, and takes its **current price** — the client-submitted
     price (there isn't one) is never used.
  5. Sums the item prices into `totalAmount` and saves the booking + its
     items in one database transaction (`DataSource.transaction`), so a
     booking is never left half-written.
  - Reusing `CentersService`/`PickupPointsService`/`TestsService`/
    `PackagesService` (rather than injecting their repositories directly)
    keeps a single source of truth for "what does this ID resolve to and
    is it valid" — `BookingsModule` imports `CatalogModule` and
    `CentersModule` to get access to their exported services.
- Endpoints (see `bookings.controller.ts`), all behind `JwtAuthGuard`:
  - `POST /bookings` — any authenticated user, books for themselves
    (`customerId` comes from the JWT, never the request body).
  - `GET /bookings/mine` — the caller's own bookings.
  - `GET /bookings` — `ADMIN`/`STAFF` only, every booking.
  - `GET /bookings/:id`, `PATCH /bookings/:id/cancel` — the booking's
    owner, or `ADMIN`/`STAFF`; anyone else gets `403 Forbidden`.
  - `PATCH /bookings/:id/status` — `ADMIN`/`STAFF` only.
  - Cancelling only works while the booking is `PENDING` or `CONFIRMED`.

### Try it

```
POST /bookings   (Authorization: Bearer <customer access token>)
{
  "centerId": "<center-id>",
  "collectionMode": "PICKUP_POINT",
  "pickupPointId": "<pickup-point-id>",
  "scheduledAt": "2026-09-25T09:00:00Z",
  "items": [
    { "testId": "<test-id>" },
    { "packageId": "<package-id>" }
  ]
}

GET  /bookings/mine
PATCH /bookings/<id>/cancel

PATCH /bookings/<id>/status   (ADMIN/STAFF)
{ "status": "CONFIRMED" }
```

## What's next

Step 6 (build order item 6) is the **sample lifecycle** — once a booking
is confirmed, tracking the physical specimen through
`BOOKED → COLLECTED → IN_TRANSIT_TO_CENTER → AT_CENTER → ... →
RESULT_READY → DELIVERED`, with staff updating status as it moves.
