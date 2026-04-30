# Clean URLs for Admin Programs

Right now opening a program lands you on `/admin/programs/d10ca6e3-351c-4282-a337-e55a244a2824` — an ugly UUID. Programs already have a `slug` column (auto-generated from the name on create), so we'll use it in the URL instead.

## What changes

- Program detail URL becomes `/admin/programs/spring-2026-engineering-cohort-a8x2` instead of `/admin/programs/<uuid>`.
- The "Open mapping board" link on the Programs list will point to the slug.
- Old UUID URLs (already shared / bookmarked) will still work — they auto-redirect to the slug version, so nothing breaks.

## Other URLs reviewed

- **Mentor profiles** (`/mentors/:mentorId`) — already use slugs (handle). No change needed.
- **Booking** (`/book/:mentorId`) and **Session feedback** (`/session/:id/feedback`) — these are session/transaction routes where a stable opaque id is appropriate (sessions don't have a user-facing name). Leaving as-is.
- **Admin lists** (`/admin/users`, `/admin/applications`, `/admin/audit-logs`, `/admin/settings`) — already clean, no IDs.

If you'd like mentor or other routes changed too, tell me which.

## Technical details

1. **`src/App.tsx`** — change the route from `/admin/programs/:id` to `/admin/programs/:slug`.
2. **`src/pages/AdminProgramDetail.tsx`**:
   - Read `slug` from `useParams` instead of `id`.
   - Load the program with `.eq("slug", slug).maybeSingle()`; use the returned `program.id` everywhere internally (assignments, members, tags queries are all keyed on the UUID — no DB changes).
   - Add a small fallback: if the param looks like a UUID (regex match), look it up by `id`, then `navigate(`/admin/programs/${program.slug}`, { replace: true })` so old links auto-upgrade.
3. **`src/pages/AdminPrograms.tsx`** — change the Link target from `/admin/programs/${p.id}` to `/admin/programs/${p.slug}`.
4. No DB migration. Slugs are already populated and unique-enough (name + 4-char suffix). If a duplicate slug ever occurs, the lookup uses `maybeSingle` and we'll fall back to showing the first match.
