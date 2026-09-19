# Sample lifecycle — the physical specimen's own status chain

**Pairs with:** [`flows/drawio/07-samples-trace.drawio`](./drawio/07-samples-trace.drawio)

## Objective

Track each physical sample — one per booking item — through a strict,
mostly one-way status chain that mirrors what actually happens to the
specimen (collected → transported → processed → delivered), completely
separate from the booking's own coarser status
(`PENDING → CONFIRMED → COMPLETED`, see
[`08-booking-flow.md`](./08-booking-flow.md)). No status can be skipped
or reversed — a lookup table enforces every legal move.

## Classes / entities / DTOs used

| Layer | Name | Role |
|---|---|---|
| Controller | `SamplesController` | `POST /bookings/:id/samples`, `GET /bookings/:id/samples`, `PATCH /samples/:id/status`, `GET /samples/:id/history` |
| Service | `SamplesService` | owns `samples`/`sample_status_history`; calls `BookingsService.findOneForUser()` for ownership checks — doesn't reimplement that rule |
| DTO | `UpdateSampleStatusDto` | `status`, `notes?` (and `partnerLabId`/`turnaroundHoursOverride` for the `ROUTED_TO_PARTNER_LAB` transition — see [`10-partner-lab-routing-flow.md`](./10-partner-lab-routing-flow.md)) |
| Entity | `Sample` | `@Entity('samples')` — one row per `booking_item` |
| Entity | `SampleStatusHistory` | `@Entity('sample_status_history')` — append-only audit trail, one row per transition |

## Tables used

| Table | Operations |
|---|---|
| `booking_items` | `SELECT` (to know how many samples to seed on init) |
| `samples` | `SELECT` (count check on init, lookup on status update) · `INSERT` × N (init) · `UPDATE` (status, and `collected_by`/`collected_at` when moving to `COLLECTED`) |
| `sample_status_history` | `INSERT` per transition (init writes one `BOOKED` row per sample too) |

## Conditions checked

| # | Condition | Outcome |
|---|---|---|
| 1 | Initialize: samples already exist for this booking | `400 Bad Request` "already initialized" — init is one-shot |
| 2 | Status update: requested status not in `ALLOWED_TRANSITIONS[current status]` | `400 Bad Request` "cannot move from X to Y" — **whatever role is asking**, this is never bypassable |
| 3 | Moving to `COLLECTED` | also stamps `collectedBy` + `collectedAt` on the row — not a separate call |
| 4 | `AT_CENTER` is the **only fork** in the chain | branches to either `IN_HOUSE_PROCESSING` or `ROUTED_TO_PARTNER_LAB`; every other step is strictly linear |

### The chain itself

```mermaid
graph LR
    Booked([BOOKED]) -->|staff collects it| Collected([COLLECTED])
    Collected -->|courier/staff moves it| Transit([IN_TRANSIT_TO_CENTER])
    Transit -->|arrives| AtCenter([AT_CENTER])
    AtCenter -->|in-scope test| InHouse([IN_HOUSE_PROCESSING])
    AtCenter -->|out-of-scope test| Partner([ROUTED_TO_PARTNER_LAB])
    InHouse --> Ready([RESULT_READY])
    Partner --> Ready
    Ready -->|handed / downloaded| Delivered([DELIVERED])
```

## Who can call what (route guards)

| Route | Who |
|---|---|
| `POST /bookings/:id/samples` | `ADMIN` / `STAFF` only |
| `GET /bookings/:id/samples` | the booking's owner, or `ADMIN` / `STAFF` |
| `PATCH /samples/:id/status` | `ADMIN` / `STAFF` only |
| `GET /samples/:id/history` | the booking's owner, or `ADMIN` / `STAFF` |

## How it flows

### Initialize samples for a booking — start to end

```mermaid
graph TD
    Start(["POST /bookings/:id/samples<br/>(ADMIN/STAFF only)"]) --> AlreadyInit{"Samples already<br/>exist for this booking?"}
    AlreadyInit -->|yes| E400(["400: already initialized"])
    AlreadyInit -->|no| Insert["INSERT samples (status=BOOKED) x N<br/>— one per booking_item<br/>INSERT sample_status_history x N"]
    Insert --> E201(["201 Created + Sample[]"])
```

### Advance a sample's status — start to end

```mermaid
graph TD
    Start(["PATCH /samples/:id/status<br/>{ status, notes? }<br/>(ADMIN/STAFF only)"]) --> Load["Load current sample"]
    Load --> Allowed{"requested status in<br/>ALLOWED_TRANSITIONS[current]?"}
    Allowed -->|no| E400(["400: cannot move<br/>from X to Y"])
    Allowed -->|yes| ToCollected{"moving to<br/>COLLECTED?"}
    ToCollected -->|yes| Stamp["stamp collectedBy<br/>+ collectedAt"]
    ToCollected -->|no| Update
    Stamp --> Update["UPDATE samples SET status, ...<br/>INSERT sample_status_history"]
    Update --> E200(["200 OK + Sample"])
```

## Sequence detail (which service calls which)

```mermaid
sequenceDiagram
    actor S as Staff
    participant Ctrl as SamplesController
    participant Svc as SamplesService
    participant Bookings as BookingsService
    participant DB as PostgreSQL

    S->>Ctrl: POST /bookings/:id/samples
    Ctrl->>Svc: initializeForBooking(bookingId)
    Svc->>Bookings: findOne(bookingId)
    Svc->>DB: count samples WHERE booking_id = :id
    alt samples already exist
        Svc-->>S: 400 Bad Request "already initialized"
    end
    rect rgb(230, 240, 255)
    Note over Svc,DB: one transaction
    Svc->>DB: INSERT samples (status='BOOKED') x N — one per booking_item
    Svc->>DB: INSERT sample_status_history (status='BOOKED') x N
    end
    Svc-->>S: 201 Created + Sample[]

    S->>Ctrl: PATCH /samples/:id/status<br/>{ status: 'COLLECTED', notes? }
    Ctrl->>Svc: updateStatus(id, staffUserId, dto)
    Svc->>DB: findOne(id)
    Svc->>Svc: allowedNext = ALLOWED_TRANSITIONS[sample.status]
    alt dto.status not in allowedNext
        Svc-->>S: 400 Bad Request "cannot move from X to Y"
    end
    Note right of Svc: moving to COLLECTED also stamps<br/>collectedBy + collectedAt
    rect rgb(230, 240, 255)
    Svc->>DB: UPDATE samples SET status, collected_by?, collected_at?
    Svc->>DB: INSERT sample_status_history (status, changed_by, notes)
    end
    Svc-->>S: 200 OK + Sample
```

The owner-or-staff check on the `GET` routes is not reimplemented here —
`SamplesService` calls straight into `BookingsService.findOneForUser()`,
the same check `GET /bookings/:id` already uses, so there's exactly one
place that rule lives.
