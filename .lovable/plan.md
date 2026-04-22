

# Enhance Mentor Profile — Professional UI/UX + Rich Data Capture

Transform `/mentor/profile` (`src/pages/MentorProfile.tsx`) from a basic 4‑field form into a polished, LinkedIn‑style profile editor that captures the full mentor identity.

## Fields captured

**Account (from `users` table)**
- Full name, email (read-only), avatar (upload to `branding-assets/avatars/`), contact number

**Professional summary (from `mentor_profiles`)**
- Headline (e.g. "Senior PM @ Acme")
- Bio (rich textarea, char counter)
- Years of experience, current organization, current role/title
- LinkedIn URL, portfolio URL
- Resume (PDF/DOCX upload to `mentor-resumes` bucket)

**Expertise areas** — tag input. Type → press Tab/Enter/comma to add. Backspace on empty input removes last. Max 15. Drag-free chip removal with X.

**Qualifications** (LinkedIn-style "Education") — repeatable list:
- Institution, Degree, Field of study, Start year, End year (or "Present")

**Experience** (LinkedIn-style) — repeatable list:
- Company, Title, Location, Start (mo/yr), End (mo/yr or "Present"), Description

## UI/UX design

```text
┌─────────────────────────────────────────────────────────────┐
│ [Cover gradient banner — uses brand primary]                │
│   ┌──────┐                                                  │
│   │Avatar│  Full Name              [ Save changes ] [↺]     │
│   └──────┘  Headline · Org                                  │
│             ● Active mentor   ⓘ profile completeness 72%   │
└─────────────────────────────────────────────────────────────┘

  Sticky sub-nav (anchor tabs):  About · Expertise · Experience · Education · Links

  About               ┃  [card with bio + headline + years]
  Expertise           ┃  [chip input + suggested tags]
  Experience          ┃  [timeline cards with edit/delete + "Add experience"]
  Education           ┃  [timeline cards + "Add qualification"]
  Links & Resume      ┃  [LinkedIn / Portfolio / Resume dropzone]
```

- Two-column responsive layout on ≥lg, single column on mobile.
- **Sticky save bar** appears at the bottom only when the form is dirty ("You have unsaved changes — Save / Discard").
- **Profile completeness meter** in the header (counts filled mandatory fields).
- **Skeleton loader** while fetching, **optimistic toast** on save.
- React Hook Form + Zod validation, inline error messages, autosave-disabled to keep edits intentional.
- Avatar uploader with crop-free preview, 2MB cap, JPG/PNG/WebP.
- Resume dropzone reuses pattern from `MentorApplicationForm` (drag/drop, 5MB, PDF/DOC/DOCX), shows existing filename + replace/remove.
- Empty states: "Add your first experience" CTA cards.
- Visible only-to-mentor hint banner: "This is what mentees see" with a "Preview public profile" link.

## Technical changes

**Database migration** (extend `mentor_profiles`)
- Add columns: `headline text`, `phone text`, `current_organization text`, `current_role text`, `portfolio_url text`, `resume_url text`, `qualifications jsonb default '[]'::jsonb`, `experiences jsonb default '[]'::jsonb`.
- Keep existing columns; all new fields nullable / default empty.
- No RLS changes needed — existing "Mentors manage own profile" policy already covers them.

**Storage**
- Reuse existing `mentor-resumes` bucket for resume re-uploads.
- Reuse existing public `branding-assets` bucket under `avatars/<user_id>.<ext>` path for avatars; add an RLS policy on `storage.objects` allowing authenticated users to insert/update/delete files in `branding-assets/avatars/` only when the path starts with their own `auth.uid()`.

**Code (no `lov-tool-use` style — actual edits when approved)**
- New: `src/features/mentor-profile/api/mentorProfile.ts` — `fetchMentorProfile(userId)`, `updateMentorProfile(userId, payload)`, `uploadAvatar`, `uploadResume`.
- New: `src/features/mentor-profile/hooks/useMentorProfile.ts` — React Query `useMentorProfile` + `useUpdateMentorProfile` (optimistic).
- New: `src/features/mentor-profile/schema.ts` — Zod schemas for profile, qualification, experience.
- New components under `src/features/mentor-profile/components/`:
  - `ProfileHeader.tsx` (banner + avatar + completeness)
  - `AboutSection.tsx`
  - `ExpertiseInput.tsx` (Tab/Enter chip input, reusable)
  - `ExperienceList.tsx` + `ExperienceFormRow.tsx`
  - `QualificationsList.tsx` + `QualificationFormRow.tsx`
  - `LinksAndResumeSection.tsx`
  - `StickySaveBar.tsx`
- Rewrite `src/pages/MentorProfile.tsx` to compose the above with `useForm` + sectioned anchors.
- Update `src/integrations/supabase/types.ts` is auto-generated — not edited.

## Validation rules
- Name 2–100, phone matches international regex (reuse pattern from application form), LinkedIn must contain `linkedin.com/in/` or `/pub/`, portfolio is any valid URL, bio 50–2000 chars, expertise 1–15 tags, years 0–60.
- Qualification: institution + degree required; end year ≥ start year or "Present".
- Experience: company + title + start required; end ≥ start or "Present".

## Out of scope
- Public mentor profile page redesign (mentee-facing) — this only touches the mentor's own editor.
- Changing `mentor_applications` schema.
- Skill endorsements, certifications, languages (can be added later if desired).

