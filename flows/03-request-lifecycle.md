# Request lifecycle (generic, shown with a real endpoint)

Every HTTP request into the API passes through the same layers in the
same order. This is shown concretely using `POST /catalog/tests`
(create a test) because it's the one endpoint pattern that exercises
every layer, including both guards — most endpoints use a subset of
this (e.g. a public `GET` skips both guards entirely).

```mermaid
sequenceDiagram
    actor C as Client
    participant G1 as JwtAuthGuard
    participant G2 as RolesGuard
    participant P as ValidationPipe (global)
    participant Ctrl as TestsController
    participant Svc as TestsService
    participant Repo as TypeORM Repository
    participant DB as PostgreSQL

    C->>G1: POST /catalog/tests<br/>Authorization: Bearer <token>
    G1->>G1: passport-jwt verifies signature + expiry
    alt token missing or invalid
        G1-->>C: 401 Unauthorized
    end
    G1->>G1: request.user = { userId, phone, role }
    G1->>G2: continue

    G2->>G2: read @Roles(Role.ADMIN) metadata
    G2->>G2: request.user.role === 'ADMIN' ?
    alt role not allowed
        G2-->>C: 403 Forbidden
    end
    G2->>P: continue

    P->>P: validate body against CreateTestDto<br/>(class-validator), strip unknown fields
    alt validation fails
        P-->>C: 400 Bad Request + field errors
    end
    P->>Ctrl: dto (typed, sanitized)

    Ctrl->>Svc: testsService.create(dto)
    Svc->>Repo: repo.create(dto) + repo.save(entity)
    Repo->>DB: INSERT INTO tests (...) RETURNING *
    DB-->>Repo: row
    Repo-->>Svc: Test entity
    Svc-->>Ctrl: Test entity
    Ctrl-->>C: 201 Created + JSON body
```

## The same pipeline, simplified per endpoint type

| Endpoint type | Guards run? | Example |
|---|---|---|
| Public read | none | `GET /catalog/tests` |
| Any logged-in user | `JwtAuthGuard` only | `POST /bookings`, `GET /bookings/mine` |
| Role-restricted | `JwtAuthGuard` + `RolesGuard` | `POST /catalog/tests`, `PATCH /bookings/:id/status` |

`ValidationPipe` is registered once, globally, in `main.ts`
(`app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))`)
— every controller gets it automatically; no per-route wiring needed.

`RolesGuard` (see `common/guards/roles.guard.ts`) is permissive by
default: a route with **no** `@Roles(...)` decorator is open to any
authenticated user once `JwtAuthGuard` has run. It only restricts a
route once `@Roles(...)` is explicitly attached.

## If you're coming from Spring Boot

This is the same `Controller → Service → DAO → POJO` layering, not a
different one — two things just look unfamiliar:

- **DTO validation is its own step, before the Controller runs.** In
  Spring, `@Valid @RequestBody SomeDto dto` in the controller method
  signature means "bind + validate" happens *as* the method is invoked —
  it reads like one step. NestJS pulls that identical job out into its
  own named pipeline stage (a `Pipe`), which finishes *before* the
  controller method is called. Same job, same moment — just an explicit,
  separately-drawn stage because NestJS's pipeline
  (`Guards → Interceptors → Pipes → Handler`) is built that way.
- **The DAO and the POJO are there, just named differently.** TypeORM's
  `Repository<Entity>` (`repo` in the diagram above, injected via
  `@InjectRepository`) **is** the DAO — same role as Spring's
  `JpaRepository<Entity, ID>`. An `@Entity()`-decorated class (`Test`,
  `User`, `Booking`, ...) **is** the POJO — same role as Spring's
  `@Entity` classes. This codebase injects the Repository straight into
  the Service rather than through a separate hand-written DAO class,
  which is the normal NestJS/TypeORM idiom, not a shortcut unique to this
  project.

See [`drawio/`](./drawio) for a version that draws Repository (DAO) and
Entity (POJO) as two explicit boxes, one row per endpoint, if that 1:1
mapping is easier to follow while you're still getting used to Nest.
