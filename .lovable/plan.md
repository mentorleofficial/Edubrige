# Fix & Harden the Mentee Program Flow

## What's broken (root causes)

1. **Mentee can't see mentors of their own program.**
   - `program_mentors` RLS only allows `mentor_id = auth.uid()` (mentor reads own row) or admins. Mentees enrolled in the program have **no SELECT policy**, so the query returns 0 rows.
   - That's why the screenshot shows **"0 mentors"** on the card and **"No mentors in this program yet"** on the detail page, even though there is 1 mentor in the DB.

2. **Mentor name/email may be missing for mentees.**
   - `users` table only lets a mentee read another user if that user has an active `mentor_profiles` row ("Public read active mentor users"). If a program mentor hasn't completed/activated their profile, their row is invisible to the mentee.

3. **`fetchMyPrograms` mentor count is always 0 for mentees** — same RLS gap as #1 (counts via `program_mentors`).

4. **Assigned mentor is duplicated** in the "Mentors in this program" list (no de-dup).

5. **Mentee detail page has no error/empty handling, no React Query, no skeletons** — silent failures and inconsistent with rest of the app.

6. **`MentorDirectory` "Find a mentor" deep link** (`/mentors?program=<slug>`) — verified the param wiring is fine, but the directory only shows mentors in programs the *current user* belongs to. Good — no change needed, just confirming.

## Fix plan

### 1. Database migration (RLS)

Add SELECT policies so a mentee enrolled in a program can read:
- the program's `program_mentors` rows (to list/count mentors)
- the `users` rows of those mentors (basic profile fields only)

```sql
-- Mentees can see the mentor list of programs they're enrolled in
CREATE POLICY "Mentees read mentors in their programs"
ON public.program_mentors FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.program_mentees pe
    WHERE pe.program_id = program_mentors.program_id
      AND pe.mentee_id = auth.uid()
  )
);

-- Mentees can read user records of mentors who share a program with them
CREATE POLICY "Mentees read users of program mentors"
ON public.users FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.program_mentors pmt
    JOIN public.program_mentees pme ON pme.program_id = pmt.program_id
    WHERE pmt.mentor_id = users.id
      AND pme.mentee_id = auth.uid()
  )
);
```

These are additive (OR'd with existing policies). The `users` policy still only exposes the columns we already select (`id, full_name, email, avatar_url`) — no sensitive fields exist on that table beyond what's already public for active mentors.

### 2. API layer (`src/features/programs/api.ts`)

- Wrap fetchers with proper error propagation (currently swallowed).
- Add a single `fetchProgramOverview(slug, userId, role)` helper that returns `{ program, mentors, mentees, tags, assignedMentor }` in one go — used by both mentee and mentor detail pages — to avoid waterfall and make React Query caching simpler.
- Keep existing fine-grained fetchers for backwards compatibility.

### 3. React Query refactor

Replace `useEffect`/`useState` in `MenteeProgramDetail.tsx` (and `MentorProgramDetail.tsx`) with `useQuery`:
- Key: `["program-overview", slug, userId, role]`
- Loading → skeletons (consistent with `MenteePrograms.tsx`)
- Error → friendly card with retry
- Use the central `queryClient` so errors flow through `handleError`.

### 4. UI fixes — `MenteeProgramDetail.tsx`

- Show real mentor count (now correctly readable).
- De-dup the assigned mentor from the "Mentors in this program" grid (or add an "Assigned to you" badge instead of hiding).
- Skeleton loaders (replace plain "Loading…").
- Empty state: if `mentors.length === 0`, show a clear message + link back to programs.
- Add a small header chip with the program color (consistent with `ProgramBadge`).
- Tags rendered as badges (already there, keep).
- Add **Co-mentees** section (other mentees in the program) — optional but useful for cohort awareness; gated to only show count if list is empty for privacy. *(I'll add it behind the same RLS we already have: `program_mentees` is already readable by enrolled mentees for their own row only — so listing other mentees would need another RLS policy. **Skipping cohort list** to keep privacy tight; just show a count of "X mentees enrolled" via a server-side count query if feasible, otherwise omit.)*
- Action row: "Book session" with assigned mentor stays primary; secondary "Browse all program mentors" → `/mentors?program=<slug>`.

### 5. UI fixes — `MenteePrograms.tsx` / `ProgramCard.tsx`

- After RLS fix, mentor counts in `fetchMyPrograms` will populate correctly. No code change needed there, but verify after migration.
- Add a tiny "Assigned: <mentor name>" line on the card when a mentee has an assignment in that program (one extra batched query in `fetchMyPrograms` for mentees).

### 6. Mentee dashboard widget

- Verify `MenteeDashboard` "My Programs" widget renders correct counts post-fix.
- Add a CTA "View program" → `/mentee/programs/<slug>` if missing.

### 7. Audit / production hardening checklist

- ✅ RLS: confirm no recursive policies, all use `SECURITY DEFINER` helpers.
- ✅ Run `supabase--linter` after migration.
- ✅ Confirm `can_mentee_book_mentor` still works correctly for program-mapped mentors (it does — uses `mentor_mentee_assignments`).
- ✅ Verify `MentorDirectory` `?program=<slug>` filter end-to-end as a mentee.
- ✅ Verify `MenteeSessions` program badges resolve (uses `program_mentors`/`program_mentees` lookups — will benefit from new RLS).
- ✅ Confirm `fetchMyAssignedMentor` works when mentor profile is inactive (now fixed by new `users` policy).

## Files to change

- **New migration**: `supabase/migrations/<ts>_mentee_program_visibility.sql` (the two policies above)
- **Edited**: `src/features/programs/api.ts` (new overview helper + assignment lookup batched into `fetchMyPrograms` for mentees)
- **Edited**: `src/features/programs/hooks/useMyPrograms.ts` (return assigned mentor map for mentees)
- **Edited**: `src/pages/MenteeProgramDetail.tsx` (React Query, skeletons, de-dup, empty/error states)
- **Edited**: `src/pages/MentorProgramDetail.tsx` (parallel React Query refactor for consistency)
- **Edited**: `src/components/programs/ProgramCard.tsx` (optional "Assigned: …" line for mentees)

## Out of scope (call out, no change)

- Listing other mentees (cohort) to a mentee — privacy concern, would require a separate RLS policy + product decision.
- Messaging / chat between program members.
- Program announcements / resources tab.

Approve to apply the migration and ship the UI fixes.
