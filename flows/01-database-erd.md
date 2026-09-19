# Database ER diagram

Every table defined in [`schema.sql`](../schema.sql), plus `notifications`
(added in step 10, not part of the original reference SQL — see the note
at the bottom). Tables marked **(entity)** already have a matching
TypeORM entity in `apps/api/src`; tables marked **(schema-only)** exist
in the reference SQL but no module has been built against them yet. As
of step 10, every table in this diagram is an entity — `reports` was the
last schema-only one.

```mermaid
erDiagram
    USERS ||--o{ DIAGNOSTIC_CENTERS : owns
    USERS ||--o{ BOOKINGS : places
    USERS ||--o{ SAMPLES : "collected_by"
    USERS ||--o{ SAMPLE_STATUS_HISTORY : "changed_by"
    USERS ||--o{ REPORTS : "uploaded_by / reviewed_by"
    USERS ||--o{ NOTIFICATIONS : "user_id"

    DIAGNOSTIC_CENTERS ||--o{ PICKUP_POINTS : has
    DIAGNOSTIC_CENTERS ||--o{ TESTS : offers
    DIAGNOSTIC_CENTERS ||--o{ PACKAGES : offers
    DIAGNOSTIC_CENTERS ||--o{ BOOKINGS : "collection point"

    PICKUP_POINTS ||--o{ PICKUP_POINT_SCHEDULES : "recurring visit times"
    PICKUP_POINTS ||--o{ BOOKINGS : "pickup_point_id (nullable)"

    PARTNER_LABS ||--o{ TESTS : "routes out-of-scope tests"
    PARTNER_LABS ||--o{ SAMPLES : processes

    TESTS ||--o{ PACKAGE_TESTS : "included in"
    PACKAGES ||--o{ PACKAGE_TESTS : includes

    TESTS ||--o{ BOOKING_ITEMS : "ordered as"
    PACKAGES ||--o{ BOOKING_ITEMS : "ordered as"

    BOOKINGS ||--o{ BOOKING_ITEMS : contains
    BOOKINGS ||--o{ SAMPLES : produces
    BOOKINGS ||--o{ REPORTS : "results in"

    BOOKING_ITEMS ||--o| SAMPLES : "tracked by"
    SAMPLES ||--o{ SAMPLE_STATUS_HISTORY : logs

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
        uuid partner_lab_id FK
        int turnaround_hours
        enum audience "EVERYONE default | MEN | WOMEN | CHILDREN | SENIOR_MEN | SENIOR_WOMEN | FITNESS"
        boolean is_active
    }

    PACKAGES {
        uuid id PK
        uuid center_id "plain id, no FK relation yet"
        varchar name
        text description
        numeric price
        enum audience "EVERYONE default | MEN | WOMEN | CHILDREN | SENIOR_MEN | SENIOR_WOMEN | FITNESS"
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
        uuid routed_to_partner_lab_id FK "set + expected_result_at computed on ROUTED_TO_PARTNER_LAB"
        timestamptz expected_result_at "SLA target — partner lab default, or an explicit override"
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
        text file_url "local disk path today; a real S3 URL once that lands"
        varchar file_name "original uploaded filename"
        varchar mime_type "always application/pdf, enforced on upload"
        integer size_bytes
        uuid uploaded_by FK "staff/admin who uploaded it"
        timestamptz generated_at
        uuid reviewed_by FK "column exists, no review workflow built yet"
    }

    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK
        enum type "BOOKING_CREATED | SAMPLE_COLLECTED | RESULT_READY | REPORT_READY"
        varchar message
        timestamptz read_at "nullable"
        boolean email_sent
        text email_preview_url "Ethereal preview link in dev, nullable"
        timestamptz created_at
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
- `tests.audience` / `packages.audience` back the customer web app's
  "shop by category" browsing (Men/Women/Children/Senior Men/Senior
  Women/Fitness) — set from the admin console's catalog forms, defaults
  to `EVERYONE` so untagged items keep showing up regardless of which
  category a customer browsed in from. Added after the initial catalog
  module shipped, not part of the original step-02 schema.
- `reports` finally got a real entity in step 10, extended past
  `schema.sql`'s original four columns with `file_name`/`mime_type`/
  `size_bytes`/`uploaded_by` — what an actual upload/download flow needs.
  `reviewed_by` is still just a column; no review workflow was built
  around it.
- `notifications` is entirely new in step 10 — not in `schema.sql` at
  all. See [`flows/11-notifications-reports-flow.md`](./11-notifications-reports-flow.md)
  for what writes to it and how email delivery (or its absence) is
  tracked on each row.
