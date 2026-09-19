# Module dependency graph

Which NestJS module imports which. Solid boxes/arrows are built; dashed
ones are planned (from `ARCHITECTURE.md`'s build order) and not written
yet.

```mermaid
graph TD
    App[AppModule]

    Config[ConfigModule]
    TypeOrm[TypeOrmModule<br/>Postgres + PostGIS connection]

    Users[UsersModule]
    Auth[AuthModule]
    Catalog[CatalogModule]
    Centers[CentersModule]
    Bookings[BookingsModule]
    PartnerLabs[PartnerLabsModule]
    Samples[SamplesModule]

    Notifications[["NotificationsModule<br/>(planned)"]]
    Reports[["ReportsModule<br/>(planned)"]]

    App --> Config
    App --> TypeOrm
    App --> Users
    App --> Auth
    App --> Catalog
    App --> Centers
    App --> Bookings
    App --> PartnerLabs
    App --> Samples

    Auth --> Users
    Bookings --> Catalog
    Bookings --> Centers
    Samples --> Bookings
    Samples --> PartnerLabs

    Reports -.-> Bookings
    Notifications -.-> Bookings
    Notifications -.-> Samples

    classDef planned stroke-dasharray: 5 5;
    class Notifications,Reports planned;
```

## Why this matters

- **`AuthModule` imports `UsersModule`** — auth doesn't own user storage,
  it borrows `UsersService` to look up/create users, then issues tokens.
- **`BookingsModule` imports `CatalogModule` and `CentersModule`** — it
  never talks to their database tables directly. It calls
  `TestsService`, `PackagesService`, `CentersService`, and
  `PickupPointsService` (each module's exported providers) to validate
  IDs and fetch current prices. This is the pattern every cross-module
  dependency in this codebase follows: import the module, use its
  exported service, don't reach into its entities/repositories directly.
- **`SamplesModule` imports `BookingsModule`** (reuses
  `BookingsService.findOne()`/`findOneForUser()` rather than
  re-implementing "does this booking exist, does this user own it") **and
  `PartnerLabsModule`** (reuses `PartnerLabsService.findOne()` when
  routing a sample, and to compute the SLA target).
- **`Test.partnerLab` and `Sample.routedToPartnerLab` are `@ManyToOne`
  relations to `PartnerLab`, not module imports** — `CatalogModule`
  itself never imports `PartnerLabsModule`. TypeORM resolves the entity
  reference through `autoLoadEntities: true` in `app.module.ts`, no
  service dependency needed for that.
- Every module except `AppModule` itself also does
  `TypeOrmModule.forFeature([...])` internally to register its own
  entities' repositories — that's omitted from this diagram to keep it
  readable; see [`04-class-diagram-bookings.md`](./04-class-diagram-bookings.md)
  for how that looks at the class level for one module.
