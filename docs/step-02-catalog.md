# Step 2 — Catalog: the list of tests and packages customers can book

## In plain language

This step added the "menu" customers will browse: individual lab tests
(like a blood sugar test) and bundled packages (like a "Full Body
Checkup" combining several tests at one price). Anyone can look at the
menu without logging in. Only admins can add, edit, or remove items from
it.

Removing an item doesn't erase it — it just gets hidden from the public
menu (marked inactive). That way, a customer's past booking for a test
still makes sense even after that test is discontinued.

## In technical terms

- `apps/api/src/catalog` — a new NestJS module with two resources:
  - **Tests** — `Test` entity mirroring the `tests` table (`name`, `code`,
    `sampleType`, `price`, `isInHouse`, `partnerLabId`, `turnaroundHours`,
    `isActive`). `partnerLabId` and `centerId` are plain UUID columns for
    now (no FK relation yet) since the `PartnerLab` and `DiagnosticCenter`
    entities they'll eventually point to belong to later steps.
  - **Packages** — `Package` entity with a many-to-many relation to
    `Test` via the `package_tests` join table (`@ManyToMany` +
    `@JoinTable`). Creating/updating a package resolves the given
    `testIds` against the `tests` table.
- Endpoints (see `tests.controller.ts` / `packages.controller.ts`):
  - `GET /catalog/tests`, `GET /catalog/packages` — public, active items
    only.
  - `POST` / `PATCH` / `DELETE` on both — require `JwtAuthGuard` +
    `RolesGuard` + `@Roles(Role.ADMIN)`.
  - `DELETE` is a **soft delete**: it sets `isActive = false` rather than
    removing the row, since future bookings will reference these rows via
    `booking_items`.
- DTOs use `class-validator` for input validation and
  `@nestjs/mapped-types`'s `PartialType` to derive the "update" DTO from
  the "create" DTO without repeating every field.

### Try it

```
GET  /catalog/tests
GET  /catalog/packages

POST /catalog/tests      (Authorization: Bearer <admin access token>)
{ "name": "Complete Blood Count", "price": 250, "sampleType": "Blood" }

POST /catalog/packages   (Authorization: Bearer <admin access token>)
{ "name": "Full Body Checkup", "price": 1499, "testIds": ["<test-id-1>", "<test-id-2>"] }
```

## What's next

Step 3 builds **diagnostic centers and pickup points** — where samples
get collected, and how the app figures out which pickup points are close
enough to a customer to actually be usable.
