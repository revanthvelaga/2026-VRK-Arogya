# Diagnostics Appointment & Reporting System

A diagnostic-centre platform built to the client scope document (19 Dec 2025), plus every
feature of the Arogya app, ported to PHP + MySQL.

- **Web app (PHP 8.1+ / MySQL 8 or MariaDB 10.6+):** patient, technician and admin portals, plus a JSON API.
- **Android apps (Flutter):** patient app and technician app, using the same API and database.

## Layout

```
database/schema.sql              base schema + seed (admin user, sample tests)
database/migrations/002…004      Arogya features (run in order after schema.sql)
web/includes/                    bootstrap, catalogue, rewards, health, sign-in, finder helpers
web/public/                      document root: portals, /api, share links
  patient/  technician/  admin/  auth/  api/index.php
web/bin/send_reminders.php       hourly cron: appointment, retest and medicine reminders
mobile/patient_app/              Flutter patient app
mobile/technician_app/           Flutter technician app
tests/e2e.py                     end-to-end test (web + API + cron) against a real database
Dockerfile, docker-compose.yml
.github/workflows/               builds both release APKs
```

## Features

### Client scope
| Item | Where |
|---|---|
| Patient login, profile, appointment history, report access | `patient/` |
| Technician login, assigned jobs, On Way / Sample Collected | `technician/` |
| Test and rate-card management | `admin/tests.php` |
| Technician management and assignment | `admin/technicians.php`, `admin/appointments.php` |
| Workflow: Booked → Assigned → On Way → Sample Collected → Report Ready | `STATUS_FLOW` in `includes/bootstrap.php` |
| Secure PDF report upload (content-checked, random names, owner-only download) | `admin/appointments.php` |
| Daily / weekly / monthly order and financial reports, CSV export | `admin/reports.php` |
| Reminders, notifications (in-app, email, SMS gateway, push), receipts | cron, `notify()`, `receipt.php` |
| Patient app: booking, Razorpay payment, live status, reports | `mobile/patient_app` |
| Technician app: jobs, status updates, navigation, sync | `mobile/technician_app` |

### Ported from Arogya
| Feature | Where |
|---|---|
| Packages (BASIC / STANDARD / PREMIUM) | `admin/packages.php`, booking |
| Diagnostic centres, 20 km service radius, village pickup points, visit schedules | `admin/centers.php` |
| Collection modes: home visit, pickup point, walk-in | booking |
| Partner labs and per-test routing with turnaround | `admin/partner_labs.php` |
| Offers / coupons (percent or flat, caps, minimum order, limits, expiry) | `admin/coupons.php`, booking |
| Wallet, referral rewards (₹100 each), wallet at checkout, refund on cancel | `patient/wallet.php` |
| Family members: book for parents and children | `patient/family.php` |
| Support tickets with replies and status | `patient/support.php`, `admin/support.php` |
| Prescription and document upload, admin review | `patient/documents.php`, `admin/documents.php` |
| Invoices | `invoice.php` |
| Lab result values with automatic out-of-range flags | `admin/results.php` |
| Insights: result trends, home readings, goals, retest due list | `patient/insights.php` |
| Health tracker: BP, sugar, weight, pulse, goals, medicines with reminders | `patient/health.php` |
| Retest reminders (HbA1c 90 d, thyroid 180 d, others yearly) | cron |
| Share a report with a doctor (expiring, revocable link) | appointment page, `share.php` |
| Test finder ("which test do I need?"): Gemini AI, with keyword fallback | `patient/finder.php` |
| Sign-in: password, phone OTP, Google, passkeys (fingerprint / face) | `login.php`, `auth/` |
| Technician leaves, India public holidays (Google Calendar import), salary | `technician/leaves.php`, `admin/leaves.php`, `admin/salary.php` |
| Field alerts: admins see what technicians do | `admin/alerts.php` |
| Push notifications (Firebase Cloud Messaging HTTP v1) | `includes/health.php` |

## Run locally

```bash
docker compose up --build
# Web: http://localhost:8080    API: http://localhost:8080/api
```

The default admin login is phone `9999999999`, password `Admin@123`. **Change it immediately.**

Schedule the reminders hourly: `0 * * * * php /var/www/html/bin/send_reminders.php`

## Settings (environment variables)

| Variable | Needed for |
|---|---|
| `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS` | Database |
| `APP_URL` | Share links and passkeys (must be the public `https://` address) |
| `APP_NAME`, `APP_TIMEZONE` (default `Asia/Kolkata`) | Branding and times |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Online payment. Without them, admin marks cash payments as paid. |
| `SMS_GATEWAY_URL` with `{phone}` and `{text}` | SMS alerts and phone-OTP login |
| `MAIL_FROM` | Email notifications |
| `GOOGLE_CLIENT_ID` | "Continue with Google" |
| `GEMINI_API_KEY` (optional `GEMINI_MODEL`) | AI test finder. Without it, keyword matching is used. |
| `FCM_SERVICE_ACCOUNT` (path to a Firebase service-account JSON) | Push notifications |
| `UPLOAD_DIR`, `DOC_DIR` | Where reports and documents are stored (keep outside the web root) |

Passkeys need HTTPS on the real domain (or `localhost`).

## Upgrading an existing database

Run each file once, in order: `database/migrations/002_arogya_features.sql`, `003_phase2_wallet_family_support.sql`,
then `004_phase3_health_staff_auth.sql`. A fresh `docker compose up` runs them all automatically.

## Android APKs

The `Build APKs` GitHub Actions workflow builds both release APKs on every push to `main` that touches `mobile/`.
To point the apps at your server, run it from the Actions tab with `api_base` set, e.g. `https://your-domain.com/api`,
then download the APKs from the run's artifacts.

## Tests

`tests/e2e.py` registers patients, sets up the centre, books with packages, coupons, family and wallet, and runs the full
technician workflow. It also checks payments and referral rewards, report upload, results and share links, support,
uploads, the health tracker, test finder, leaves, salary and role isolation, plus every page, the API and the cron job.
How to run it is at the top of the file.

## Not included

- Push in the Flutter apps needs your `google-services.json` and the `firebase_messaging` plugin. The server side is ready (`POST /api/devices`).
- Passkeys, Google and OTP sign-in work on the website; the apps use password login for now.
- Arogya's "Digital wellbeing" (phone-usage tracking) needs native Android permissions and was not ported.
