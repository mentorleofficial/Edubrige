## Admin Capabilities — Production Plan

Build out four admin surfaces on top of the existing Users / Applications pages:

1. **Mentor Approval** (extend existing applications flow — bulk + audit polish)
2. **Programs** (full entity: cohort metadata + tag taxonomy)
3. **Mentor → Program tagging** (assign mentors to programs)
4. **Mentee → Program assignment + Mentor–Mentee group mapping** (1 mentor → many mentees inside a program; mentees can only book their assigned mentor for that program)

---

### 1. Data model (new tables)

```text
programs
  id, name, slug, description, status (draft|active|archived),
  starts_on, ends_on, capacity (nullable), color, created_by, timestamps

program_tags                       -- lightweight taxonomy attached to a program
  id, program_id → programs, label, UNIQUE(program_id, lower(label))

program_mentors                    -- mentors assigned to a program
  id, program_id, mentor_id (→ users.id), assigned_by, assigned_at
  UNIQUE(program_id, mentor_id)

program_mentees                    -- mentees enrolled in a program
  id, program_id, mentee_id (→ users.id), assigned_by, assigned_at
  UNIQUE(program_id, mentee_id)

mentor_mentee_assignments          -- the actual mapping (group: 1 mentor → many mentees within a program)
  id, program_id, mentor_id, mentee_id, assigned_by, assigned_at, notes
  UNIQUE(program_id, mentee_id)    -- a mentee has exactly one mentor per program
  INDEX(program_id, mentor_id)     -- fast lookup of a mentor's mentee group
```

RLS:
- All four tables: admins full access; mentors read rows where `mentor_id = auth.uid()`; mentees read rows where `mentee_id = auth.uid()`.
- Booking guard: update `sessions` INSERT policy so a mentee can only book a mentor if a row exists in `mentor_mentee_assignments` for `(mentor_id, mentee_id)` — OR the mentor has no program (free mode). Implemented via a `SECURITY DEFINER` function `can_mentee_book_mentor(mentee, mentor)` to avoid recursion.

Trigger: when `mentor_mentee_assignments` is inserted, ensure the mentor exists in `program_mentors` and mentee in `program_mentees` for that program (raise otherwise).

Audit: hook `log_audit_event()` onto all four new tables.

---

### 2. Admin UI

New sidebar items (admin role only):

```text
Dashboard
Users
Applications        (existing)
Programs            ← new
Audit Logs
Settings
```

#### 2a. `/admin/applications` — Mentor Approval polish
- Add **bulk select** (checkbox column) with bulk Approve / Reject actions.
- Add **admin notes** textarea on the detail dialog (already in schema).
- Surface `reviewed_by` + `reviewed_at` in the detail dialog.
- Empty/loading skeletons consistent with `AdminUsers`.
- Show a "Recently approved" strip linking to the new Programs page so admins can immediately tag the new mentor.

#### 2b. `/admin/programs` — list
- Table: Name, Status badge, Dates, Mentors count, Mentees count, Tags.
- Filters: status (draft/active/archived), search by name.
- "New Program" dialog (name, description, dates, capacity, color, status).
- Row click → `/admin/programs/:id`.

#### 2c. `/admin/programs/:id` — detail with tabs
Header: name, status switcher, dates, capacity progress bar (`enrolled/capacity`), edit / archive buttons.

Tabs:
1. **Overview** — description, tags chip editor (add/remove `program_tags`), audit timeline.
2. **Mentors** — searchable picker (only users with `role=mentor` AND `mentor_profiles.is_active=true`), shows assigned mentors with remove + "View mentees" quick action.
3. **Mentees** — searchable picker (users with `role=mentee` AND `onboarded_at IS NOT NULL`), shows enrolled mentees with their currently-assigned mentor (or "Unassigned" badge).
4. **Mapping** — the heart of the feature:
   - Two-column board: left = mentors in program (each as a card showing avatar, name, mentee count, capacity hint), right = unassigned mentees list.
   - Drag-and-drop a mentee onto a mentor card to assign; drag back to the unassigned column to unassign; drag between mentor cards to reassign.
   - Bulk-assign: multi-select mentees + "Assign to…" dropdown for keyboard / mobile fallback.
   - Optimistic updates via React Query, toast on error rollback.
   - Empty states: "Add mentors first" / "Enroll mentees first" with CTA back to the relevant tab.

#### 2d. Users page enhancement
- Add a "Programs" column showing chip count per user (hover = list).
- Quick action menu: "Assign to program…".

---

### 3. Mentee experience (consequence of mapping)

- `MenteeDashboard`: new "My program" card showing program name, assigned mentor (avatar + book button), other mentees in cohort count.
- `MentorDirectory` for mentees enrolled in a program: filter to assigned mentor only, with a banner "You're in {Program} — book your assigned mentor". Mentees not in any program keep current free browse behaviour.
- Booking page enforces server-side via the new RLS function (defense in depth).

---

### 4. Mentor experience (consequence of mapping)

- `MentorDashboard`: "My mentees" panel grouped by program, with mentee name, last session, quick "Message" / "View profile" actions.
- New `/mentor/mentees` page: list of all assigned mentees across programs, searchable.

---

### 5. Technical details

**Files to create**
```text
supabase/migrations/<ts>_programs_and_mapping.sql
src/features/programs/
  api/programs.ts            (CRUD + assignments)
  hooks/usePrograms.ts
  hooks/useProgramDetail.ts
  hooks/useMapping.ts
  components/ProgramFormDialog.tsx
  components/ProgramTagEditor.tsx
  components/MentorPicker.tsx
  components/MenteePicker.tsx
  components/MappingBoard.tsx
  components/MappingMenteeCard.tsx
  components/MappingMentorColumn.tsx
  schema.ts
src/pages/AdminPrograms.tsx
src/pages/AdminProgramDetail.tsx
src/pages/MentorMentees.tsx
```

**Files to edit**
```text
src/App.tsx                              -- new routes (admin + mentor)
src/components/AppSidebar.tsx            -- "Programs" item; mentor "My Mentees" item
src/pages/AdminApplications.tsx          -- bulk actions, polish
src/components/ApplicationDetailDialog.tsx
src/pages/AdminUsers.tsx                 -- programs column + assign action
src/components/dashboards/MenteeDashboard.tsx -- "My program" card
src/components/dashboards/MentorDashboard.tsx -- "My mentees" panel
src/pages/MentorDirectory.tsx            -- enforce assigned-mentor view when enrolled
src/pages/BookSession.tsx                -- friendly error if RLS blocks
```

**Libraries**: drag-and-drop via `@dnd-kit/core` + `@dnd-kit/sortable` (lightweight, accessible, already idiomatic with shadcn).

**State**: React Query keys namespaced under `["programs", ...]` with optimistic updates for mapping. All mutations call `handleError` for consistent toasts.

**Performance**: program detail uses one composed query (program + tags + counts) and lazy tabs; mapping board paginates mentees if >100.

**Security**:
- All new RLS denies by default.
- `can_mentee_book_mentor` is `SECURITY DEFINER` with `search_path=public`.
- Audit triggers on every mapping change.

---

### 6. Out of scope (future)
- Messaging between mentor and assigned mentees.
- Auto-matching algorithm (current flow is admin-driven by design).
- Per-program availability overrides.

---

### Build order (sequential PRs)
1. Migration + RLS + helper function.
2. Programs CRUD + list/detail shell + tag editor.
3. Mentor & Mentee assignment tabs.
4. Mapping board (DnD).
5. Mentee/Mentor consumer surfaces (dashboards, directory).
6. Applications bulk actions polish + Users page chips.
