# Sample lifecycle — the physical specimen's own status chain

Separate from the booking's own status (`PENDING → CONFIRMED → COMPLETED`,
see [`08-booking-flow.md`](./08-booking-flow.md)), each **sample** — one
per booking item — moves through a longer, stricter chain that mirrors
what actually happens to the physical specimen.

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

`AT_CENTER` is the only fork — everything else is a strict, one-way
chain. `SamplesService.updateStatus()` enforces this with a lookup table
(`ALLOWED_TRANSITIONS`); any status change not shown by an arrow above is
rejected with `400 Bad Request`, whatever role is asking.

## Initializing + advancing a sample

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

## Who can see what

| Route | Who |
|---|---|
| `POST /bookings/:id/samples` | `ADMIN` / `STAFF` only |
| `GET /bookings/:id/samples` | the booking's owner, or `ADMIN` / `STAFF` |
| `PATCH /samples/:id/status` | `ADMIN` / `STAFF` only |
| `GET /samples/:id/history` | the booking's owner, or `ADMIN` / `STAFF` |

The owner-or-staff check is not reimplemented here — `SamplesService`
calls straight into `BookingsService.findOneForUser()`, the same check
`GET /bookings/:id` already uses, so there's exactly one place that rule
lives.
