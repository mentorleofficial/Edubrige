# Mentee-side performance & stability optimization

Goal: make the mentee experience feel as instant as the mentor side. Eliminate duplicate fetches, share cache between dashboard / sessions / book-session, kill loading flickers when navigating, and tighten render perf on the busiest pages (BookSession 513 lines, MenteeSessions 269 lines).

We follow the same recipe that worked for the mentor side: React Query everywhere, shared cache keys, optimistic mutations, network hygiene.

## Scope (this chunk)

In:
- `src/pages/MenteeSessions.tsx`
- `src/pages/BookSession.tsx`
- `src/pages/MenteePrograms.tsx`
- `src/pages/MenteeProgramDetail.tsx`
- `src/pages/MenteeProfile.tsx`
- `src/components/dashboards/MenteeDashboard.tsx` + `src/components/dashboards/mentee/*`
- `src/features/mentee-dashboard/useMenteeDashboardData.ts`
- `src/features/mentee-onboarding/hooks/useMenteeProfileStatus.ts`

Out (separate chunks): admin pages, public mentor pages, edge functions, DB schema, realtime.

## What we will change and why

### 1. Convert mentee pages to React Query

Today `MenteeSessions`, `MenteeProfile`, and `BookSession` use `useState + useEffect + supabase` directly. Result: every navigation triggers a full network round-trip, no cache sharing with the dashboard, and a spinner flashes every visit.

- New `useMenteeSessions(userId)` — fetches sessions + a derived `ratedSessionIds` query keyed on session ids. Cancel becomes `useMutation` with optimistic update + invalidate `["mentee", "sessions", userId]`. Mentor→program map (`mentorPrograms`) becomes a `useMemo` over a cached `program_mentees`/`program_mentors` query instead of a second `useEffect`.
- New `useMenteeProfile(userId)` — single query for `users` + `mentee_profiles` joined client-side; `saveProfile` mutation with cache update so the page no longer re-fetches on every save.
- New `useBookSessionData(mentorId)` — single hook bundling the 5 parallel queries currently in `BookSession`'s `useEffect` (mentor, availability, mentor profile, overrides, booked sessions). Booked-times query keyed separately so it can be invalidated after a successful booking without re-fetching mentor data.
- New `useMenteeProgramDetail(slug)` to replace the manual fetch in `MenteeProgramDetail`.
- `useMenteeProfileStatus` already uses React Query — verify the key matches what `MenteeOnboardingGuard` expects so we don't bounce mentees to /onboarding for one frame after they complete it.

### 2. Share the sessions cache with the dashboard

`MenteeDashboard` calls `useMenteeDashboardData` which fetches `sessions` + `feedback` + `recommended_mentors`. `MenteeSessions` re-fetches the same `sessions` rows.

- Extract the sessions query into `useMenteeSessions` with key `["mentee", "sessions", userId]`.
- `useMenteeDashboardData` composes it (same pattern as mentor side) — opening Sessions after Dashboard is instant.
- Same treatment for `feedback`: extracted into `useMenteeFeedback(userId)` and reused by `InsightsPanel` / `RecentActivity` instead of being threaded down through props.

### 3. Render-perf cleanups

- `MenteeDashboard` renders 6 child panels even while `isLoading`. Move the skeleton branch above the `useMemo` and wrap dashboard children in `React.memo` so a cancel mutation only re-renders the affected panel.
- `BookSession` (513 lines) — extract the calendar grid, time picker, and confirm dialog into separate memoized components. The current monolith re-runs the slot-computation `useMemo` on every keystroke in the notes textarea.
- `MenteeSessions` `mentorPrograms` map → `useMemo` over cached query data.
- `MenteeProfile` — split the form into section subcomponents so editing one field doesn't re-render dropzones and chip inputs.

### 4. Network hygiene

- `BookSession` currently fires the booked-sessions query with no upper bound; scope to `scheduled_at >= now() - 1d` and `<= cursor + 60d` so it stays small.
- Guard `MenteeSessions`'s `select(...).in('session_id', list)` against an empty list (PostgREST 400 on empty mentee accounts).
- Drop the redundant `select("program_id")` on `program_mentors` — fold into the first query.
- All mentee queries inherit the global `staleTime: 60_000` + `refetchOnWindowFocus: false` defaults.

### 5. Booking flow stability

- After a successful booking in `BookSession`, invalidate `["mentee", "sessions", userId]` and `["booked-times", mentorId]` so the user's dashboard and sessions page reflect the new booking without a manual refresh.
- Disable the Confirm button while the `send-booking-email` invoke is in-flight to prevent double-bookings on slow networks (currently `booking` is reset before the email call resolves).

### 6. Code-split heavy pages

- `BookSession` is already lazy at the route level — additionally `lazy()` the confirm dialog and the success state so the calendar paints faster on cold open.
- `MenteeOnboarding` (369 lines) — lazy the step components so the wizard's first paint is just the shell.

## Out of scope (call out for later chunks)
- Admin and public-mentor pages
- Edge function changes (send-booking-email stays as-is)
- DB indexes, RLS changes
- Realtime subscriptions for sessions

## Technical notes

```text
Before:                          After:
useEffect → supabase.fetch       useQuery(['mentee','sessions',uid])
useState(loading)                ↳ cached, dedup'd, shared with dashboard
manual refresh()                 useMutation + invalidate

BookSession:                     BookSession:
  5 parallel fetches in one      useBookSessionData split into
  useEffect, re-runs on remount  mentor/availability/booked-times keys
  booking=false before email     booking stays true until email resolves
```

New hooks under `src/features/mentee-*`:
- `mentee-sessions/useMenteeSessions.ts`
- `mentee-profile/useMenteeProfile.ts`
- `mentee-booking/useBookSessionData.ts` + `useBookSession.ts` (mutation)
- `mentee-programs/useMenteeProgramDetail.ts`

Files touched (estimate): ~9 edited, ~5 new hooks. No new dependencies. No DB or edge-function changes.

## Success criteria
- Navigating Dashboard → My Sessions → Book Session → Dashboard shows no spinners after the first load.
- Cancelling a session updates the UI instantly; dashboard stats reflect the change without a manual refresh.
- No PostgREST 400s in the network panel for an empty mentee account.
- BookSession notes textarea typing no longer triggers slot recompute.
- After booking, both `/sessions` and dashboard show the new session without a hard refresh.
