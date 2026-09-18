# Class diagram — Bookings module

Every module in this codebase (Users, Catalog, Centers, Bookings) follows
the same shape: **Controller → Service → Entity**, with the Service being
the only class that touches the database (via an injected TypeORM
`Repository`). Bookings is shown here specifically because it's the only
module so far that also depends on *other* modules' services, which is
the pattern any future cross-module feature (samples, partner-lab
routing, reports) will repeat.

```mermaid
classDiagram
    class BookingsController {
        -BookingsService bookingsService
        +create(user, dto) Booking
        +findMine(user) Booking[]
        +findAll() Booking[]
        +findOne(user, id) Booking
        +cancel(user, id) Booking
        +updateStatus(id, dto) Booking
    }

    class BookingsService {
        -Repository~Booking~ bookingsRepo
        -DataSource dataSource
        -CentersService centersService
        -PickupPointsService pickupPointsService
        -TestsService testsService
        -PackagesService packagesService
        +create(customerId, dto) Booking
        +findAllForCustomer(customerId) Booking[]
        +findAll() Booking[]
        +findOne(id) Booking
        +findOneForUser(id, user) Booking
        +cancel(id, user) Booking
        +updateStatus(id, dto) Booking
        -priceItems(items) PricedItem[]
    }

    class Booking {
        +string id
        +string customerId
        +string centerId
        +string pickupPointId
        +CollectionMode collectionMode
        +Date scheduledAt
        +BookingStatus status
        +number totalAmount
        +BookingItem[] items
    }

    class BookingItem {
        +string id
        +string bookingId
        +string testId
        +string packageId
        +number price
    }

    class CentersService {
        <<from CentersModule>>
        +findOne(id) DiagnosticCenter
    }
    class PickupPointsService {
        <<from CentersModule>>
        +findOne(id) PickupPoint
    }
    class TestsService {
        <<from CatalogModule>>
        +findOne(id) Test
    }
    class PackagesService {
        <<from CatalogModule>>
        +findOne(id) Package
    }

    BookingsController --> BookingsService : delegates every request
    BookingsService --> Booking : creates / reads via repo
    BookingsService --> BookingItem : creates via repo
    Booking "1" *-- "many" BookingItem : items

    BookingsService --> CentersService : "is the center active?"
    BookingsService --> PickupPointsService : "does it belong to this center?"
    BookingsService --> TestsService : "current price + is it active?"
    BookingsService --> PackagesService : "current price + is it active?"
```

## Reading this for the other modules

Swap in the equivalent names and the diagram describes Catalog and
Centers too:

- **Catalog**: `TestsController`/`PackagesController` →
  `TestsService`/`PackagesService` → `Test`/`Package` entities. No
  cross-module dependencies.
- **Centers**: `CentersController`/`PickupPointsController` →
  `CentersService`/`PickupPointsService` →
  `DiagnosticCenter`/`PickupPoint`/`PickupPointSchedule` entities. No
  cross-module dependencies.
- **Users**: `UsersService` → `User` entity, with no controller of its
  own — it's only ever used internally by `AuthModule`.
