# Complete Booking Flow + Admin Session Oversight

The booking flow today is functional but thin: it lets a mentee pick a slot and create a `sessions` row, mentors can update status, mentees can leave feedback. Several real-world gaps remain (no slot conflict check, no cancel/reschedule, no notes, no admin visibility). This plan closes those gaps and gives Admins a proper dashboard to track bookings.

## Goals

1. A robust mentee booking flow (conflict-safe, with notes & confirmation).
2. Mentor session management (accept/complete/cancel + reschedule + notes).
3. Mentee can cancel/reschedule upcoming sessions and leave feedback after completion.
4. A new **Admin → Sessions** page with stats, filters, and the ability to intervene (cancel, reassign status).
5. Session counts surfaced on the Admin dashboard.

---

## 1. Database changes (one migration)

Add fields the flow needs and protect against double-bookings.

- `sessions` table:
  - `mentee_notes text default ''` — what the mentee wants to discuss (collected at booking).
  - `mentor_notes text default ''` — private mentor notes after the session (rename of existing `notes` is risky; instead keep `notes` and treat it as mentor_notes in UI).
  - `cancelled_by uuid` (nullable) and `cancelled_at timestamptz` (nullable) — who cancelled.
  - `cancellation_reason text default ''`.
  - `meeting_url text default ''` — optional link mentor can attach.
- Add a partial **unique index** preventing the same mentor having two `booked` sessions at the same `scheduled_at`:
  `CREATE UNIQUE INDEX sessions_mentor_slot_unique ON sessions(mentor_id, scheduled_at) WHERE status = 'booked';`
- Add an **overlap-prevention trigger** `prevent_session_overlap()` that, on INSERT/UPDATE of a `booked` session, rejects if the mentor has any other `booked` session whose `[scheduled_at, scheduled_at + duration_minutes)` interval overlaps. Same for the mentee (so a mentee can't double-book themselves).
- RLS additions:
  - Allow mentees to UPDATE their own session **only** to set `status = 'cancelled'` (policy with `WITH CHECK (mentee_id = auth.uid() AND status IN ('cancelled'))`).
  - Existing mentor UPDATE policy already covers mentor-side changes.

Validation is done via triggers (per project rule: no CHECK constraints with non-immutable expressions).

---

## 2. Booking page (`src/pages/BookSession.tsx`)

Enhancements:
- Fetch mentor's existing **booked** sessions for the next 4 weeks and **hide/disable** slots that conflict.
- Add a **"What would you like to discuss?"** textarea (saved to `mentee_notes`).
- Show a confirmation dialog ("Book {slot} with {mentor}?") before insert.
- After a successful booking, show a success card with options: View my sessions / Book another time.
- Surface DB error from the overlap trigger as a friendly toast ("That slot was just taken — please pick another.").

## 3. Mentee Sessions page (`src/pages/MenteeSessions.tsx`)

- Split view: **Upcoming** vs **Past** (tabs).
- For each upcoming `booked` session: **Cancel** button (confirm dialog → updates status to `cancelled` with optional reason) and **Reschedule** button (navigates to `/book/{mentorId}?reschedule={sessionId}` — booking page detects param, books new slot, then cancels the old one in a single client-side flow).
- Show `meeting_url` if mentor has set one (with copy button).
- Display `mentee_notes` and `mentor_notes` (read-only) under each row in an expandable area.
- Keep existing Feedback button for completed sessions.

## 4. Mentor Sessions page (`src/pages/MentorSessions.tsx`)

- Same Upcoming / Past tabs.
- Per-row actions on `booked` sessions: **Mark Complete**, **Mark No-show**, **Cancel** (with reason), **Add meeting link** (small inline editor that updates `meeting_url`).
- Add **Notes** drawer/dialog so mentor can write `notes` (mentor notes) for the session.
- Show mentee's `mentee_notes` so the mentor knows the topic before the call.

## 5. Admin Sessions page (NEW)

New route `/admin/sessions` (added to App.tsx routes and to the AppSidebar admin items between "Programs" and "Settings").

New file `src/pages/AdminSessions.tsx`:

- **Stat cards** at the top:
  - Upcoming (booked, scheduled_at >= now)
  - Completed (last 30 days)
  - Cancelled (last 30 days)
  - No-shows (last 30 days)
  - Avg rating (from feedback)
- **Filters**: status (all/booked/completed/cancelled/no_show), date range (today / this week / this month / custom), program (dropdown of programs), mentor search, mentee search.
- **Table** of sessions with columns: When · Mentor · Mentee · Program(s) · Duration · Status · Actions.
  - Action menu: View details (drawer with both notes, meeting link, feedback if any), Cancel session, Force-complete, Force no-show.
- **Export CSV** button (client-side) of currently filtered rows.
- Pagination (25/50/100 per page).

New API helpers in `src/features/admin/api/sessions.ts` and a hook `useAdminSessions(filters)` using React Query.

## 6. Admin dashboard widget (`src/components/dashboards/AdminDashboard.tsx`)

Add two cards next to the existing four:
- **Upcoming sessions** (booked, future).
- **Sessions this week** (any status, scheduled in next 7 days).
Make the existing **Sessions** card link to `/admin/sessions`. Add a small "Recent sessions" list (last 5) under the cards with a "View all" link.

## 7. Sidebar update

Add `{ title: "Sessions", icon: BookOpen, path: "/admin/sessions" }` to `adminItems` in `AppSidebar.tsx`.

---

## Files touched

- `supabase/migrations/<new>.sql` — schema, indexes, trigger, RLS policy.
- `src/pages/BookSession.tsx` — conflict filtering, notes, confirmation.
- `src/pages/MenteeSessions.tsx` — tabs, cancel, reschedule, notes display.
- `src/pages/MentorSessions.tsx` — tabs, mark actions, meeting link, notes.
- `src/pages/AdminSessions.tsx` — **new**, full oversight UI.
- `src/features/admin/api/sessions.ts` + `src/features/admin/hooks/useAdminSessions.ts` — **new**.
- `src/components/dashboards/AdminDashboard.tsx` — extra cards + recent list.
- `src/components/AppSidebar.tsx` — add Sessions link for admin.
- `src/App.tsx` — register `/admin/sessions` route.

## Out of scope (call out for follow-up if you want them)

- Email/calendar invites (would need email-domain setup + ICS generation).
- Real-time video link generation (Zoom/Meet integration).
- Automatic reminders.

Want me to also include any of those in this round, or proceed with the plan above as-is?
