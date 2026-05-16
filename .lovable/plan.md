# Mentor-side performance & stability optimization

Goal: make the mentor experience feel instant, eliminate the occasional "crack" around login/route changes, and remove the duplicated data-fetch patterns that cause double renders and stale UI.

We will do this in **one focused chunk** scoped to mentor surface area + the shared login/auth path that affects it. Admin and mentee passes come later.

## Scope (this chunk)

In:
- `src/contexts/AuthContext.tsx` (login flicker / race)
- `src/pages/Login.tsx` (redirect race)
- `src/pages/MentorSessions.tsx`
- `src/pages/MentorMentees.tsx`
- `src/pages/MentorAvailability.tsx`
- `src/pages/MentorProfile.tsx` (only render/perf — no logic changes)
- `src/components/dashboards/MentorDashboard.tsx` + `src/components/dashboards/mentor/*`
- `src/features/mentor-dashboard/useMentorDashboardData.ts`

Out (separate chunks): admin pages, mentee pages, public mentor pages, edge functions, DB schema.

## What we will change and why

### 1. Fix the login "crack"
Symptom: brief flash to `/login`, double profile fetches, occasional bounce after refresh.

- In `AuthContext`, the `onAuthStateChange` listener and `getSession()` both call `fetchProfile`, causing two parallel fetches on every refresh. Guard so we only fetch when the `user.id` actually changes.
- `setTimeout(fetchProfile, 0)` is unnecessary now that the listener is async-safe — call it directly but deduped.
- Stop writing `setLoading(false)` before the profile resolves on cold start. Currently `loading` flips to false while `profile` is still null, which lets `RoleGuard` redirect to `/login` for one frame on slow networks.
- `Login.tsx` redirect should wait for `loading === false && profile` rather than just `user`, so the redirect target matches the actual role.
- Cache the `mentor_profiles.is_active` flag in the same `localStorage` blob as the profile so `requireActiveMentor` guards don't bounce mentors to `/dashboard` for one frame on refresh.

### 2. Convert mentor pages to React Query
Today three mentor pages (`MentorSessions`, `MentorMentees`, `MentorAvailability`) use `useState + useEffect + supabase` directly. This causes:
- A full network round-trip on every navigation back to the page
- No cache sharing with the dashboard (we fetch the same `sessions` rows twice)
- `loading` flicker on every visit

Migration:
- New hook `useMentorSessions(userId)` that returns sessions + a derived `ratedSessionIds` set in a second query keyed on the session ids. Mutations (`updateStatus`, `saveEdit`) become `useMutation` with optimistic update + `queryClient.invalidateQueries(['mentor-sessions', userId])`.
- New hook `useMentorMentees(userId)` collapsing the 5 sequential supabase calls into one `Promise.all` and caching it. Today the second `useEffect` re-runs whenever `sessions` or `myPrograms` changes, refetching `program_mentees` needlessly.
- New hook `useMentorAvailability(userId)` wrapping `fetchWeeklySlots` / `fetchOverrides` / `fetchTimezone` as a single query, with each mutation invalidating it. Removes the manual `refresh()` calls scattered through the file.

### 3. Share the sessions cache with the dashboard
`MentorDashboard` already calls `useMentorDashboardData` which fetches the same `sessions` rows that `MentorSessions` and `MyMenteesPanel` need. We'll:
- Move the sessions query into its own `useMentorSessions` hook with key `['mentor', userId, 'sessions']`.
- `useMentorDashboardData` composes it instead of re-querying.
- Result: opening `My Sessions` after the dashboard is instant (no spinner, served from cache, then revalidated).

### 4. Render-perf cleanups
- `MentorDashboard` recomputes `computed` from `useMemo` correctly but renders 7 child cards even while `isLoading`. Move the skeleton branch above the `useMemo` and split the dashboard children into `React.memo` components so a single mutation doesn't re-render unrelated panels.
- `MentorSessions` builds the `menteePrograms` map in an effect — convert to `useMemo` over the cached `program_mentees` query.
- `MentorProfile` (553 lines) — extract the 5 section panels into separate files so editing one section doesn't re-render the whole form. No behavior change.
- Wrap heavy lucide icon imports with tree-shaking-friendly named imports only (already mostly fine, audit MentorProfile).

### 5. Network hygiene
- Today `MentorSessions` fires `select(...).in('session_id', list.map(...))` even when `list` is empty after the initial render of an empty mentor account → returns 400 from PostgREST. Guard the call.
- `MentorMentees`: avoid the `select` on `users` when `menteeIds.length === 0` (already guarded), but also drop the redundant `select("program_id")` on `program_mentors` once — we can join it into the first query.
- All mentor queries pass `staleTime: 60_000` (matches global default) and `refetchOnWindowFocus: false`.

### 6. Code-split the heavy mentor profile page
`MentorProfile.tsx` is 553 lines and pulls in `react-hook-form` + zod + 5 sub-components synchronously. It's already lazy-loaded at the route level — we'll additionally `lazy()` the resume dropzone and avatar uploader so the first paint of the profile page is faster.

## Out of scope (call out for later chunks)
- Admin dashboards & admin pages
- Mentee dashboards & mentee pages
- Public `/mentors/:id` page and directory
- Any DB index work or RLS changes
- Switching to realtime subscriptions

## Technical notes

```text
Before:                          After:
useEffect → supabase.fetch       useQuery(['mentor-sessions', uid])
useState(loading)                ↳ cached, dedup'd, shared with dashboard
manual refresh()                 useMutation + invalidate

AuthContext:                     AuthContext:
  onAuthStateChange → fetch      onAuthStateChange → fetch IF user.id changed
  getSession → fetch             getSession → fetch IF no cached profile
  loading=false early            loading stays true until profile resolves
```

Files touched (estimate): ~10 edited, ~3 new hooks under `src/features/mentor-*`. No new dependencies. No DB or edge-function changes.

## Success criteria
- No `/login` flash on hard refresh while signed in.
- Navigating Dashboard → Sessions → Mentees → Dashboard shows no spinners after the first load.
- Mutations on sessions (complete / cancel / save notes) update the UI without a full refetch + re-render storm.
- No PostgREST 400s in the network panel for an empty mentor account.
