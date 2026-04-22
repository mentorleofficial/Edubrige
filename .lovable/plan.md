
# Mentor Approval Celebration + LinkedIn Share

Add a celebratory post-approval experience for mentors and a public mentor profile URL they can share on LinkedIn.

## What the mentor sees

When a newly approved mentor next loads the app (Dashboard), a centered modal appears:

- Confetti burst animation
- Heading: "Congratulations, {first name}! 🎉"
- Subhead: "Your mentor profile has been approved on {App Name}."
- Public profile URL shown in a read-only field with a "Copy link" button
- Primary CTA: **Share on LinkedIn** (opens LinkedIn share dialog in new tab, pre-filled)
- Secondary CTA: "View my profile" → opens the public profile in a new tab
- "Maybe later" dismiss link

The modal shows **once per approval**. After dismissal it never re-opens (tracked via a new `approval_acknowledged_at` column on `mentor_profiles`).

### LinkedIn share template

LinkedIn's share URL only reliably accepts a `url` param (it scrapes OG tags from the destination). We'll:
1. Open `https://www.linkedin.com/sharing/share-offsite/?url={publicProfileUrl}`
2. Also copy a suggested caption to clipboard and toast: *"Caption copied — paste it into your LinkedIn post!"*

Default caption (editable in a textarea inside the modal before sharing):
> "Excited to share that I've joined {App Name} as a mentor! 🚀 If you're looking for guidance in {top 3 expertise areas}, let's connect. Check out my profile: {url}"

## Public mentor profile page

New route: **`/mentors/:mentorId`** (page: `src/pages/PublicMentorProfile.tsx`)

- Readable by anyone (anon + authenticated) — required so LinkedIn's crawler can fetch OG metadata
- Shows: avatar, name, headline, current role @ organization, bio, expertise chips, experience timeline, qualifications, years of experience, LinkedIn/portfolio links
- "Book a session" CTA (routes to login if not authed, else to BookSession)
- Hidden if `is_active = false` → renders 404 state

OG tags are injected via `react-helmet-async` (already viable in Vite SPA; LinkedIn's crawler executes limited JS but we'll also set sensible defaults in `index.html` and rely on dynamic tags — acceptable for MVP).

## Database changes

Migration on `mentor_profiles`:
- Add `approval_acknowledged_at timestamptz null`
- Add `slug text null unique` (optional friendly URL; falls back to UUID if null)

New RLS policy on `mentor_profiles`:
- **Anon read active mentors**: `SELECT to anon USING (is_active = true)` — needed for public profile page

Same for `users` table (limited columns via a view) — we'll create:
- View `public.public_mentor_profiles` joining `mentor_profiles` + `users` exposing only safe fields (id, full_name, avatar_url, headline, bio, expertise, experiences, qualifications, current_role, current_organization, years_experience, linkedin_url, portfolio_url). Granted SELECT to anon.

Edge function `approve-mentor-application` updated to:
- Reset `approval_acknowledged_at = null` on approval (so the modal triggers)

## Frontend changes

**New files:**
- `src/features/mentor-approval/ApprovalCelebrationModal.tsx` — modal with confetti, share UI
- `src/features/mentor-approval/useApprovalCelebration.ts` — checks `approval_acknowledged_at IS NULL && is_active` for current user; mounts modal
- `src/pages/PublicMentorProfile.tsx` — public profile page
- `src/features/mentors/api/publicMentor.ts` — fetch from `public_mentor_profiles` view

**Modified files:**
- `src/components/AppLayout.tsx` — mount `<ApprovalCelebrationModal />` once for mentors
- `src/App.tsx` — add `/mentors/:mentorId` public route (outside RoleGuard)
- `src/pages/MentorProfile.tsx` — add "Share profile" button + copy link in header
- `supabase/functions/approve-mentor-application/index.ts` — set `approval_acknowledged_at = null`

**Dependencies to add:**
- `canvas-confetti` (lightweight, ~5kb) for the burst
- `react-helmet-async` for OG tags

## Acknowledgement flow

On modal dismiss (any path: Share, View, Maybe later, X):
- `UPDATE mentor_profiles SET approval_acknowledged_at = now() WHERE user_id = auth.uid()`
- Modal will not reopen on subsequent loads

## Out of scope
- LinkedIn API posting (requires OAuth + LinkedIn app review) — sharing via web intent is sufficient
- Email notification on approval (can be a follow-up)
- Custom slugs UI (slug column added but auto-generated from name; editing UI later)
- OG image generation per mentor (uses default branding logo for now)
