# Flow diagrams

Pictorial reference for how Arogya's backend is put together and how each
feature actually moves through the code, one layer at a time. Every
diagram here is [Mermaid](https://mermaid.js.org/) — GitHub renders it
inline automatically when you view these files on github.com, no image
files or extra tooling needed. (If you're reading this somewhere that
doesn't render Mermaid, paste the code block into
[mermaid.live](https://mermaid.live) to see it.)

**Want to drag boxes around and edit the diagram yourself, draw.io-style?**
See [`drawio/`](./drawio) — the same request-trace information (URI →
guard → DTO → controller → service → DB table → response, one endpoint
per row) plus a full infrastructure/deployment diagram (firewall, load
balancer, servers, database, CI/CD), as actual editable `.drawio` files,
each with an `.svg` preview sitting next to it so you can see it without
opening anything.

## Index

**Note on numbering:** these files are numbered 01–10, but the request-trace
diagrams under [`drawio/`](./drawio) are numbered separately (01–08) and
don't line up 1:1 with these — e.g. this folder's `05-auth-flow.md` pairs
with `drawio/01-auth-trace.drawio`, not `drawio/05-*`. The "Pairs with"
column below is the actual mapping; each `.md` file also links its match
at the top. If you're looking for "the diagram for step N," use this
table, not matching numbers.

As of this pass, every step-flow file (05–10) also opens with a short
**Objective / Classes & entities used / Tables used / Conditions
checked** block before its diagrams, so you don't have to read the
sequence diagram just to find out what tables or classes are involved.

| File | Pairs with (drawio) | What it shows |
|---|---|---|
| [`01-database-erd.md`](./01-database-erd.md) | — | Full database entity-relationship diagram — every table in `schema.sql`, how they connect, and which ones already have a matching NestJS entity vs. are still schema-only |
| [`02-module-dependency-graph.md`](./02-module-dependency-graph.md) | — | Which NestJS module imports which — the "who depends on whom" map of the whole API |
| [`03-request-lifecycle.md`](./03-request-lifecycle.md) | — | The generic path **every** request takes: guard → guard → validation → controller → service → repository → database, shown concretely for one real endpoint |
| [`04-class-diagram-bookings.md`](./04-class-diagram-bookings.md) | — | Class-level diagram of the Bookings module (controller, service, entities, and the other modules' services it calls into) — every other module follows the same Controller → Service → Entity shape, this one's shown because it's the only one that also reaches across modules |
| [`05-auth-flow.md`](./05-auth-flow.md) | `01-auth-trace` | Objective, classes/tables/conditions, then register + login, step by step |
| [`06-catalog-flow.md`](./06-catalog-flow.md) | `02-catalog-trace` | Objective, classes/tables/conditions, then browsing the catalog and an admin managing it |
| [`07-centers-pickup-points-flow.md`](./07-centers-pickup-points-flow.md) | `03-centers-trace` + `04-pickup-points-trace` | Objective, classes/tables/conditions, then "find near me" and the radius-validation check |
| [`08-booking-flow.md`](./08-booking-flow.md) | `05-bookings-trace` | Objective, classes/tables/conditions, then the full booking-creation flow — every validation step, in order |
| [`09-sample-lifecycle-flow.md`](./09-sample-lifecycle-flow.md) | `07-samples-trace` | Objective, classes/tables/conditions, then the sample status chain and the `AT_CENTER` fork |
| [`10-partner-lab-routing-flow.md`](./10-partner-lab-routing-flow.md) | `08-partner-labs-trace` | Objective, classes/tables/conditions, then routing + the SLA classification decision tree |

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
