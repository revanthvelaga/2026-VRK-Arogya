# Step 10 — Notifications + report upload/download

## In plain language

Up to this point, the only way to find out what was happening to a
booking was to go check — open the app, look at the tracking stepper.
This step adds two things real customers actually expect: getting told
when something happens, and being able to download the actual PDF report
once results are in.

**Notifications** — every customer now gets a real, saved notification
at the moments that matter:

- Booking confirmed
- Sample collected
- Results ready
- Report uploaded and ready to download

These are always saved (queryable via `GET /notifications/mine`), and
where the customer has an email on file, a real email is also sent —
not a fake one. There's a genuine, working SMTP integration behind this;
in development it uses a free, zero-signup test inbox automatically, so
it works out of the box without anyone having to sign up for anything.
SMS and push notifications aren't built — both need a paid (Twilio) or
platform-specific (Firebase) account this project doesn't have set up,
so rather than fake them, the code is written so plugging either in
later is a small, contained change (see "In technical terms").

**Report upload/download** — staff/admin can now attach a PDF report to
a booking. Only the customer who owns that booking (or staff/admin) can
download it. Uploading one automatically sends the customer a
notification that it's ready.

## In technical terms

- **`apps/api/src/notifications`** — `Notification` entity, backed by a
  new `notifications` table (not in the original `schema.sql`).
  `NotificationsService.notify(userId, type, message)` is the one method
  every other module calls; it always writes the in-app row first, then
  attempts email delivery **in the background**, never blocking the
  caller. `GET /notifications/mine` and `PATCH /notifications/:id/read`
  are the two endpoints any authenticated user has for their own
  notifications.
- **`EmailChannelService`** — real email over real SMTP via Nodemailer.
  With `SMTP_HOST` set (see `.env.example`), it uses that provider; with
  nothing set, it creates a free Ethereal test account automatically and
  logs a preview link for every email sent, so the whole path is
  verifiable without any signup. SMS (Twilio) and push (Firebase Cloud
  Messaging) aren't implemented — both need real, often paid,
  credentials — but `notify()` is the single place either would plug in
  as another channel, alongside email.
- **`apps/api/src/reports`** — `Report` entity, extending `schema.sql`'s
  original `reports` table (`booking_id`, `file_url`, `generated_at`,
  `reviewed_by`) with `fileName`/`mimeType`/`sizeBytes`/`uploadedBy` — an
  upload/download flow actually needs those. Files are stored on local
  disk today (`apps/api/uploads/reports/`, gitignored) via a Multer
  `diskStorage` config that only accepts `application/pdf`, capped at
  10MB. `fileUrl` holds whatever path/URL actually stores the file, so
  swapping in real S3 storage later only touches
  `reports.multer-options.ts`, nothing else.
  - `POST /bookings/:bookingId/reports` — `ADMIN`/`STAFF` only.
  - `GET /bookings/:bookingId/reports` — the booking's owner, or
    `ADMIN`/`STAFF` (same ownership check `SamplesModule` reuses from
    `BookingsService.findOneForUser()`).
  - `GET /reports/:id/download` — same ownership check; streams the file
    back via Nest's `StreamableFile`. The raw disk path is never returned
    in any JSON response — download is the only way to get the bytes.
- **Real triggers wired in**, not just endpoints that exist in
  isolation: `BookingsService.create()` notifies on `BOOKING_CREATED`;
  `SamplesService.updateStatus()` notifies on `COLLECTED` and
  `RESULT_READY` only (not every intermediate transit/at-center step);
  `ReportsService.upload()` notifies on `REPORT_READY`.
- **A real bug found and fixed while building this**: the first version
  of `notify()` awaited email delivery inline inside a `try/catch`. That
  correctly prevented an *error* from reaching the caller, but did
  nothing about *latency* — in an environment with no outbound raw-SMTP
  route, a single `POST /bookings` call took **~2 minutes** to return
  (Nodemailer's default connection timeout), because the `try/catch`
  only fires once the `await` finally settles. Confirmed with `time
  curl`: ~120s before the fix, 29ms after. Fixed by making email
  delivery genuinely fire-and-forget and adding explicit 8-second
  timeouts to the SMTP transport as a second layer of defense. Full
  writeup: [`flows/11-notifications-reports-flow.md`](../flows/11-notifications-reports-flow.md#a-real-bug-this-step-found-worth-reading).

### Try it

With the API running:

```
# Register (or log in) as a customer, then book a test — you'll see a
# BOOKING_CREATED notification immediately:
curl http://localhost:3000/notifications/mine -H "Authorization: Bearer <token>"

# As ADMIN/STAFF, advance a sample to COLLECTED then RESULT_READY —
# each one adds a notification for the booking's customer.

# Upload a report (ADMIN/STAFF only):
curl -X POST http://localhost:3000/bookings/<bookingId>/reports \
  -H "Authorization: Bearer <staffToken>" \
  -F "file=@report.pdf;type=application/pdf"

# Download it (as the booking's owner, or ADMIN/STAFF):
curl http://localhost:3000/reports/<reportId>/download \
  -H "Authorization: Bearer <token>" -o report.pdf
```

Watch the API's console log — every email attempt logs either a preview
URL (Ethereal, or wherever `SMTP_HOST` points) or a warning if delivery
failed, without ever affecting the response you got back.

## What's next

Step 11 (the last item in the original build order) is **Dockerize +
GitHub Actions CI + a deployment guide** — turning "runs on my machine"
into something that can actually be deployed. No frontend work is
implied by this step; report-download buttons and a notifications list
in `admin-web`/`customer-web`/`apps/mobile` are a real, worthwhile
follow-up, not yet built.
