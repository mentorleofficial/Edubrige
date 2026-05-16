# Mentor Dashboard Upgrade

Bring the mentor home view to parity with the new mentee dashboard: an at-a-glance command center for their day, mentees, programs, and reputation.

## New layout

```text
+---------------------------------------------------------+
| Greeting + active/inactive chip + "this week" summary   |
+---------------------------------------------------------+
| Next Session hero (mentee, time, countdown, Join, notes)|
+---------------------------------------------------------+
| Stats row:                                              |
|  Upcoming | Completed | Hours Mentored | Avg ★ | Mentees|
+---------------------------------------------------------+
| Weekly schedule timeline   | Insights & Action Items    |
| (7-day strip with sessions)| - Sessions needing notes   |
|                            | - Pending mentee feedback  |
|                            | - Availability gaps        |
|                            | - Profile completeness     |
+---------------------------------------------------------+
| My Mentees (recent / active)                            |
+---------------------------------------------------------+
| My Programs (existing)                                  |
+---------------------------------------------------------+
| Recent Feedback (latest ratings + comments)             |
+---------------------------------------------------------+
| Recent Activity feed (booked / cancelled / completed)   |
+---------------------------------------------------------+
```

## Sections

1. **Greeting header** — "Welcome back, {name}" + chip showing sessions this week and hours booked. Inactive mentors keep the existing `InactiveMentorBanner` on top.
2. **Next Session hero** — large card with mentee avatar/name, scheduled time (relative + absolute), live countdown, Join meeting button (uses `meeting_url`), Add to calendar, and a quick link to add session notes. Empty state: "No upcoming sessions — share your profile" with a copy-link button to the public profile.
3. **Stats row (5 cards)**:
   - Upcoming sessions
   - Completed sessions
   - Total hours mentored (sum of `duration_minutes` of completed sessions)
   - Average rating received (`feedback.audience = 'mentor'` on own sessions)
   - Unique mentees served (distinct `mentee_id` across all sessions)
4. **Weekly schedule timeline** — next 7 days as a horizontal strip; each day shows session count and time chips. Clicking a day filters the sessions list below it.
5. **Insights & Action Items**:
   - Sessions completed in last 14 days with empty `notes` → "Add notes" link
   - Sessions completed without mentee feedback yet → "Leave private feedback" link
   - No availability set for the next 14 days → link to `/mentor/availability`
   - Profile completeness (bio, expertise, qualifications, experiences, resume, avatar) shown as a progress ring; link to `/mentor/profile`
6. **My Mentees** — up to 6 mentees from `program_mentees` (via mentor's programs) and `mentor_mentee_assignments`, sorted by most recent session; each card shows avatar, name, sessions count, last session date, and link to their sessions.
7. **My Programs** — keep the existing chip list as is.
8. **Recent Feedback** — last 3 entries from `feedback` where `audience = 'mentor'` on the mentor's sessions; show rating stars + truncated comment + relative time.
9. **Recent Activity** — last 5 events derived from `sessions` (booked / cancelled / completed) with timestamps.

## Technical notes

- New folder `src/components/dashboards/mentor/` with sub-components: `NextSessionCard`, `MentorStatsRow`, `WeeklySchedule`, `MentorInsightsPanel`, `MyMenteesPanel`, `RecentFeedbackPanel`, `RecentActivityFeed`. Mirrors the mentee dashboard structure.
- Single data hook `src/features/mentor-dashboard/useMentorDashboardData.ts` running parallel Supabase queries:
  - `sessions` for `mentor_id = user.id` (all, ordered by `scheduled_at`) — drives upcoming, completed, hours, next session, weekly timeline, activity feed, needs-notes list.
  - `feedback` filtered by `session_id IN (mentor's sessions)` and `audience = 'mentor'` — drives avg rating + recent feedback.
  - `users` join for mentee names/avatars (allowed by existing RLS via `program_mentees` / `mentor_mentee_assignments`).
  - `mentor_profiles` row for the current user — drives the profile-completeness ring.
  - `mentor_availability` for the next 14 days — drives the availability-gap insight.
  - Reuse `useMyPrograms` for the programs card.
- No DB schema changes; no new RLS policies.
- Keep semantic Tailwind tokens (`bg-card`, `text-primary`, etc.) and `var(--font-serif)` for headings; match the visual style already established by the mentee dashboard for consistency.
- Loading skeletons and empty states for each section. Mobile-responsive: stats wrap to 2 cols, weekly strip becomes scrollable, side panels stack.
- Replace the body of `src/components/dashboards/MentorDashboard.tsx` to compose the new sections; keep `InactiveMentorBanner` behaviour intact (inactive mentors see banner + a slimmed dashboard with only profile completeness + programs + activity).

## Out of scope

- Mentor availability editor changes
- New backend tables, columns, migrations, or edge functions
- Admin or mentee dashboards
