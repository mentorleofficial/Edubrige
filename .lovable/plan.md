## Current state (already in place)

Most of what you asked for is already wired up:

- **Jitsi link generated & stored**: On booking, `BookSession.tsx` generates `https://meet.jit.si/mentorle-<sessionId>` and writes it to `sessions.meeting_url`.
- **Emails to mentor + mentee**: `send-booking-email` edge function sends two Brevo emails from `noreply@mentorle.in` (mentor template + mentee template, both with the Jitsi link and "Add to Google Calendar").
- **Post-booking confirmation**: The booking page already shows a "Session booked!" card with a Join meeting button.
- **Meeting link visible on sessions pages**: `MenteeSessions.tsx` and `MentorSessions.tsx` show the link in the expanded row.

## What's missing / to do

### 1. Add a prominent "Join now" button on session rows

Today the meeting link is rendered as a plain anchor inside the expandable detail row. Make it a first-class action button that's always visible on the row (not buried in the detail expansion), so mentors and mentees can join with one click.

- **`src/pages/MenteeSessions.tsx`**: in the action cell of each `booked` session row, add a `<Button asChild variant="default" size="sm">` with a `Video` icon, label "Join now", linking to `s.meeting_url` (target=_blank). Show only when `status === 'booked'` and `meeting_url` exists.
- **`src/pages/MentorSessions.tsx`**: same treatment in the action cell.
- Keep the existing copy-link UI in the expanded detail row.

### 2. Verify email delivery end-to-end

No logs exist for `send-booking-email` yet, which means either it hasn't been invoked since the last deploy, or invocations are silently failing client-side. Steps:

- Deploy `send-booking-email` to ensure latest code is live.
- Test it directly with a sample payload via curl to confirm Brevo accepts the `BREVO_API_KEY` (returns 200, not 401).
- If 401: re-prompt to update `BREVO_API_KEY` (must start with `xkeysib-`).
- If 400 with sender error: confirm `noreply@mentorle.in` is verified in Brevo → Senders & IP → Senders.

### 3. (Optional) Make email failures observable

Currently the invoke is fire-and-forget with only a console.error. Add a non-blocking toast on email failure so the mentee at least knows "Booking saved, email could not be sent" — they still have the on-screen Join button as fallback.

## Files

- **Edited**: `src/pages/MenteeSessions.tsx` — add "Join now" button to row actions.
- **Edited**: `src/pages/MentorSessions.tsx` — add "Join now" button to row actions.
- **Edited**: `src/pages/BookSession.tsx` — surface email send failure as a soft toast (optional).
- **No code change** to `supabase/functions/send-booking-email/index.ts` or `sessions` schema — the link is already stored and the function already sends from `noreply@mentorle.in`.

## Out of scope

- Switching email providers (staying on Brevo).
- Reminder emails before the session.
- Replacing Jitsi with another meeting provider.
