# Flow diagrams

Pictorial reference for how Arogya's backend is put together and how each
feature actually moves through the code, one layer at a time. Every
diagram here is [Mermaid](https://mermaid.js.org/) — GitHub renders it
inline automatically when you view these files on github.com, no image
files or extra tooling needed. (If you're reading this somewhere that
doesn't render Mermaid, paste the code block into
[mermaid.live](https://mermaid.live) to see it.)

## Index

| File | What it shows |
|---|---|
| [`01-database-erd.md`](./01-database-erd.md) | Full database entity-relationship diagram — every table in `schema.sql`, how they connect, and which ones already have a matching NestJS entity vs. are still schema-only |
| [`02-module-dependency-graph.md`](./02-module-dependency-graph.md) | Which NestJS module imports which — the "who depends on whom" map of the whole API |
| [`03-request-lifecycle.md`](./03-request-lifecycle.md) | The generic path **every** request takes: guard → guard → validation → controller → service → repository → database, shown concretely for one real endpoint |
| [`04-class-diagram-bookings.md`](./04-class-diagram-bookings.md) | Class-level diagram of the Bookings module (controller, service, entities, and the other modules' services it calls into) — every other module follows the same Controller → Service → Entity shape, this one's shown because it's the only one that also reaches across modules |
| [`05-auth-flow.md`](./05-auth-flow.md) | Register + login, step by step |
| [`06-catalog-flow.md`](./06-catalog-flow.md) | Browsing the test/package catalog, and an admin adding a new one |
| [`07-centers-pickup-points-flow.md`](./07-centers-pickup-points-flow.md) | "Find near me" radius search, and the check that rejects a pickup point placed outside its center's service area |
| [`08-booking-flow.md`](./08-booking-flow.md) | The full booking-creation flow — every validation step, in order, across every module it touches |

## How to read these

- **Rectangles / boxes** = a module, class, or table.
- **Arrows** = "calls", "depends on", or "references", labeled where it
  isn't obvious.
- **Sequence diagrams** (the ones with a vertical lifeline per box) read
  top-to-bottom in time order — that's literally the order things happen
  when you call the endpoint.
- **`alt` blocks** in a sequence diagram are branch points — "if this,
  then that instead" (e.g. an invalid token returning `401` instead of
  continuing).

These are hand-maintained alongside the code (not auto-generated), so if
you add or change a module, update the relevant diagram(s) in the same
change.
