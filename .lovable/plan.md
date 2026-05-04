## Booking Confirmation Emails via Brevo SMTP API

Hook the existing booking flow into Brevo's transactional email API. Sender: `noreply@mentorle.in` (must be a verified sender in your Brevo account).

### 1. New secret

- `BREVO_API_KEY` — your Brevo API key from https://app.brevo.com/settings/keys/api. I'll prompt you to add it before the function runs.

### 2. New edge function: `send-booking-email`

**File:** `supabase/functions/send-booking-email/index.ts`

- POST endpoint, accepts `{ mentorEmail, mentorName, menteeEmail, menteeName, scheduledAtISO, durationMinutes, meetingUrl, menteeNotes? }`.
- Validates required fields, returns 400 on missing input.
- Builds two branded HTML emails (mentee + mentor variants):
  - Header, formatted date/time, duration, other party's name
  - Mentor variant includes the mentee's discussion notes
  - "Join meeting" button (Jitsi link)
  - "Add to Google Calendar" link with a pre-filled `calendar.google.com/calendar/render?action=TEMPLATE&...` URL
- Sends both in parallel via `POST https://api.brevo.com/v3/smtp/email` with `api-key: ${BREVO_API_KEY}` header.
- Sender hardcoded to `{ email: "noreply@mentorle.in", name: "Mentorle" }`.
- Returns `{ ok, errors }` so the frontend can log failures without blocking the booking UX.
- Public function (no JWT verify needed) — invoked from the booking client. CORS via `@supabase/supabase-js/cors`.

### 3. Wire it into the booking flow

**File:** `src/pages/BookSession.tsx`

- Extend the existing mentor-fetch query to also pull `email`.
- After the `sessions` insert succeeds AND the `meeting_url` update completes, fire `supabase.functions.invoke('send-booking-email', { body: {...} })`.
- Run it fire-and-forget — don't block the success toast or navigation. Errors are logged to console only (booking already saved at this point).

### Out of scope

- Cancellation / reschedule emails (we'll do these next round if you want)
- Reminder emails (would need a cron job)
- DB schema changes — none required

### Files

**New:**
- `supabase/functions/send-booking-email/index.ts`

**Edited:**
- `src/pages/BookSession.tsx` — add `email` to mentor select, invoke the function after booking.
- `supabase/config.toml` — add `[functions.send-booking-email] verify_jwt = false` so the client can call it without a service-role key.
