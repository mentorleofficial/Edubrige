# Mentee Dashboard Upgrade

Transform the current minimal mentee dashboard (3 stat cards + program list) into an insight-rich home that gives mentees a clear view of what's next, their progress, and quick actions.

## New Layout

```text
+---------------------------------------------------------+
| Greeting + streak chip                                  |
+---------------------------------------------------------+
| Next Session (hero card: mentor, time, join, reschedule)|
+---------------------------------------------------------+
| Stat row: Upcoming | Completed | Hours Learned | Avg ★  |
+---------------------------------------------------------+
| Upcoming Calendar (month view)   | Insights & Highlights|
| - dots on booked days            | - Top mentor         |
| - click day -> day's sessions    | - Last feedback given|
|                                  | - Active programs    |
+---------------------------------------------------------+
| Recommended Mentors (from preferred areas)              |
+---------------------------------------------------------+
| Recent Activity feed (bookings, completed, feedback)    |
+---------------------------------------------------------+
```

## Sections in detail

1. **Greeting header** — "Welcome back, {name}" + a small chip showing consecutive weeks with at least one session.
2. **Next Session hero** — large card with mentor avatar/name, scheduled time (relative + absolute), countdown, Join meeting button (uses `meeting_url`), Add to calendar, and link to reschedule. Hidden when no upcoming session — replaced by a "Book your first session" CTA.
3. **Stats row (4 cards)**:
   - Upcoming sessions
   - Completed sessions
   - Total hours learned (sum of `duration_minutes` for completed sessions)
   - Average rating given to mentors (from `feedback` where `submitted_by = me` and `audience = 'mentor'`)
4. **Calendar view** — month calendar (using existing shadcn `Calendar`) with colored dots on dates that have sessions. Selecting a date shows that day's sessions in a side panel with mentor name and status.
5. **Insights & Highlights** panel:
   - Most-booked mentor (with avatar + link to profile)
   - Pending feedback prompt: count of completed sessions without feedback, with a "Leave feedback" link
   - Active programs count + quick links
   - Next availability gap reminder if no upcoming sessions in the next 14 days
6. **Recommended mentors** — pulls `list_public_mentors` filtered by overlap with the mentee's `preferred_mentor_areas`; shows up to 4 cards with a "View profile" button.
7. **Recent activity** — last 5 events (booked, completed, cancelled, feedback submitted) with timestamps.

## Technical notes

- New file: `src/components/dashboards/MenteeDashboardEnhanced.tsx` replacing the body of `MenteeDashboard.tsx` (or refactor in place). Split sub-sections into small components under `src/components/dashboards/mentee/` (NextSessionCard, StatsRow, SessionsCalendar, InsightsPanel, RecommendedMentors, RecentActivity) for maintainability.
- Data fetching: a single `useMenteeDashboardData` hook running parallel Supabase queries:
  - `sessions` for the mentee (all, ordered by `scheduled_at`) — derives upcoming, completed, hours, calendar dots, next session, recent activity.
  - `feedback` where `submitted_by = user.id` for avg rating + pending-feedback detection (cross-ref completed sessions).
  - `users` join for mentor names/avatars on next session + top mentor (already permitted via existing RLS for program mentors and active mentor users).
  - `list_public_mentors` RPC for recommendations, filtered client-side by `preferred_mentor_areas` from `mentee_profiles`.
  - Reuse `useMyPrograms` for active programs.
- No DB schema changes; no new RLS policies required.
- Keep onboarding-incomplete state exactly as today.
- Keep semantic Tailwind tokens (`bg-card`, `text-primary`, etc.) — no hard-coded colors. Use the existing `var(--font-serif)` for the greeting heading.
- Loading skeletons for each section; empty states for "no upcoming session", "no programs yet", "no recommendations".
- Mobile: stack everything; calendar collapses to "Upcoming this week" list under `md`.

## Out of scope

- Booking flow changes
- New backend tables, columns, or migrations
- Mentor or admin dashboards
