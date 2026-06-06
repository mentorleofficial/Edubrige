## Problem

Two issues on the mentor dashboard "Pending mentee feedback" card:

1. **Wrong count (always shows pending even when rated).** `useMentorDashboardData` fetches feedback with `.eq("audience", "mentor")` — that's feedback submitted BY mentees ABOUT the mentor. The pending-feedback logic in `MentorInsightsPanel` then builds `ratedIds` from `feedback.filter(f => f.submitted_by === userId)`, but no mentor-audience rows are submitted by the mentor → `ratedIds` is always empty → count equals total completed sessions. So the card never hides even after the mentor rates everyone.

2. **No visibility into which mentees are pending.** The card just shows a number with a generic "Share feedback" link to `/mentor/sessions`. The user wants to see who's pending.

## Fix

### 1. Fetch the right feedback rows (`src/features/mentor-dashboard/useMentorDashboardData.ts`)

Replace the single `audience = 'mentor'` query with both audiences so the dashboard has the data it needs:

```ts
const fbRes = await supabase
  .from("feedback")
  .select("id, session_id, rating, comment, created_at, submitted_by, audience")
  .in("audience", ["mentor", "mentee"])
  .in("session_id", sessionIds);
```

Add `audience` to `MentorDashFeedback` type. Existing consumers that only care about `audience='mentor'` (e.g. `RecentFeedbackPanel`) keep working by filtering client-side.

### 2. Filter mentor-audience consumers (`src/components/dashboards/mentor/RecentFeedbackPanel.tsx`)

Filter incoming `feedback` to `audience === 'mentor'` before rendering so the "Recent Feedback" panel still only shows what mentees said about the mentor.

### 3. Show pending mentees inline (`src/components/dashboards/mentor/MentorInsightsPanel.tsx`)

- Compute `ratedIds` from `feedback.filter(f => f.submitted_by === userId && f.audience === 'mentee')`.
- Build `pendingSessions = completedSessions.filter(s => !ratedIds.has(s.id))` (full objects, not just count).
- If `pendingSessions.length === 0`, render nothing (already handled by the guard once the count is correct).
- Otherwise render the card with a small list (max 3 visible, "+N more" link to `/mentor/sessions`) showing for each pending session:
  - Mentee avatar + name (from `s.mentee?.full_name`)
  - Session date (short format, IST via existing `formatIST*` helpers)
  - "Rate" button linking to `/session/${s.id}/feedback`

Layout stays compact inside the existing amber bordered card; uses semantic tokens, no hard-coded colors beyond the existing amber accent.

## Scope

- `src/features/mentor-dashboard/useMentorDashboardData.ts` — widen feedback query + type.
- `src/components/dashboards/mentor/RecentFeedbackPanel.tsx` — filter to mentor audience.
- `src/components/dashboards/mentor/MentorInsightsPanel.tsx` — fix logic, render mentee list.
- No backend, RLS, schema, or other component changes.

## Verification

- Mentor with all completed sessions rated → card disappears.
- Mentor with 2 unrated completed sessions → card shows both mentee names with Rate buttons; clicking opens `/session/:id/feedback`; after submitting, dashboard refetch hides that entry.
- "Recent Feedback" panel still only shows mentee→mentor ratings.
