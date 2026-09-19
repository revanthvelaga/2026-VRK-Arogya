# Step 6 — Partner-lab routing + SLA tracking

## In plain language

Not every test can be run at the local diagnostic center — some have to
be sent out to a partner lab (the Visakhapatnam partner lab, per the
architecture doc). This step does two things:

1. **Makes "partner lab" a real, manageable thing.** An admin can now add,
   list, and edit partner labs — name, city, contact phone, and a default
   turnaround time in hours ("this lab normally takes 24 hours").
2. **Tracks whether a routed sample actually comes back on time.** When a
   staff member moves a sample to `ROUTED_TO_PARTNER_LAB`, they say which
   lab it's going to. The system then works out a target time it should
   come back by — the partner lab's usual turnaround, or a one-off
   override if this particular sample needs to move faster/slower — and
   remembers it. Once the sample reaches `RESULT_READY`, that's compared
   against the target automatically.

Staff/admin can pull up **"how is this partner lab doing"** at any time —
a live count of samples that came back on time, came back late
("breached"), are still in flight but already past their target
("at risk"), or are still safely within it — without anyone manually
comparing timestamps.

## In technical terms

- `apps/api/src/partner-labs` — a new NestJS module:
  - **`PartnerLab`** entity — `name`, `city`, `contactPhone`,
    `defaultTurnaroundHours` (default `24`), matching `schema.sql`'s
    `partner_labs` table exactly. No `isActive` flag — the reference
    schema doesn't have one for this table, so there's no soft-delete/
    remove endpoint here (a lab is reference data other rows point to).
  - Plain admin CRUD (`PartnerLabsService`/`PartnerLabsController`) —
    but unlike catalog (`tests`, `packages`), **nothing here is public**:
    every route requires `ADMIN` or `STAFF`, since this is internal
    operational data, not something a customer ever needs to see.
- **Two existing entities pick up the real relation** that was a plain
  UUID column until now:
  - `Test.partnerLab` — `@ManyToOne(() => PartnerLab)` on
    `partner_lab_id`.
  - `Sample.routedToPartnerLab` — same, on `routed_to_partner_lab_id`.
- **`UpdateSampleStatusDto`** gains two optional fields:
  - `partnerLabId` — **required** (validated in the service, not the
    DTO, since it's conditional) when `status` is
    `ROUTED_TO_PARTNER_LAB`.
  - `turnaroundHoursOverride` — replaces the computed SLA target with a
    specific number of hours, for either `ROUTED_TO_PARTNER_LAB` or
    `IN_HOUSE_PROCESSING`.
- **`SamplesService.updateStatus()`** now also does this, in the same
  transaction as the status change:
  - Moving to `ROUTED_TO_PARTNER_LAB`: loads the `PartnerLab` (404s if
    the id is bad), sets `sample.routedToPartnerLabId`, and computes
    `sample.expectedResultAt = now + (turnaroundHoursOverride ??
    partnerLab.defaultTurnaroundHours)` hours.
  - Moving to `IN_HOUSE_PROCESSING` with a `turnaroundHoursOverride`
    supplied: sets `expectedResultAt` the same way. Without an override,
    an in-house sample stays untracked — a booking item may be a
    *package* (several tests bundled together), which has no single
    turnaround figure to fall back on automatically.
- **`SamplesService.getSlaSummaryForPartnerLab()`** is the SLA-tracking
  half: for every sample ever routed to a given lab, it looks up that
  sample's `RESULT_READY` row in `SampleStatusHistory` (the actual
  completion time — already being recorded since step 5, nothing new to
  store) and classifies it:
  - `NOT_TRACKED` — no `expectedResultAt` was ever set.
  - `ON_TIME` / `BREACHED` — reached `RESULT_READY` at or before / after
    the target.
  - `IN_PROGRESS` / `AT_RISK` — hasn't reached `RESULT_READY` yet, and
    the target is still ahead of / already behind "now".
  - Returns both the per-sample rows and an aggregate count per bucket.

### Try it

```
POST /partner-labs                    (ADMIN)
{ "name": "Visakhapatnam Partner Lab", "city": "Visakhapatnam",
  "defaultTurnaroundHours": 48 }

PATCH /samples/<id>/status            (ADMIN/STAFF)
{ "status": "ROUTED_TO_PARTNER_LAB", "partnerLabId": "<lab-id>" }

GET  /partner-labs/<id>/sla           (ADMIN/STAFF)
```

## What's next

Step 7 (build order item 8) is the **admin web dashboard** — a React/Vite
console wired to everything built so far, including a place to actually
see the SLA summary above as something other than raw JSON.
