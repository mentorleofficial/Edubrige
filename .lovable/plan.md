## Problem

1. **Emails fail to send.** Edge function logs show `Brevo 401: {"message":"Key not found","code":"unauthorized"}` for both mentor and mentee sends. The `BREVO_API_KEY` secret is set, but Brevo is rejecting it as invalid/unknown.
2. **No post-booking confirmation.** After a successful booking, `BookSession.tsx` immediately navigates to `/mentee/sessions`, so the mentee never sees the generated Jitsi meeting link or a clear "Join meeting" CTA.

## Plan

### 1. Re-key Brevo (resolves the 401)

The 401 "Key not found" is Brevo telling us the value stored in `BREVO_API_KEY` is not a recognized v3 API key. Common causes: an SMTP relay key/password was pasted instead of an API key, the key was deleted/rotated in Brevo, or a stray newline/space crept in.

I'll re-prompt to update `BREVO_API_KEY` with a fresh **v3 API key** generated from Brevo → SMTP & API → API Keys (https://app.brevo.com/settings/keys/api). It must start with `xkeysib-`. After updating, no code change is needed — the function already reads `BREVO_API_KEY` and posts to `https://api.brevo.com/v3/smtp/email`.

Also confirm in Brevo that **`noreply@mentorle.in`** is listed as a verified sender under Senders & IP → Senders, otherwise sends will fail with a different 400 error after the key is fixed.

### 2. Show booking confirmation with Jitsi link in-page

Replace the immediate `navigate("/mentee/sessions")` with a success state rendered inside `BookSession.tsx`:

- Add `bookedSession` state holding `{ scheduledAt, meetingUrl }`.
- On successful booking, set this state instead of navigating.
- Render a confirmation card showing:
  - "Session booked!" heading + formatted date/time + mentor name
  - Large primary **Join meeting** button (`<a href={meetingUrl} target="_blank">`) — visible immediately
  - The raw Jitsi URL underneath (copyable)
  - Reuse existing `AddToCalendarMenu` component for "Add to Calendar"
  - Secondary buttons: "View my sessions" → `/mentee/sessions`, "Book another" → resets state
- Keep the toast notification.
- Reschedule flow keeps current behavior (navigates back) since there's no new meeting link to show.

### Files

- **Edited**: `src/pages/BookSession.tsx` — add success state + confirmation card with Jitsi CTA.
- **No code change** to `supabase/functions/send-booking-email/index.ts` — the fix is the secret value.

### Out of scope

- Adding the same in-page confirmation to reschedule flow.
- Email retries / fallback provider.
