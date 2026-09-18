# Booking flow — every validation step, in order

This is the most involved flow in the codebase — it's the one place
where Bookings, Catalog, and Centers all meet. Every rejection point
below is a real `alt` branch in `BookingsService.create()`.

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

## After creation

```mermaid
graph LR
    Pending([PENDING]) -->|admin/staff:<br/>PATCH status CONFIRMED| Confirmed([CONFIRMED])
    Pending -->|owner or admin/staff:<br/>PATCH cancel| Cancelled([CANCELLED])
    Confirmed -->|owner or admin/staff:<br/>PATCH cancel| Cancelled
    Confirmed -->|admin/staff:<br/>PATCH status COMPLETED| Completed([COMPLETED])
```

Cancelling is only allowed from `PENDING` or `CONFIRMED` — a
`COMPLETED` or already-`CANCELLED` booking rejects further cancellation
with `400 Bad Request`. The next step in the build order (sample
lifecycle) will hang its own, more granular status chain
(`BOOKED → COLLECTED → ... → DELIVERED`) off of each `booking_item`,
separate from this booking-level status.
