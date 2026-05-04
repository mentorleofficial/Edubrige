## Auto Meet Links + Email Notifications + Add to Calendar

Wire up three booking enhancements: auto-generate a Jitsi meet link on every booking, email both parties on confirmation, and add an "Add to Calendar" menu (.ics + Google Calendar) on every upcoming session row.

### 1. Auto-generated Jitsi meet link

- On every successful insert into `sessions` (in `BookSession.tsx`), generate a unique room URL: `https://meet.jit.si/mentorle-{sessionId}` (using the returned session id — guaranteed unique, no collisions, no auth required).
- Immediately follow up with a single `update sessions set meeting_url = ...` for that row.
- Mentor can still override the link via the existing "Notes/Link" dialog in `MentorSessions.tsx` (no change needed there — they just edit what was auto-set).
- Mentee always sees the link in their session row (already implemented).

### 2. Email notifications on booking

Use Lovable's built-in email infrastructure (transactional email).

**Setup steps (handled automatically):**
- Set up email domain (one-time, via dialog) if not configured.
- Set up email infrastructure (queue + tables + cron) — `setup_email_infra`.
- Scaffold transactional email function — `scaffold_transactional_email`.

**Templates created** in `supabase/functions/_shared/transactional-email-templates/`:
- `booking-confirmation-mentee.tsx` — "Your session with {mentor} is booked", includes date/time, meet link, and a one-click "Add to Google Calendar" link.
- `booking-confirmation-mentor.tsx` — "New session booked by {mentee}", same details, plus the mentee's discussion notes.

Both registered in `registry.ts`.

**Trigger** — in `BookSession.tsx` after the session insert + meet-link update succeed, fire two `supabase.functions.invoke('send-transactional-email', ...)` calls in parallel:
- One to mentee email, one to mentor email.
- `idempotencyKey: \`booking-mentee-${sessionId}\`` and `booking-mentor-${sessionId}` — safe against retries.
- `templateData`: mentor name, mentee name, ISO date, formatted date, meet link, duration, mentee notes, Google Calendar quick-add URL.

We need both parties' email addresses — fetch the mentee email from the existing auth `user.email` and the mentor email via the existing `users` table query in `BookSession.tsx` (add `email` to the mentor select).

### 3. Add to Calendar dropdown

Create `src/lib/calendarLinks.ts` with two pure helpers:
- `buildIcsContent({ title, description, location, startISO, durationMinutes })` → returns RFC-5545 .ics text. Triggers download via `Blob` + temporary anchor.
- `buildGoogleCalendarUrl({ title, details, location, startISO, durationMinutes })` → returns `https://calendar.google.com/calendar/render?action=TEMPLATE&...` URL.

Add a reusable component `src/components/AddToCalendarMenu.tsx` — a `DropdownMenu` button labeled "Add to Calendar" with two items:
- "Download .ics file"
- "Add to Google Calendar" (opens in new tab)

Render it in two places, but only for **upcoming, booked** sessions:
- `MenteeSessions.tsx` — Actions column (next to Reschedule / Cancel).
- `MentorSessions.tsx` — Actions column (next to Complete / No-show / Cancel).

Title format: `Mentorship session with {other party name}`. Description includes meet link and (for mentor) the mentee's discussion notes.

### Out of scope

- No Google OAuth, no real Google Meet, no per-mentor calendar sync.
- No reminder emails, no cancellation/reschedule emails (this round).
- No DB schema changes — `meeting_url` column already exists.

### Files

**New:**
- `src/lib/calendarLinks.ts`
- `src/components/AddToCalendarMenu.tsx`
- `supabase/functions/_shared/transactional-email-templates/booking-confirmation-mentee.tsx`
- `supabase/functions/_shared/transactional-email-templates/booking-confirmation-mentor.tsx`

**Edited:**
- `src/pages/BookSession.tsx` — fetch mentor email, set meeting_url after insert, send 2 emails.
- `src/pages/MenteeSessions.tsx` — render AddToCalendarMenu for upcoming sessions.
- `src/pages/MentorSessions.tsx` — render AddToCalendarMenu for upcoming sessions.
- `supabase/functions/_shared/transactional-email-templates/registry.ts` — register both templates.
