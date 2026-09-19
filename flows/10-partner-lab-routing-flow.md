# Partner-lab routing + SLA tracking

Picks up where [`09-sample-lifecycle-flow.md`](./09-sample-lifecycle-flow.md)
left the `AT_CENTER → ROUTED_TO_PARTNER_LAB` branch — what actually
happens at that step, and how "is this lab keeping up" gets answered
later.

## Routing a sample (setting the SLA target)

```mermaid
sequenceDiagram
    actor S as Staff
    participant Ctrl as SamplesController
    participant Svc as SamplesService
    participant Labs as PartnerLabsService
    participant DB as PostgreSQL

    S->>Ctrl: PATCH /samples/:id/status<br/>{ status: 'ROUTED_TO_PARTNER_LAB', partnerLabId }
    Ctrl->>Svc: updateStatus(id, staffUserId, dto)
    Svc->>DB: findOne(sample)
    Svc->>Svc: check AT_CENTER -> ROUTED_TO_PARTNER_LAB is allowed
    alt partnerLabId missing
        Svc-->>S: 400 Bad Request "partnerLabId is required"
    end
    Svc->>Labs: findOne(partnerLabId)
    alt lab not found
        Labs-->>S: 404 Not Found
    end
    Svc->>Svc: expectedResultAt = now + (turnaroundHoursOverride<br/>?? partnerLab.defaultTurnaroundHours) hours
    rect rgb(230, 240, 255)
    Svc->>DB: UPDATE samples SET status, routed_to_partner_lab_id, expected_result_at
    Svc->>DB: INSERT sample_status_history (status='ROUTED_TO_PARTNER_LAB', ...)
    end
    Svc-->>S: 200 OK + Sample { expectedResultAt }
```

## Reading the SLA summary

```mermaid
sequenceDiagram
    actor A as Admin/Staff
    participant Ctrl as SamplesController
    participant Svc as SamplesService
    participant DB as PostgreSQL

    A->>Ctrl: GET /partner-labs/:id/sla
    Ctrl->>Svc: getSlaSummaryForPartnerLab(partnerLabId)
    Svc->>DB: find samples WHERE routed_to_partner_lab_id = :id
    loop for each sample
        Svc->>DB: find sample_status_history WHERE sample_id AND status='RESULT_READY'
        Note right of Svc: classify: NOT_TRACKED (no target) ·<br/>ON_TIME / BREACHED (has an actual result) ·<br/>IN_PROGRESS / AT_RISK (still running, vs. now)
    end
    Svc-->>A: 200 OK + { summary: {total, onTime, breached, atRisk, inProgress, notTracked}, samples: [...] }
```

## Classification

```mermaid
graph TD
    Start{expectedResultAt set?} -->|no| NotTracked([NOT_TRACKED])
    Start -->|yes| HasResult{reached RESULT_READY?}
    HasResult -->|yes| Compare{actual <= expected?}
    Compare -->|yes| OnTime([ON_TIME])
    Compare -->|no| Breached([BREACHED])
    HasResult -->|not yet| NowCheck{now > expected?}
    NowCheck -->|no| InProgress([IN_PROGRESS])
    NowCheck -->|yes| AtRisk([AT_RISK])
```

Nothing here is a new stored column — `expectedResultAt` lives on
`Sample` (set once, at routing time) and the "actual" side is read
straight out of `SampleStatusHistory`'s `RESULT_READY` row, which step 5
was already writing. SLA tracking is a read-time computation over data
that already exists.
