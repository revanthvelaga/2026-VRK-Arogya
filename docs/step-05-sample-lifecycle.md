# Step 5 — Sample lifecycle: tracking the physical specimen

## In plain language

A booking is just a promise to collect a sample. This step tracks the
*actual physical thing* — the blood tube, the swab, whatever gets
collected — from the moment a staff member picks it up to the moment the
report is handed back.

Once a booking is confirmed, staff (or an admin) tell the system "start
tracking this booking's samples" — one sample record is created per test
or package ordered, because each one might travel and finish at a
different time.

From there, a staff member moves each sample forward, one stage at a
time, as it actually happens in the real world:

```
BOOKED → COLLECTED → IN_TRANSIT_TO_CENTER → AT_CENTER
       → (IN_HOUSE_PROCESSING  or  ROUTED_TO_PARTNER_LAB)
       → RESULT_READY → DELIVERED
```

`AT_CENTER` is the one fork in the road: a test the lab can run itself
goes `IN_HOUSE_PROCESSING`; a test that has to go to the Visakhapatnam
partner lab (step 6) goes `ROUTED_TO_PARTNER_LAB` instead. Both paths meet
back up at `RESULT_READY`.

The system won't let a status jump backward or skip a stage — a sample
that's still `BOOKED` can't suddenly become `RESULT_READY`. Every change
is also written to a permanent history log, so there's a timestamped
paper trail of exactly who moved a sample from what to what, and when —
useful for both customer support ("where's my sample right now?") and
audits.

The customer who owns the booking can see their samples' status and full
history at any time; only staff/admin can actually move a status forward.

## In technical terms

- `apps/api/src/samples` — a new NestJS module:
  - **`Sample`** entity — `bookingId`, `bookingItemId` (one sample per
    booking item), `collectedBy` (nullable, set once collected),
    `status` (`SampleStatus`, defaults to `BOOKED`), `collectedAt`,
    `routedToPartnerLabId` (plain nullable id — no `PartnerLab` entity
    yet, that's step 6), `expectedResultAt`, `updatedAt`.
  - **`SampleStatusHistory`** entity — one append-only row per status
    change: `sampleId`, `status`, `changedBy`, `changedAt`, `notes`.
  - New shared enum: `SampleStatus` (`common/enums`), matching
    `schema.sql`'s `sample_status` type.
- **`SamplesService`** is where the lifecycle rule actually lives — an
  `ALLOWED_TRANSITIONS` map from each status to the status(es) it's
  legal to move to next. `updateStatus()` looks up the sample's current
  status, checks the requested status is in that list, and rejects the
  request with `400 Bad Request` otherwise. Moving to `COLLECTED`
  additionally stamps `collectedBy`/`collectedAt` from the authenticated
  staff user. Every status change — including the initial `BOOKED` row
  created at initialization — is written to `SampleStatusHistory` in the
  same database transaction as the `Sample` update, so the two can never
  drift apart.
  - `initializeForBooking()` reuses `BookingsService.findOne()` to load
    the booking with its items, and refuses to run twice for the same
    booking (`400` if samples already exist).
  - `findForBooking()` / `getHistory()` reuse
    `BookingsService.findOneForUser()` — the same owner-or-staff/admin
    check bookings already enforce — so a customer can only ever see
    their own samples.
  - `SamplesModule` imports `BookingsModule` to get `BookingsService`,
    rather than duplicating the booking-ownership logic.
- Endpoints (see `samples.controller.ts`), all behind `JwtAuthGuard`:
  - `POST /bookings/:bookingId/samples` — `ADMIN`/`STAFF` only, seeds one
    `Sample` per item on that booking.
  - `GET /bookings/:bookingId/samples` — the booking's owner, or
    `ADMIN`/`STAFF`.
  - `PATCH /samples/:id/status` — `ADMIN`/`STAFF` only, moves one sample
    forward and logs the change.
  - `GET /samples/:id/history` — the booking's owner, or `ADMIN`/`STAFF`
    — the full audit trail for one sample.

### Try it

```
POST /bookings/<id>/samples          (ADMIN/STAFF)

GET  /bookings/<id>/samples          (owner, or ADMIN/STAFF)

PATCH /samples/<id>/status           (ADMIN/STAFF)
{ "status": "COLLECTED", "notes": "collected at pickup point 9am round" }

GET  /samples/<id>/history           (owner, or ADMIN/STAFF)
```

## What's next

Step 6 (build order item 7) is **partner-lab routing + SLA tracking** —
modeling `PartnerLab` as a real entity, wiring `routedToPartnerLabId` up
to it, and tracking turnaround time (target vs. actual) for anything sent
out to Visakhapatnam.
