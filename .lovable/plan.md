
# Admin Side Audit & Improvement Plan

A full sweep across the admin surfaces (`AdminDashboard`, `AdminUsers`, `AdminPrograms`, `AdminProgramDetail`, `AdminApplications`, `AdminAuditLogs`, `AdminSettings`). Findings grouped by theme and prioritized **P0 → P2**.

---

## P0 — Critical correctness, security & destructive-action gaps

### 1. No "delete / archive" anywhere
Currently admins can **create** programs, mentors, mentees but **cannot delete or archive** anything from the UI:
- No delete on **Programs** (only status dropdown exists in DB but unused in UI after creation).
- No edit on **Programs** at all (name, dates, capacity, status, color are write-once).
- No delete on **users** (cannot offboard a leaver — orphaned auth user remains).
- No delete on **program tags** with confirm.
- No bulk remove of mentors/mentees from a program.

**Fix:** Add an "Edit / Archive / Delete" menu on each program card and detail header, edit dialog reusing the create form, and a destructive `AlertDialog` confirm flow for delete with cascading impact preview ("X assignments, Y mentees will be unmapped"). Add a `Remove from program` action (with confirm) on member rows. Add a `Deactivate user` action on `AdminUsers` (soft-delete via a flag, not hard auth delete).

### 2. Audit log is half-built
`AdminAuditLogs` shows only Action / Entity / EntityId / Date — but the table stores `user_id`, `details` (jsonb diff), `ip_address`. The actor and the diff are **invisible to admins**, defeating the purpose of an audit trail.

**Fix:**
- Join with `users` to display the actor's name + email.
- Add a row click → side-sheet showing the full JSON diff (old vs new), IP, timestamp.
- Add filters for: actor, entity type (dropdown of distinct values), date range, action (INSERT/UPDATE/DELETE).
- Pagination (currently capped at 200, silently truncated).
- Export filtered logs to CSV.

### 3. `AdminDashboard` "Active Mentors" is wrong
It counts `users.role = 'mentor'`, not mentors with `mentor_profiles.is_active = true`. Also nothing is **time-bounded** — sessions count includes all-time including cancelled.

**Fix:** Use `mentor_profiles` join with `is_active=true`. Add status breakdowns (booked / completed / cancelled) and a "last 30 days" delta on each card.

### 4. `AdminUsers` "Add User" creates via `supabase.auth.signUp` from the browser
This means:
- Admin's own session can be replaced if email-confirm is off and the new user gets auto-signed-in.
- No way to set role reliably (the trigger reads `raw_user_meta_data.role` which any client can spoof on signup).
- Password is set by the admin — user has no way to reset it through a normal flow.

**Fix:** Move user creation to an **edge function** using `service_role` + `admin.createUser`, then insert role server-side. Generate a temp password OR send a magic-link invite. Same edge function should be the only path to assign `admin` role.

### 5. RLS drift risks not surfaced
The schema now has many cross-role read policies (mentees read mentor users, mentors read mentee users). There's **no admin view** to verify "who can see what". A small admin "Permissions matrix" page would be invaluable for production.

**Fix (lightweight):** Add a `Security` tab in `AdminSettings` showing:
- Current branding/JWT config status with green/red dots.
- A static matrix listing each table and the SELECT/WRITE policies summary (read from a hardcoded JSON kept in sync with migrations).
- "Run linter" button calling a small edge function that pings `pg_policies` and reports tables without RLS.

---

## P1 — Data integrity, UX polish, and reporting

### 6. `AdminProgramDetail` reloads everything on every action
Every assign/unassign/toggle calls `load()` which re-fetches 4 tables. With dnd-kit drag this feels janky.

**Fix:** Move to React Query with optimistic updates (mirror the pattern used in `useToggleMentorActive`). Invalidate only the touched query keys.

### 7. Program member toggles bypass conflict checks
Removing a mentor from a program (`toggleMentor(.., false)`) does **not** clean up `mentor_mentee_assignments` rows that reference them. They become invisible orphans (the assignment validation trigger only runs on INSERT, not on member-deletion).

**Fix:** Either cascade delete in a DB trigger (`BEFORE DELETE ON program_mentors → DELETE FROM mentor_mentee_assignments`) or in the UI show a confirm "This mentor has N active mentees in this program. Reassign or unassign them first." Same for `program_mentees`.

### 8. No reports / exports
Admins have **no CSV exports**. Useful starter set:
- Users export (id, name, email, role, joined, last_login).
- Sessions export (mentor, mentee, scheduled_at, status, duration, has_feedback).
- Program roster export per program (mentors, mentees, mappings, tags).
- Feedback report (per mentor: avg rating, count, recent comments).

**Fix:** Add an "Export" button on each list page. Generate client-side CSV for small sets; for sessions/feedback, use an edge function with service-role to bypass row limits.

### 9. No mentor performance / feedback view for admins
`feedback` table exists, RLS allows admin full access, but there is **no UI** to view ratings per mentor. Critical for production trust & moderation.

**Fix:** New `AdminFeedback` page: table grouped by mentor (avg, count, last 30d trend), drill-down to individual feedback rows, ability to flag/hide a comment.

### 10. `AdminApplications` quirks
- Bulk approve loops one-by-one calling the edge function — slow & non-atomic; partial failures leave a confusing toast count.
- Rejected applications can't be re-opened or commented on after the fact.
- "Application detail" dialog allows approval but doesn't show resume preview inline (user has to click out).

**Fix:** Batch `approve-mentor-application` to accept `application_ids: string[]`. Add a "Reopen" action on rejected. Embed PDF preview via signed URL in the dialog.

### 11. `AdminPrograms` mentor/mentee counts use a 2nd round-trip
On a list with N programs, it does N×2 fetches collated client-side. With 1000-row Supabase limit, anything large breaks silently.

**Fix:** Create a Postgres view `program_stats(program_id, mentor_count, mentee_count, assigned_count)` with `security_invoker=on`, joined into the programs query.

### 12. No pagination/sorting on Programs, Applications, Audit logs
Hardcoded `.limit(200)` or no limit → silently capped at Supabase's 1000-row default.

**Fix:** Standard React-Query paginated table component (already done well in `AdminUsers`). Reuse it.

### 13. Mentee directory missing for admins
Admins can list users but cannot view a mentee profile (`mentee_profiles` data: bio, goals, interests, focus areas). `MenteeProfile` page exists for self-edit only.

**Fix:** Click on a user row → side sheet with role-appropriate profile (mentor profile for mentors, mentee profile for mentees, including their program memberships and session history).

---

## P2 — Polish, observability, branding

### 14. Audit logging coverage gaps
The `log_audit_event()` trigger exists but is **not attached to any table** (the schema confirms "There are no triggers in the database"). So `audit_logs` is only populated when something explicitly inserts into it. This means most "audited" actions aren't actually audited.

**Fix:** Add `AFTER INSERT/UPDATE/DELETE` triggers on: `programs`, `program_mentors`, `program_mentees`, `mentor_mentee_assignments`, `user_roles`, `mentor_profiles.is_active`, `branding`, `jwt_config`, `mentor_applications` status changes.

### 15. AdminSettings — no validation feedback for JWT config
JWT settings save without testing. A "Test connection" button (via `validate-jwt-config` edge function which already exists) should run on save and show a green/red status.

### 16. Empty / loading / error states inconsistent
Mix of "Loading…" text, skeletons, and silent failures. Standardize using the skeleton pattern from `AdminUsers`.

### 17. Branding page lacks live preview
Color pickers update DB but admin must navigate around to see effect. Add a small live preview card showing buttons/badges/cards rendered with the chosen HSL values.

### 18. No "impersonate user" / "view as" for support
Common admin need: "what does this mentee actually see?" 

**Fix (safe variant):** A read-only "View as" mode that swaps the current user's effective role in the UI only (still RLS-bound by their actual JWT) — primarily useful for navigation/empty-state debugging. A true impersonation requires a server-side session swap edge function and explicit audit entry.

---

## Suggested execution order

If you approve, I'd tackle in this sequence (each = one focused round):

```text
Round 1 (P0 hard requirements)
  - Edit / Archive / Delete for programs (with cascade preview)
  - Deactivate user + remove member from program with safety checks
  - Move user creation to admin edge function (service role)
  - Cascade-cleanup trigger for program member removals

Round 2 (P0 audit + dashboard correctness)
  - Audit logs: actor join, JSON diff sheet, filters, CSV export
  - Attach audit triggers to all critical tables
  - Fix AdminDashboard active-mentor count; add 30d deltas

Round 3 (P1 reporting)
  - program_stats view + pagination on AdminPrograms
  - AdminFeedback page (mentor ratings + moderation)
  - CSV exports on Users/Sessions/Programs/Feedback
  - Admin profile drill-down sheet (mentor & mentee)

Round 4 (P2 polish)
  - JWT test-on-save, branding live preview
  - Application bulk batching + resume preview
  - Standardize loading/error states
```

---

## Questions before starting Round 1

1. **User deletion**: prefer **soft-delete** (mark inactive, keep historical sessions/feedback) or **hard-delete** via admin edge function (removes from `auth.users`)?
2. **Admin invite flow**: when admin "adds" a user, do you want them to **set a temp password** (current behavior) or **send an invite email** (magic link / set-your-own-password)?
3. **Audit triggers**: log every UPDATE in full diff, or only specific sensitive columns (e.g., role changes, is_active, branding/JWT)? Full diffs grow the table fast.
4. **Reports**: client-side CSV is enough for now, or do you want scheduled email reports (e.g., weekly admin digest) as part of this scope?

Once you answer these, I'll start with **Round 1**.
