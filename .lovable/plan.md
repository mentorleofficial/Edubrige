

# Fix `admin/users` active toggle + speed up the page

## Root cause of the broken toggle

`AdminUsers.tsx` runs:
```
supabase.from("mentor_profiles").update({ is_active }).eq("user_id", u.id)
```
If the mentor has **no `mentor_profiles` row yet** (common for accounts created via "Add User" with role=mentor, or older imports), `UPDATE` matches 0 rows. Supabase returns no error, the toast shows "activated", but the DB state is unchanged — so the switch snaps back on next refetch and looks broken.

Fix: use **`upsert` on `mentor_profiles`** keyed by `user_id` so the row is created if missing, updated otherwise. Add a `unique` constraint on `mentor_profiles.user_id` to make upsert deterministic (today there is no unique constraint, only a non-unique reference).

## Fixes

### 1. DB migration
- Add `UNIQUE (user_id)` on `public.mentor_profiles` (one profile per mentor — already the intent).
- No data change; a quick dedup query in the migration drops accidental duplicates first (keep newest).

### 2. `AdminUsers.tsx` — toggle logic
Replace the `update` with:
```
supabase.from("mentor_profiles")
  .upsert({ user_id, is_active }, { onConflict: "user_id" })
```
Show real error toast on failure. Apply **optimistic UI**: flip the switch immediately via React Query `setQueryData`, rollback on error.

### 3. Convert page to React Query + microservice pattern
Create `src/features/admin/api/users.ts` and `src/features/admin/hooks/useAdminUsers.ts`:
- `useAdminUsers()` — `useQuery` with `staleTime: 30s`, paginated (default 25/page).
- `useToggleMentorActive()` — `useMutation` with optimistic update + rollback.
- `useCreateUser()` — `useMutation` invalidating users list on success.

Page becomes a thin view that consumes the hooks. No more raw `useEffect + supabase.from` in the component.

### 4. UX improvements on `AdminUsers`
- **Search debounced** (200ms) and applied client-side over the current page.
- **Server-side role filter** dropdown (All / Admin / Mentor / Mentee) — sent as a `.eq("role", …)` to keep payload small.
- **Pagination controls** (Prev/Next, "Page X of Y", page size 25). Today the page fetches every user with no limit (Supabase caps at 1000 silently — a real bug at scale).
- **Skeleton rows** instead of "Loading…" text for perceived speed.
- **Disabled switch + spinner** while a toggle mutation is in flight; success/error toasts via `handleError` helper.
- **Self-deactivation guard**: don't allow an admin to deactivate their own admin role accidentally (out of scope here — only mentor active toggle exists, but we'll prevent toggling for the currently signed-in user as a small safety).
- Empty state when no results match.
- Show a small badge `(no profile)` next to mentors who never finished onboarding, so admins understand what activation will create.

### 5. Performance
- React Query caching means tab switches don't refetch.
- `select` only the columns we render (`id, full_name, email, role, created_at, mentor_profiles(is_active)`) — already the case but keep.
- Pagination cuts payload from "all users" → 25 rows.
- Add an index on `users(role)` and `users(created_at desc)` to keep the paginated list fast.
- Memoize the filtered array with `useMemo`.

## Files

- **Migration** (new): unique constraint on `mentor_profiles.user_id`, indexes on `users(role)` and `users(created_at desc)`.
- **New**: `src/features/admin/api/users.ts`, `src/features/admin/hooks/useAdminUsers.ts`, `src/features/admin/index.ts`.
- **Modified**: `src/pages/AdminUsers.tsx` — rewritten to use the hooks, add pagination, skeleton, optimistic toggle, debounced search, role filter.

## Out of scope
- Editing existing user roles inline (only creation + mentor activation are covered).
- Bulk actions.
- Server-side full-text search (debounced client filter on a paginated page is enough at current scale).

