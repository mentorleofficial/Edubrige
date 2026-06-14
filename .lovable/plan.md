## Goal
On the Find Mentor page cards:
1. Top-left tag should display the mentor's **current_role** (instead of the first expertise tag).
2. Below the mentor name, show expertise tags — first 2 visible with a "+N" chip if more — and a tooltip on hover showing all tags.

## Changes

### 1. `supabase/migrations/<new>.sql` — extend `list_public_mentors` RPC
Add `current_role text` to the RETURNS TABLE and SELECT clause so the frontend gets `current_role` along with existing fields. Recreate function preserving existing filtering logic.

### 2. `src/features/mentors/api/mentors.ts`
- Add `current_role: string | null` to `MentorWithProfile.mentor_profiles[0]`.
- Map `row.current_role` from the RPC response.

### 3. `src/pages/MentorDirectory.tsx`
- Replace the top-left chip's `topTag = profile?.expertise?.[0]` with `profile?.current_role`.
- Below `<h3>{m.full_name}</h3>`, render a row of expertise tags:
  - First 2 tags shown as small pill chips (`bg-white/15 text-white/90 text-[10px]`), truncated.
  - If more than 2, append a `+N` chip.
  - Wrap the row in a shadcn `Tooltip` whose content lists all tags; on hover anywhere over the row, the full list shows.
- Adjust the bottom gradient/padding minimally so tags + name + footer (yrs/Book) all fit within the card.

## Out of scope
Backend changes beyond extending the RPC; no schema migrations to tables; no filter logic changes.
