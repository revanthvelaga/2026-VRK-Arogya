# Arogya — Diagnostic Lab Booking Platform
## Architecture & System Design (v1)

## 1. Overview

Two-sided platform:
- **Customer app** — browse test packages / individual tests, book a sample collection (at home/village pickup point or walk-in at the diagnostic center), track status, view reports.
- **Admin app/panel** — manage catalog (tests, packages, pricing), manage collection routes/pickup points within a configurable radius, assign staff to routes, track sample lifecycle (collected → in-transit → at lab → result ready), route out-of-scope tests to the Visakhapatnam partner lab, manage reports and turnaround SLAs.

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Mobile app (customer + field staff) | **React Native (Expo)** | Single codebase → Play Store + iOS later; fast, good-looking UI |
| Admin panel | **React (Vite) web app** | Admin work is desk-based; a web dashboard is easier to use than mobile for catalog/ops management |
| Backend API | **Node.js + NestJS** | TypeScript, structured like Spring Boot (modules/controllers/services/DI) — easy transition from your Java background |
| Database | **PostgreSQL + PostGIS** | PostGIS gives native `ST_DWithin` radius queries for the 20km pickup-point logic |
| Auth | **JWT + refresh tokens**, role-based (ADMIN, STAFF, CUSTOMER) | Simple, standard, works across mobile + web |
| File storage (PDF reports, images) | **AWS S3** (or local disk for MVP) | You already have AWS background |
| Notifications | **Firebase Cloud Messaging** (push) + SMS via a gateway (e.g. MSG91) for villagers without smartphones | Rural users may rely on SMS more than push |
| Realtime status updates | **WebSockets (Socket.IO)** or simple polling for MVP | Sample status tracking |
| CI / repo | **GitHub + GitHub Actions** | Daily commits, auto-lint/test on push |
| Hosting | **Backend: Render/Railway/EC2. DB: managed Postgres (RDS/Supabase). Mobile: EAS Build → Play Store** | Cheap to start, scalable later |

## 3. Core Domain Concepts

- **DiagnosticCenter** — your home lab (has a lat/lng + service radius, e.g. 20km)
- **PickupPoint** — a panchayat office or village location within the center's radius; can be scheduled (e.g. "every Tuesday, 9–11 AM")
- **Test** — an individual lab test (e.g. CBC, Lipid Profile) with price, sample type, turnaround time, and a flag for whether it's processed in-house or must be outsourced
- **Package** — a bundle of Tests at a combined price
- **PartnerLab** — external lab (Visakhapatnam) that handles out-of-scope tests, with its own turnaround SLA
- **Booking** — a customer's request: selected tests/packages + collection mode (walk-in vs pickup-point) + date/slot
- **Sample** — physical specimen tied to a Booking; has a status lifecycle
- **Report** — final result, PDF, linked to a Booking

### Sample status lifecycle
```
BOOKED → COLLECTED → IN_TRANSIT_TO_CENTER → AT_CENTER
   → (IN_HOUSE_PROCESSING | ROUTED_TO_PARTNER_LAB)
   → RESULT_READY → DELIVERED
```

## 4. High-Level Architecture

```
┌─────────────────┐        ┌──────────────────┐
│  Customer App    │        │   Admin Web App    │
│ (React Native)   │        │   (React/Vite)      │
└────────┬─────────┘        └─────────┬──────────┘
         │ REST/JSON (JWT)             │ REST/JSON (JWT)
         └───────────┬──────────────────┘
                      ▼
            ┌───────────────────┐
            │   NestJS API       │
            │ (modules below)    │
            └─────────┬──────────┘
                      │
        ┌─────────────┼───────────────┐
        ▼             ▼               ▼
  ┌───────────┐ ┌────────────┐ ┌─────────────┐
  │ PostgreSQL │ │   S3        │ │  FCM / SMS   │
  │ + PostGIS  │ │ (reports)   │ │  gateway     │
  └───────────┘ └────────────┘ └─────────────┘
```

### NestJS modules
`auth` · `users` · `centers` · `pickup-points` · `catalog` (tests/packages) · `bookings` · `samples` · `partner-labs` · `reports` · `notifications`

## 5. Repo Structure (monorepo)

```
arogya/
├── apps/
│   ├── mobile/          # React Native (Expo) customer + staff app
│   ├── admin-web/        # React admin dashboard
│   └── api/              # NestJS backend
├── packages/
│   └── shared-types/     # Shared TS interfaces (DTOs) used by all apps
├── docker-compose.yml     # local Postgres+PostGIS for dev
└── .github/workflows/     # CI: lint, test, build on push
```

## 6. Build Order (what I'll deliver, in sequence)

1. Database schema (PostGIS-enabled) + ERD — **next message**
2. NestJS API skeleton: auth module + roles + users
3. Catalog module (tests, packages, admin CRUD)
4. Diagnostic center + pickup-point module with radius search
5. Booking flow (customer creates booking, chooses pickup point or walk-in)
6. Sample lifecycle + admin status updates
7. Partner-lab routing + SLA tracking
8. Admin web dashboard (React) wired to API
9. Customer mobile app (React Native) wired to API
10. Notifications (push/SMS) + report PDF upload/download
11. Dockerize + GitHub Actions CI, deployment guide

I'll build and commit each step incrementally rather than dumping everything at once, so you can review and steer at each stage.
