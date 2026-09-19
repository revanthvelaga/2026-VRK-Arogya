# Catalog flow — browsing, and an admin managing tests/packages

**Pairs with:** [`flows/drawio/02-catalog-trace.drawio`](./drawio/02-catalog-trace.drawio)

## Objective

Let anyone browse the live test/package catalog (no login needed), and
let an `ADMIN` create/edit/retire tests and build packages out of
existing tests — never returning a deactivated item to a public browse.

## Classes / entities / DTOs used

| Layer | Name | Role |
|---|---|---|
| Controller | `TestsController` | `GET/POST/PATCH/DELETE /catalog/tests` |
| Controller | `PackagesController` | `GET/POST/PATCH/DELETE /catalog/packages` |
| Service | `TestsService` | one table, straightforward CRUD + soft delete |
| Service | `PackagesService` | resolves `testIds[]` into real `Test` rows when building/editing a package |
| DTO | `CreateTestDto` / `UpdateTestDto` (`PartialType`) | includes `audience` (optional, defaults `EVERYONE` — see `flows/01-database-erd.md`) |
| DTO | `CreatePackageDto` / `UpdatePackageDto` | `CreatePackageDto` carries `testIds: string[]` |
| Entity | `Test` | `@Entity('tests')` |
| Entity | `Package` | `@Entity('packages')`, `@ManyToMany` to `Test` via `package_tests` |
| Guard | `JwtAuthGuard` + `RolesGuard(ADMIN)` | every write route; reads are public |

## Tables used

| Table | Operations |
|---|---|
| `tests` | `SELECT` (public browse, filtered `is_active`) · `INSERT` · `UPDATE` (edits, and soft delete via `is_active = false`) |
| `packages` | `SELECT` (with `relations: ['tests']`) · `INSERT` · `UPDATE` / soft delete |
| `package_tests` | join-table rows written whenever a package's `testIds` are set (create or update) |

## Conditions checked

| # | Condition | Outcome |
|---|---|---|
| 1 | Public `GET` routes only ever return `is_active = true` rows | deactivated items are invisible to browsing, with no "show inactive" toggle anywhere (admin included) |
| 2 | `PackagesService.create()`: an id in `testIds` that doesn't match a real row | **silently dropped**, not an error — the package is created with whatever subset of ids actually resolved. Worth double-checking a package's returned `tests[]` length matches what you sent. |
| 3 | `DELETE /catalog/tests/:id` (and packages): id not found | `404 Not Found` |
| 4 | Delete is **always a soft delete** (`is_active = false`) | the row is kept, never removed — `booking_items` may already reference it, so a hard delete would break booking history |

## How it flows

### Public browse (no login needed)

```mermaid
sequenceDiagram
    actor C as Customer (anonymous)
    participant Ctrl as TestsController / PackagesController
    participant Svc as TestsService / PackagesService
    participant DB as PostgreSQL

    C->>Ctrl: GET /catalog/tests
    Ctrl->>Svc: findAllActive()
    Svc->>DB: SELECT * FROM tests WHERE is_active = true
    DB-->>Svc: rows
    Svc-->>Ctrl: Test[]
    Ctrl-->>C: 200 OK + JSON

    C->>Ctrl: GET /catalog/packages
    Ctrl->>Svc: findAllActive()
    Svc->>DB: SELECT * FROM packages<br/>WHERE is_active = true<br/>(JOIN package_tests, tests for the "tests" relation)
    DB-->>Svc: rows
    Svc-->>Ctrl: Package[] (each with its tests[])
    Ctrl-->>C: 200 OK + JSON
```

### Admin creates a package from existing tests

```mermaid
sequenceDiagram
    actor A as Admin
    participant G as JwtAuthGuard + RolesGuard(ADMIN)
    participant Ctrl as PackagesController
    participant Svc as PackagesService
    participant TestsRepo as tests table
    participant PkgRepo as packages / package_tests tables

    A->>G: POST /catalog/packages<br/>{ name, price, testIds: [id1, id2] }
    G->>G: verify JWT, check role === ADMIN
    G->>Ctrl: dto
    Ctrl->>Svc: create(dto)
    Svc->>TestsRepo: SELECT * FROM tests WHERE id IN (id1, id2)
    TestsRepo-->>Svc: Test[] (the real rows — testIds that don't<br/>exist are silently dropped, not errored)
    Svc->>PkgRepo: INSERT INTO packages (...)
    Svc->>PkgRepo: INSERT INTO package_tests (package_id, test_id) x N
    PkgRepo-->>Svc: saved Package (with .tests populated)
    Svc-->>Ctrl: Package
    Ctrl-->>A: 201 Created
```

### Admin removes a test (soft delete)

```mermaid
sequenceDiagram
    actor A as Admin
    participant Ctrl as TestsController
    participant Svc as TestsService
    participant DB as PostgreSQL

    A->>Ctrl: DELETE /catalog/tests/:id
    Ctrl->>Svc: remove(id)
    Svc->>DB: SELECT * FROM tests WHERE id = ?
    alt not found
        DB-->>Svc: no row
        Svc-->>Ctrl: throw NotFoundException
        Ctrl-->>A: 404 Not Found
    end
    Svc->>Svc: test.isActive = false
    Svc->>DB: UPDATE tests SET is_active = false WHERE id = ?
    Note right of Svc: Row is kept, not deleted —<br/>booking_items may already reference it.
    Svc-->>Ctrl: void
    Ctrl-->>A: 200 OK
```
