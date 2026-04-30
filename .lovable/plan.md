# Mentor & Mentee Program Experience

Today, programs only exist in Admin. Mentors and mentees can be mapped into programs, but they don't *see* their programs anywhere — no list, no badge, no filter, no context on sessions or bookings. This plan brings programs to life on both sides.

---

## What's missing today

- **Mentee side**: no "My Programs" page, no way to know which mentors belong to their program, `Find Mentors` shows everyone, no program badges anywhere.
- **Mentor side**: `My Mentees` groups by program but there's no dedicated programs view, no program filter on Sessions, no program badge on the dashboard.
- **Both sides**: dashboards don't surface programs, sessions don't show which program they belong to, no program detail page they can open.

---

## Mentee improvements

### 1. "My Programs" page (`/mentee/programs`)
List every program the mentee is enrolled in (`program_mentees` join `programs`). Each card shows:
- Program name, status badge, dates, color stripe
- Number of mentors available in the program
- Their assigned mentor (if any) — with "Book session" CTA
- Tags from `program_tags`
- "View mentors" button → filtered mentor directory

### 2. Program-aware Mentor Directory
- Add a **Program filter** chip row at the top of `/mentors`
- Default to "All my programs" for enrolled mentees
- Show a program badge on each mentor card (which programs they belong to)
- Respect existing `can_mentee_book_mentor` rules — mentors outside any program show as "Open to all"

### 3. Program detail page (`/mentee/programs/:slug`)
Read-only view showing program info, all mentors in the program (with book buttons), tags, dates, and the mentee's own assignment status.

### 4. Dashboard widget
Add an "Active Programs" card to `MenteeDashboard` showing count + quick links to top 2 programs.

### 5. Session context
On `MenteeSessions`, show a program badge next to each booked session (derived from mentor's program membership).

---

## Mentor improvements

### 1. "My Programs" page (`/mentor/programs`)
List every program the mentor is part of (`program_mentors`). Each card shows:
- Program name, status, dates, color stripe
- Mentee count assigned to *this mentor* in this program
- Total mentees enrolled in the program
- Tags
- "View my mentees" → jumps to `MentorMentees` filtered by program

### 2. Filter on `My Mentees` page
Add a program selector at the top so mentors can scope the list to one program.

### 3. Program detail page (`/mentor/programs/:slug`)
Shows program info, the mentor's assigned mentees in that program, and other mentors in the program (read-only roster for collaboration awareness).

### 4. Dashboard widget
Add an "Active Programs" card to `MentorDashboard` mirroring the mentee version.

### 5. Session context
On `MentorSessions`, show a program badge next to sessions.

---

## Shared / cross-cutting

- **Sidebar**: add `Programs` (FolderKanban icon) to both mentor and mentee sidebars, between Profile and Sessions area.
- **Reusable `ProgramBadge` component** — colored chip using `programs.color` (HSL), name + status. Used on mentor cards, session rows, dashboards.
- **Reusable `useMyPrograms()` hook** — returns programs for the current user based on their role, with caching.
- **Empty states**: friendly copy when a mentee/mentor isn't in any program yet ("Programs you join will appear here").
- **Clean slugs everywhere** (per existing project rule) — link to `/mentor/programs/:slug` and `/mentee/programs/:slug`, never IDs.

---

## Technical notes

**New files**
- `src/features/programs/api.ts` — `fetchMyPrograms(userId, role)`, `fetchProgramBySlug(slug)`, `fetchProgramMentors(programId)`, `fetchProgramMentees(programId)`
- `src/features/programs/hooks/useMyPrograms.ts`
- `src/components/programs/ProgramBadge.tsx`
- `src/components/programs/ProgramCard.tsx`
- `src/pages/MenteePrograms.tsx`, `src/pages/MenteeProgramDetail.tsx`
- `src/pages/MentorPrograms.tsx`, `src/pages/MentorProgramDetail.tsx`

**Edited files**
- `src/App.tsx` — register 4 new routes (mentor + mentee programs list + detail), guarded by role
- `src/components/AppSidebar.tsx` — add Programs item to mentor and mentee menus
- `src/components/dashboards/MentorDashboard.tsx` + `MenteeDashboard.tsx` — add Programs widget
- `src/pages/MentorDirectory.tsx` — add program filter + badges on mentor cards
- `src/pages/MentorMentees.tsx` — add program filter dropdown
- `src/pages/MentorSessions.tsx` + `src/pages/MenteeSessions.tsx` — show program badges

**RLS** is already correct — `Members read their programs` policy on `programs`, plus role-scoped reads on `program_mentors` / `program_mentees`. No DB migration needed.

**Queries are slug-based** for detail pages, matching the project convention. List pages use `program_mentors.mentor_id = auth.uid()` / `program_mentees.mentee_id = auth.uid()` joined with `programs`.

---

## Out of scope (call out for later)
- Program-level chat/announcements
- Program progress tracking / milestones
- Program-level analytics for mentors
- Mentee self-enrollment (currently admin-only)

Approve and I'll build it.
