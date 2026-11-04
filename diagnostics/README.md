# Diagnostics Appointment & Reporting System

Implements the client scope document (19 Dec 2025): a PHP + MySQL web application
(patient, technician and admin portals) plus two Flutter Android apps, all on one
backend and database. Built on the `feature/diagnostics-appointment-system` branch;
the original Arogya code (NestJS) is untouched and only used as a domain reference.

## Layout

```
diagnostics/
├── database/schema.sql          MySQL schema + seed (admin, sample tests)
├── web/
│   ├── includes/bootstrap.php   config, DB, auth, workflow, notifications
│   ├── public/                  web portals + /api (document root)
│   │   ├── patient/             profile, booking, history, live status, reports
│   │   ├── technician/          assigned jobs, On Way / Sample Collected
│   │   ├── admin/               tests & rates, technicians, appointments, reports upload, financials
│   │   └── api/index.php        JSON API for the mobile apps
│   └── bin/send_reminders.php   cron: 24h appointment reminders
├── mobile/patient_app/          Flutter patient app
├── mobile/technician_app/       Flutter technician app
├── Dockerfile, docker-compose.yml
```

## Scope coverage

| Scope item | Where |
|---|---|
| Patient login/profile, appointment history, report access | `public/patient/*` |
| Technician login, assigned jobs, status updates | `public/technician/` |
| Test & rate card management | `public/admin/tests.php` |
| Technician management & assignment | `admin/technicians.php`, `admin/appointments.php` |
| Appointment tracking & workflow | `STATUS_FLOW` in `bootstrap.php` (Booked → Assigned → On Way → Sample Collected → Report Ready) |
| Secure PDF report upload | `admin/appointments.php` (PDF signature check, random filenames, stored outside web root, owner-only download) |
| Daily/weekly/monthly order & financial reports | `admin/reports.php` (+ CSV export) |
| Backend APIs for mobile | `public/api/index.php` |
| Reminders, notifications, receipts | `send_reminders.php`, `notify()`, `receipt.php` |
| Patient app: booking, payment gateway, live status, reports | `mobile/patient_app` (Razorpay) |
| Technician app: jobs, status, navigation, sync | `mobile/technician_app` |

## Run locally

```bash
cd diagnostics
docker compose up --build
# Web:  http://localhost:8080      API: http://localhost:8080/api
```

Default admin: phone `9999999999` / password `Admin@123`. **Change it immediately.**

Environment variables (see `docker-compose.yml`): `DB_*`, `RAZORPAY_KEY_ID`,
`RAZORPAY_KEY_SECRET`, `SMS_GATEWAY_URL` (use `{phone}` and `{text}` placeholders),
`MAIL_FROM`. Hosting, domain, SMS and payment-gateway costs are the client's, per the scope document.

Reminders: schedule `php bin/send_reminders.php` hourly via cron.

## Android APKs

The GitHub Actions workflow `.github/workflows/diagnostics-apk.yml` generates the Android
project, builds both release APKs and uploads them as artifacts. Run it manually with
`api_base` set to your deployed URL (e.g. `https://your-domain.com/api`).

## Deploying

Any PHP 8.1+ / MySQL 8 host works: point the document root to `web/public`, import
`database/schema.sql`, set the env vars, make `web/storage/reports` writable, and serve
over HTTPS (the mobile apps send bearer tokens).

## Arogya feature port (you asked for everything, to remove later)

Arogya's full app lives on the `claude/shared-session-continuation-5vfqik` branch (NestJS + React).
Its features are being ported to this PHP + MySQL stack in phases. Existing databases: run
`database/migrations/002_arogya_features.sql` then `003_phase2_wallet_family_support.sql` once each (docker-compose does it on a fresh install).

| Phase | Feature | Status |
|---|---|---|
| 1 | Test packages (BASIC/STANDARD/PREMIUM), admin + booking | Done |
| 1 | Diagnostic centres, 20 km service radius, pickup points + visit schedules, collection modes (home / pickup point / walk-in) | Done |
| 1 | Partner labs and per-test routing with turnaround | Done |
| 1 | Offers/coupons (percent/flat, caps, limits, per-customer), checkout preview + server-side recheck | Done |
| 2 | Family members under one account (book for parents/children) | Done |
| 2 | Support tickets with replies and status, prescriptions/documents upload with admin review | Done |
| 2 | Wallet, referral rewards (₹100 each), wallet checkout and cancellation refunds, invoices | Done |
| 3 | Health tracking: vitals, goals, medicines, retest reminders, insights, report values and trends | Planned |
| 3 | Sign-in options: Google, phone OTP, passkeys; report sharing links | Planned |
| 3 | Agent leaves/salary, staff alerts, push notifications, holidays, AI test finder | Planned |

## Not covered / notes

- Push notifications (FCM) are not included; in-app, email (`mail()`) and SMS (gateway URL) are.
- Online payment needs Razorpay keys; without them, admin marks cash payments as paid and a receipt is issued.
