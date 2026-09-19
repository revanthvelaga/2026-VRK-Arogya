# Step-by-step build log

Each file here covers one delivered step of the project: what it does in
plain language (no coding background needed), then the technical detail
for developers, then what to try and what comes next.

| Step | What it covers |
|---|---|
| [step-01-auth-users.md](./step-01-auth-users.md) | Database schema, login/signup, roles |
| [step-02-catalog.md](./step-02-catalog.md) | Test & package catalog, admin management |
| [step-03-centers-pickup-points.md](./step-03-centers-pickup-points.md) | Diagnostic centers, pickup points, "find near me" search |
| [step-04-bookings.md](./step-04-bookings.md) | Booking flow — tests/packages, pickup point vs. walk-in vs. home visit |
| [step-05-sample-lifecycle.md](./step-05-sample-lifecycle.md) | The physical sample's status chain, `BOOKED → ... → DELIVERED` |
| [step-06-partner-lab-routing.md](./step-06-partner-lab-routing.md) | Routing a sample out to a partner lab, SLA tracking |
| [step-07-admin-web-dashboard.md](./step-07-admin-web-dashboard.md) | The React admin/staff console, wired to every module above |
| [step-08-customer-web.md](./step-08-customer-web.md) | The customer-facing site — browse, cart, book, track, call/WhatsApp, audience-based suggestions |

New write-ups are added as each step ships — see the root
[`README.md`](../README.md) for overall project status.
