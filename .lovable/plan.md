## Problem

After creating a Program and opening the Mapping board, admins don't know how to actually map mentors to mentees. Root causes:

1. The page defaults to the **Mapping** tab even when there are zero mentors/mentees in the program — so the board looks empty with no clear next step.
2. The current flow REQUIRES a two-step setup (add Members → then map) but this isn't communicated.
3. Mapping today is **drag-and-drop only**. Users on trackpads/touch/keyboard often miss that mentee chips are draggable. No click-to-assign fallback exists.
4. The "Add mentors and mentees first" message appears only when zero mentors are in the program — if mentors exist but mentees don't, the board renders with empty drop zones and no guidance.

## Plan

### 1. Smarter default tab + onboarding banner
- On load, if the program has **0 mentors OR 0 mentees** → default tab to **Members** (not Mapping).
- Add a top "Setup checklist" strip on the detail page with 3 steps and live ticks:
  - ✅ Program created
  - ◻ Add mentors (count)
  - ◻ Enroll mentees (count)
  - ◻ Map mentees to mentors (assigned / total)
- Each step is clickable and jumps to the matching tab.

### 2. Improve the Mapping board UX
- Show **explicit instructions** at the top of the board: "Drag a mentee from the left onto a mentor card — or click 'Assign' on a mentee for a menu."
- Add an **"Assign" button on every mentee chip** (both unassigned column and assigned mentees), opening a popover with the list of mentors in the program → click a mentor to assign / reassign. This is the keyboard/touch-friendly fallback.
- Add an "Unassign" item to that popover when the mentee is currently assigned.
- Better empty states per scenario:
  - 0 mentors in program → "Add mentors in the Members tab" with a button.
  - 0 mentees in program → "Enroll mentees in the Members tab" with a button.
  - Mentors + mentees present, none assigned → keep the board with the new instructional banner.

### 3. Members tab polish
- Add a **search input** above each list (mentors / mentees) — currently the lists can grow large and there's no filter.
- Show a small "In program" counter at the top of each card.
- After ticking a mentor or mentee, show a toast confirming and (when both lists become non-empty) a CTA "Open mapping board".

### 4. Visual cue that mentee chips are draggable
- Replace the small grip icon with a clearer `cursor-grab` chip styling: subtle dashed border on hover + tooltip "Drag to a mentor or click Assign".

### 5. No schema changes
All required tables (`program_mentors`, `program_mentees`, `mentor_mentee_assignments`) and the `validate_mentor_mentee_assignment` trigger already exist and enforce the rule that a mentee/mentor must be program members before assignment. No migrations needed.

## Files to edit

- `src/pages/AdminProgramDetail.tsx` — all UX changes above (default tab logic, checklist strip, instructional banner, Assign popover fallback, per-scenario empty states, search inputs in Members tab).

## Out of scope
- Bulk multi-select assign (can ship later if needed).
- Capacity limits per mentor (schema supports `programs.capacity` but per-mentor caps are a separate feature).
