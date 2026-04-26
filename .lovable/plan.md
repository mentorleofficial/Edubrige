## Mentee Onboarding — "Complete Your Profile" Flow

A LinkedIn-style multi-step wizard that runs the first time a mentee lands in the app (after JWT or email login). Until they finish it, they can't browse mentors or book sessions.

### User flow

```text
JWT Callback / Login
        │
        ▼
   /dashboard ──► (mentee + profile incomplete?) ──► /onboarding/mentee
                                                             │
                       ┌─────────────────────────────────────┤
                       ▼                                     │
        Step 1  Welcome + Headshot (avatar upload, name confirm)
        Step 2  About You (headline, short bio, organization unit / team)
        Step 3  Goals (what do you want to achieve — required)
        Step 4  Interests & Skills (chip input, min 3 — required)
        Step 5  Preferred Mentor Areas + optional LinkedIn URL
        Step 6  Review & Finish
                       │
                       ▼
                Mark complete → /mentors
```

Each step has Back / Continue. Progress bar at top. Auto-saves draft to the row on every "Continue" so they can resume.

### What's required vs optional

- **Required to finish:** full name, goals, interests (≥3), preferred mentor areas (≥1)
- **Optional but encouraged:** avatar, headline, short bio, organization unit, LinkedIn URL

### Hard gating rules

- New `useMenteeProfileStatus` hook returns `{ loading, isComplete }`.
- A `MenteeOnboardingGuard` wraps `/mentors`, `/book/:mentorId`, `/mentee/sessions` and redirects to `/onboarding/mentee` if incomplete.
- Dashboard shows a "Finish setting up your profile" card for incomplete mentees instead of the "Find a Mentor" CTA.
- Once complete, `/onboarding/mentee` redirects back to `/dashboard`.

### Database changes

Extend `mentee_profiles` to hold the LinkedIn-style fields and a completion flag:

```sql
alter table public.mentee_profiles
  add column if not exists headline text default '',
  add column if not exists bio text default '',
  add column if not exists linkedin_url text default '',
  add column if not exists preferred_mentor_areas text[] default '{}',
  add column if not exists onboarded_at timestamptz;
```

`onboarded_at IS NOT NULL` = profile complete. Existing rows stay backward-compatible (avatar lives on `users.avatar_url`, already in place).

Existing RLS ("Mentees manage own profile") already covers insert/update/select for these new columns — no policy changes needed.

### New / changed files

**New**
- `src/features/mentee-onboarding/schema.ts` — Zod schema + types for the wizard
- `src/features/mentee-onboarding/api.ts` — `fetchMenteeProfile`, `upsertMenteeProfile`, `markOnboarded`
- `src/features/mentee-onboarding/hooks/useMenteeProfileStatus.ts` — completion check (cached via React Query)
- `src/features/mentee-onboarding/components/OnboardingShell.tsx` — progress bar, step nav, layout
- `src/features/mentee-onboarding/components/steps/` — `WelcomeStep`, `AboutStep`, `GoalsStep`, `InterestsStep`, `PreferencesStep`, `ReviewStep`
- `src/components/MenteeOnboardingGuard.tsx` — route wrapper that redirects incomplete mentees
- `src/pages/MenteeOnboarding.tsx` — the `/onboarding/mentee` route, hosts the wizard

**Edited**
- `src/App.tsx` — register `/onboarding/mentee`; wrap mentee browse/book/sessions routes with `MenteeOnboardingGuard`
- `src/pages/MenteeProfile.tsx` — upgrade existing edit page to include the new fields (headline, bio, LinkedIn, preferred areas) so users can edit later. Make it work even when the profile row already exists.
- `src/components/dashboards/MenteeDashboard.tsx` — show "Complete your profile" CTA when not onboarded
- `src/pages/Dashboard.tsx` — (only if needed) trigger redirect for first-time mentees

### UX details (LinkedIn-style)

- Single-column, centered card (max-w-2xl), large step heading, subtitle, and a hint line.
- Avatar uploader reuses `src/features/mentor-profile/components/AvatarUploader.tsx`.
- Interests + Preferred Areas use chip input (Enter to add, X to remove), matching the mentor expertise UX.
- "Save & exit" link in header to come back later (will still be gated until finished).
- Toasts on save errors; final step button "Finish & explore mentors".

### Out of scope (this round)

- Email verification, password change, dark/light theming for onboarding, profile photo cropping. We can add those next.
