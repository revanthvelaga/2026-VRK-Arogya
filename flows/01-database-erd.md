# Database ER diagram

Every table defined in [`schema.sql`](../schema.sql). Tables marked
**(entity)** already have a matching TypeORM entity in `apps/api/src`;
tables marked **(schema-only)** exist in the reference SQL but no module
has been built against them yet.

```mermaid
erDiagram
    USERS ||--o{ DIAGNOSTIC_CENTERS : owns
    USERS ||--o{ BOOKINGS : places
    USERS ||--o{ SAMPLES : "collected_by (schema-only)"
    USERS ||--o{ SAMPLE_STATUS_HISTORY : "changed_by (schema-only)"
    USERS ||--o{ REPORTS : "reviewed_by (schema-only)"

    DIAGNOSTIC_CENTERS ||--o{ PICKUP_POINTS : has
    DIAGNOSTIC_CENTERS ||--o{ TESTS : offers
    DIAGNOSTIC_CENTERS ||--o{ PACKAGES : offers
    DIAGNOSTIC_CENTERS ||--o{ BOOKINGS : "collection point"

    PICKUP_POINTS ||--o{ PICKUP_POINT_SCHEDULES : "recurring visit times"
    PICKUP_POINTS ||--o{ BOOKINGS : "pickup_point_id (nullable)"

    PARTNER_LABS ||--o{ TESTS : "routes out-of-scope tests (schema-only)"
    PARTNER_LABS ||--o{ SAMPLES : "processes (schema-only)"

    TESTS ||--o{ PACKAGE_TESTS : "included in"
    PACKAGES ||--o{ PACKAGE_TESTS : includes

    TESTS ||--o{ BOOKING_ITEMS : "ordered as"
    PACKAGES ||--o{ BOOKING_ITEMS : "ordered as"

    BOOKINGS ||--o{ BOOKING_ITEMS : contains
    BOOKINGS ||--o{ SAMPLES : "produces (schema-only)"
    BOOKINGS ||--o{ REPORTS : "results in (schema-only)"

    BOOKING_ITEMS ||--o| SAMPLES : "tracked by (schema-only)"
    SAMPLES ||--o{ SAMPLE_STATUS_HISTORY : "logs (schema-only)"

    USERS {
        uuid id PK
        varchar full_name
        varchar phone UK
        varchar email UK
        varchar password_hash
        enum role "ADMIN | STAFF | CUSTOMER"
        boolean is_active
    }

    DIAGNOSTIC_CENTERS {
        uuid id PK
        varchar name
        text address
        geography location "PostGIS Point, srid 4326"
        numeric service_radius_km
        uuid owner_id FK
        boolean is_active
    }

    PICKUP_POINTS {
        uuid id PK
        uuid center_id FK
        varchar name
        geography location
        varchar village_name
        numeric distance_km "cached, recomputed on save"
        boolean is_active
    }

    PICKUP_POINT_SCHEDULES {
        uuid id PK
        uuid pickup_point_id FK
        smallint day_of_week "0=Sun .. 6=Sat"
        time start_time
        time end_time
    }

    PARTNER_LABS {
        uuid id PK
        varchar name
        varchar city
        varchar contact_phone
        int default_turnaround_hours
    }

    TESTS {
        uuid id PK
        uuid center_id "plain id, no FK relation yet"
        varchar name
        varchar code
        varchar sample_type
        numeric price
        boolean is_in_house
        uuid partner_lab_id "plain id, no FK relation yet"
        int turnaround_hours
        boolean is_active
    }

    PACKAGES {
        uuid id PK
        uuid center_id "plain id, no FK relation yet"
        varchar name
        text description
        numeric price
        boolean is_active
    }

    PACKAGE_TESTS {
        uuid package_id PK_FK
        uuid test_id PK_FK
    }

    BOOKINGS {
        uuid id PK
        uuid customer_id FK
        uuid center_id FK
        uuid pickup_point_id FK "nullable — set iff PICKUP_POINT"
        enum collection_mode "WALK_IN | PICKUP_POINT | HOME_VISIT"
        timestamptz scheduled_at
        enum status "PENDING | CONFIRMED | CANCELLED | COMPLETED"
        numeric total_amount "sum of item prices, server-computed"
    }

    BOOKING_ITEMS {
        uuid id PK
        uuid booking_id FK
        uuid test_id FK "exactly one of test_id/package_id"
        uuid package_id FK
        numeric price "snapshot at booking time"
    }

    SAMPLES {
        uuid id PK
        uuid booking_id FK
        uuid booking_item_id FK
        uuid collected_by FK
        enum status "BOOKED..DELIVERED, 8 stages"
        timestamptz collected_at
        uuid routed_to_partner_lab_id FK
        timestamptz expected_result_at
    }

    SAMPLE_STATUS_HISTORY {
        uuid id PK
        uuid sample_id FK
        enum status
        uuid changed_by FK
        timestamptz changed_at
        text notes
    }

    REPORTS {
        uuid id PK
        uuid booking_id FK
        text file_url "S3 URL"
        timestamptz generated_at
        uuid reviewed_by FK
    }
```

## Notes

- `location` columns are PostGIS `GEOGRAPHY(POINT, 4326)` — real-world
  lat/lng, which is what makes `ST_DWithin`/`ST_Distance` radius queries
  (used in the centers and pickup-points "nearby" search) work natively
  in the database rather than in application code.
- `tests.center_id` / `tests.partner_lab_id` / `packages.center_id` are
  plain UUID columns today, not TypeORM `@ManyToOne` relations — the
  `DiagnosticCenter` entity didn't exist yet when the catalog module was
  built. Wiring up the proper relation is a small follow-up once the
  catalog module is revisited.
- `booking_items` enforces "exactly one of `test_id`/`package_id`" with a
  DB-level `CHECK` constraint in `schema.sql`; the same rule is also
  validated in `BookingsService` before the row is even built.
