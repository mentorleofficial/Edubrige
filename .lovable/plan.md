# Feedback Module

Build out a full post-session feedback experience on top of the existing `feedback` table and `SessionFeedback` page. Today only a mentee can rate a completed session from the sessions list. We'll make it a proper two-sided module with prompts, an aggregated mentor view, and an admin dashboard.

## What we're building

1. **Two-sided feedback**
   - Mentees rate the mentor (already exists, polish copy + thank-you state).
   - Mentors give brief feedback on the mentee (1–5 stars + optional comment, optionally a private note visible to admins only).
   - Reuse `SessionFeedback` page; route works for both roles, behavior switches by who the viewer is.

2. **Prompt after a session**
   - When a session moves to `completed`, surface a "Leave feedback" CTA:
     - Mentee Sessions: highlight a "Rate session" button on completed rows that have no feedback yet.
     - Mentor Sessions: same, "Rate mentee".
   - Dashboard widget ("Pending feedback") listing completed sessions awaiting your rating, with one-click links.

3. **Mentor profile / mentee view of received feedback**
   - Mentor profile page shows average rating and total reviews from mentees.
   - Public mentor profile shows the same aggregate (no individual comments unless we choose to).
   - Mentor's own dashboard lists feedback they've received (rating + comment + date, mentee anonymized as "Mentee").

4. **Admin feedback page**
   - New route `/admin/feedback`: filterable table of all feedback (session, mentor, mentee, rating, comment, date).
   - Summary cards: average rating overall, number of responses, low-rating count (<=2).
   - Linked from Admin sidebar.

5. **One-feedback-per-session-per-user constraint**
   - DB unique on `(session_id, submitted_by)` so the same person can't double-submit.
   - UI hides the prompt once submitted and shows a "Thanks – your rating" summary instead.

## Technical details

- **DB migration**
  - Add unique index on `feedback (session_id, submitted_by)`.
  - Add `audience` column (`enum: 'mentor' | 'mentee' | 'admin_private'`, default `'mentor'`) to capture who the feedback is *about* / who can see it. Mentor-on-mentee feedback uses `'mentee'`; private notes use `'admin_private'`.
  - Update RLS:
    - Mentee can insert with `audience='mentor'` for their own session.
    - Mentor can insert with `audience IN ('mentee','admin_private')` for their own session.
    - Mentor can read `audience='mentor'` rows on their sessions.
    - Mentee can read `audience='mentee'` rows on their sessions (so they see the mentor's rating of them).
    - Admin keeps full access.

- **Pages / components**
  - `SessionFeedback.tsx`: detect role from session row, adapt labels and `audience` value sent.
  - New `src/pages/AdminFeedback.tsx` + route + sidebar link (admin only).
  - `MentorSessions.tsx` / `MenteeSessions.tsx`: query the `feedback` table for the viewer's submissions to toggle "Rate" vs "Submitted" pill.
  - Mentor profile + public mentor profile: select `avg(rating), count(*)` from feedback joined to that mentor's sessions where `audience='mentor'`.
  - Dashboard widget added to `MentorDashboard` and `MenteeDashboard`: "Pending feedback (N)".

- **No changes** to booking, email, Jitsi link, or auth flows.

## Out of scope

- Editing or deleting submitted feedback.
- Public display of individual mentor reviews/comments.
- Anonymous feedback toggles, NPS, or follow-up surveys.
