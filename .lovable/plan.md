# Admin Dashboard Upgrade

Turn the admin home from a flat 6-stat grid into a real operations cockpit covering platform health, growth, engagement, moderation queues, and live activity.

## New layout

```text
+---------------------------------------------------------+
| KPI strip:                                              |
|  Users | Mentors | Mentees | Sessions | Hours | Avg ★   |
+---------------------------------------------------------+
| Growth chart (last 30 days)     | Action Queue          |
|  - new signups / day            | - Pending mentor apps |
|  - sessions booked / day        | - Disabled accounts   |
|                                 | - Empty programs      |
|                                 | - Missing branding    |
+---------------------------------------------------------+
| Today / Next 7 days schedule    | Platform Health       |
|  - today booked count           | - JWT auth enabled    |
|  - week timeline                | - Avg rating trend    |
|                                 | - Cancellation rate   |
+---------------------------------------------------------+
| Top Mentors (by sessions + ★)   | Recent Feedback       |
+---------------------------------------------------------+
| Recent Sessions (existing list, polished)               |
+---------------------------------------------------------+
| Recent Audit Activity (last 8 entries)                  |
+---------------------------------------------------------+
```

## Sections

1. **KPI strip (6 cards)** — Total users, mentors, mentees, all-time sessions, total hours delivered, platform average rating. Each card links to its admin page.
2. **Growth chart** — 30-day stacked area/line using `recharts` showing daily signups (from `users.created_at`) and daily sessions booked (from `sessions.created_at`). Toggle between the two series.
3. **Action Queue** — counts that need admin attention with deep links:
   - Pending mentor applications (`mentor_applications.status = 'pending'`)
   - Disabled users (`users.is_disabled = true`)
   - Programs with zero mentees or zero mentors
   - Missing branding fields (no logo, default app name)
4. **Today / Next 7 days** — today's session count + a 7-day strip mirroring the mentor view (booked counts per day, distinct mentors active).
5. **Platform Health** — small panel:
   - JWT auth enabled/disabled chip from `jwt_config.enabled`
   - 30-day vs prior-30-day average rating delta
   - 30-day cancellation rate (% of cancelled / (cancelled+completed))
6. **Top Mentors** — top 5 mentors by completed sessions, with their avg rating; avatar + link.
7. **Recent Feedback** — last 5 mentor-audience feedback entries with rating + truncated comment.
8. **Recent Sessions** — keep existing list, add a status filter chip and mentor/mentee avatars.
9. **Recent Audit Activity** — last 8 `audit_logs` rows showing action, entity_type, actor, time. Link to full audit page.

## Technical notes

- New folder `src/components/dashboards/admin/` with sub-components: `KpiStrip`, `GrowthChart`, `ActionQueue`, `WeekSchedule`, `PlatformHealth`, `TopMentors`, `RecentFeedback`, `RecentSessions`, `RecentAudit`.
- Single hook `src/features/admin-dashboard/useAdminDashboardData.ts` running parallel Supabase queries with `react-query` (staleTime 30s):
  - Count queries: total users, mentors, mentees, sessions, completed sessions (for hours), pending applications, disabled users.
  - `sessions` for the last 30 days (id, scheduled_at, created_at, duration_minutes, status, mentor_id, mentee_id) — drives growth chart, week strip, cancellation rate.
  - `users` created in last 30 days (id, created_at, role) for signup series.
  - `feedback` last 30 days + prior 30 days (rating, comment, created_at, session_id, audience) for avg rating delta, platform avg, and recent feedback.
  - `mentor_applications` count where status='pending'.
  - `programs` with embedded `program_mentees(count)` and `program_mentors(count)` to find empty programs.
  - `branding` single row to detect missing logo / default app_name.
  - `jwt_config` row for JWT enabled chip.
  - `audit_logs` order by created_at desc limit 8, joined with users for actor name.
  - Top mentors: aggregate client-side from sessions+feedback (no schema change).
- Chart uses existing `recharts` (already in `package.json`) and the existing `ui/chart.tsx` wrapper. Keep colors from semantic tokens (`hsl(var(--primary))`, `hsl(var(--accent))`).
- Replace body of `src/components/dashboards/AdminDashboard.tsx`. Keep links and section spacing consistent with mentor/mentee dashboards (`space-y-6`, semantic tokens, `var(--font-serif)` for section headings only if used elsewhere).
- Loading skeletons + empty states for each panel. Mobile: KPI strip wraps to 2 cols, two-column rows stack.
- No DB schema changes, no new RLS policies, no edge functions. All queries rely on existing admin RLS (`has_role(auth.uid(),'admin')`).

## Out of scope

- New admin pages or routes
- Schema or migration work
- Mentor / mentee dashboards (already shipped)
- Bulk-action UI in the action queue (counts and deep links only)
