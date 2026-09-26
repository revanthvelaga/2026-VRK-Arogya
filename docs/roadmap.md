# Arogya — roadmap & open items

Running notes of what's planned, what's waiting on the owner, and known
issues. Last updated 25 Sep 2026.

## Planned features (agreed in principle, not built yet)

### 1. Targets page (admin console)
Set monthly targets and see progress plus the data behind each one.
- Targets: bookings, revenue, new customers, repeat customers.
- Per target: progress bar ("62 / 100, 62%"), days left, on-track or
  behind at the current pace, and how many per day are needed from now.
- Breakdowns: by center, by test/package, home visit vs walk-in,
  new vs returning, and **where customers came from**.
- Needs one new piece of data: an optional "Where did you hear about us?"
  (doctor, Google, WhatsApp, friend, other) at signup or first booking.
  Referral-code signups are counted automatically.
- Open question: monthly only, or also per-center / per-agent / daily?

### 2. Medicine reminders with voice
Builds on the existing medicines list (today it's just name, dosage and
a free-text schedule — no reminders).
- Per medicine: exact times (e.g. 08:00, 20:00), before/after/with
  food, start and end dates.
- "Today's doses" checklist with Taken / Skipped, plus a weekly
  adherence figure and a streak.
- Push notifications at dose time (web push). Works on Android; on
  iPhone only when the site is added to the home screen.
- Voice: the phone's built-in speech reads the reminder aloud (English,
  Telugu, Hindi) — free. Plays when the notification is tapped or the
  app is open; a website can't speak on its own while closed.
- **Prerequisite:** the API must be always-on to send reminders on time
  (Render paid plan, or at minimum an UptimeRobot ping). The Expo mobile
  app could do fully offline on-device reminders later.

### 3. Insurance cards (lightweight first)
_Started:_ customers can already upload insurance cards, Aadhaar and other
papers under Account → My documents (with Google Drive backup). What's
below is the next step: structured policy details used at booking.
- Per patient: insurer, policy number, TPA, card photos (front/back),
  "OPD covered" flag. Visible only to the account owner and admins.
- Pick the card when booking; policy details printed on the 80D invoice;
  a "claim-ready" download (invoice + report + card) for reimbursement.
- Cashless billing is later: it needs agreements with insurers/TPAs
  first (business paperwork, not code).

Suggested order: Targets → Medicine reminders → Insurance cards.

## Waiting on the owner (setup, not code)
- [ ] **Centers:** admin console → Centers → edit the three demo centers
      (Main, Suburbs, Outer Ring) with real addresses, or deactivate them.
- [ ] **Support number:** Render → arogya-customer-web →
      `VITE_SUPPORT_PHONE` (e.g. +919876543210) → save and deploy. The
      call/WhatsApp tiles stay hidden until this is set.
- [ ] **Keep the API awake:** UptimeRobot (free) pinging
      `https://arogya-api-im0i.onrender.com/health` every 5 min, or move
      the API to Render's paid Starter plan before launch.
- [ ] **Optional AI backup:** `OPENROUTER_API_KEY` on arogya-api (free
      DeepSeek/Llama models). Groq is already configured.
- [ ] **Google sign-in:** if it still fails after the FedCM change, check
      the OAuth client's Authorized JavaScript origins include
      `https://arogya-customer-web.onrender.com`, and the consent screen
      is published (or your Gmail is a test user).

- [ ] **Google Drive sync (My documents):** in Google Cloud console,
      same project as the Google sign-in client:
      1. APIs & Services → enable **Google Drive API**.
      2. Google Auth Platform → Data access → add scope `.../auth/drive.file`.
      3. Google Auth Platform → Audience → **Publish app** (or add each
         tester's Gmail under Test users). While the app is in "Testing",
         Google shows "Access blocked … has not completed the Google
         verification process" (Error 403 access_denied).

## Before the first real customer (launch checklist)
- [ ] A lab (own or partner) to process samples, and trained staff for
      home collection.
- [ ] Razorpay switched from test keys to live keys (business KYC).
- [ ] Lab registration with the state health authority.
- [ ] Privacy policy and terms pages (DPDP Act — health data). Can be
      added to the app.
- [ ] API always-on (see above). Note Supabase's free database pauses
      after about a week of no activity.
- [ ] Google Business Profile for each real center.

First-customer plan: local doctors/clinics, apartment societies and
senior-citizen groups, WhatsApp with one launch offer, the existing
referral codes, and personally following up the first 20 bookings.
Track weekly: bookings, repeat bookings, where customers came from,
complaints.

## Known issues
- **OTP SMS delivery:** Firebase setup checks out (billing, India
  region, domain), but SMS to Indian numbers can be unreliable and new
  projects start with a low daily SMS limit. If it stays unreliable,
  switch to an Indian SMS provider (MSG91 / 2Factor, ~₹0.15–0.25 per SMS,
  needs TRAI DLT registration). Password and Google sign-in don't need SMS.
- **Gemini free tier is often overloaded:** handled automatically —
  Groq answers text features first, Gemini fallbacks are tried in turn,
  and a model Google retires is swapped out on its own. Check live status
  at `https://arogya-api-im0i.onrender.com/health/ai`.
- **Mobile (Expo) app** is behind the website on features.

## Recently done (25 Sep 2026)
QA fixes ARO-01/03/04 and UI-01/03/04; AI moved to free providers
(Gemini + Groq, OpenRouter optional) with automatic fallback and a
`/health/ai` status page; `/health` shows the deployed commit; SMS
usage page and OTP on/off switch in admin; password-first sign-in with
forgot-password for customers and staff; FedCM for Google sign-in.
