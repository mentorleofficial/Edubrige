# Human-readable mentor profile URLs

Replace UUID-based public mentor URLs with name-based slugs:

Before: `/mentors/0280484d-f38a-425e-8aa9-06ab9fb1c6da`
After:  `/mentors/jane-doe` (with short hash suffix if name collides, e.g. `jane-doe-a8f2`)

## Database
The `mentor_profiles.slug` column already exists. We need to:
- Backfill slugs for all existing active mentors based on their `users.full_name`
- Add a unique index on `slug` to prevent duplicates
- Create a Postgres function `generate_mentor_slug(full_name text, user_id uuid)` that produces a kebab-case slug, appending the first 4 chars of the user_id when the base slug already exists
- Update `approve-mentor-application` edge function to set the slug at approval time if missing

## Frontend changes

**Route** (`src/App.tsx`)
- Keep `/mentors/:mentorId` so existing UUID links still work (back-compat)

**`PublicMentorProfile.tsx`**
- Param renamed conceptually to `:slugOrId`
- Lookup logic: try `slug` match first; if not found and value looks like a UUID, fall back to `user_id` lookup
- If found by UUID but a slug exists, redirect (replace) to the slug URL for cleaner sharing

**Share URL builders** (3 places that construct `/mentors/${userId}`):
- `src/pages/MentorProfile.tsx` (Copy link & LinkedIn share buttons)
- `src/features/mentor-approval/useApprovalCelebration.ts`
- Use the mentor's `slug` when available, else fall back to `user_id`. Both pages already query `mentor_profiles`, so we just include `slug` in the select.

## Result
Shared link becomes:
`https://mentorle.lovable.app/mentors/jane-doe`

Old UUID links continue to work and auto-redirect to the slug version.

## Out of scope
- Letting the mentor edit their own slug (can be added later)
- Localized/non-ASCII slug handling beyond standard transliteration (we'll strip non-alphanumerics)
