# Improve Sessions Page UX (Mentee & Mentor)

Refresh both `MenteeSessions` and `MentorSessions` pages so users can scan, act on, and manage sessions much faster. Pure presentation work — no schema, no API changes.

## Problems today

- Dense 7-column table with crowded action buttons that wraps awkwardly on smaller screens.
- "Next session" gets lost in the same list as everything else — no clear hero.
- Expanded details row dumps long meeting URLs and raw notes without hierarchy.
- No search, no filtering by program/status, no quick way to find a specific mentor/mentee.
- Mobile: table is essentially unusable.
- Mentor action cluster (Complete / No-show / Cancel / Action items / Edit) is a button soup.

## What we'll build

### 1. Hero "Next session" card (top of page)
A prominent card above the tabs showing the soonest upcoming session:
- Counterparty avatar + name, program chip, title/topic.
- Big date/time with relative label ("in 2 hours", "tomorrow").
- Primary action: **Join now** (or **Add meeting link** for mentors if missing).
- Secondary: Add to calendar, Reschedule/Cancel (mentee) or Edit/Action items (mentor).
- Empty state with CTA: "Book a session" (mentee) / "Set availability" (mentor).

### 2. Toolbar above the list
- Search input (filter by counterparty name, title, topic).
- Program filter (multi-select from the user's programs).
- Status filter (booked / completed / cancelled / no_show) — Past tab only.
- Sort: Soonest first (default) / Newest booked.
- Result count + "Clear filters" link.

### 3. List redesign — session cards, not a raw table
Replace the table with a vertical list of compact session cards. Each card:

```text
┌──────────────────────────────────────────────────────────────┐
│ [Avatar] Jane Doe · Career Coaching        [● Booked]        │
│         "Resume review"                                       │
│         Fri, 22 May · 6:30 PM IST · 45 min                   │
│         ──────────────────────────────────────────────       │
│ [Join now] [Calendar ▾]   ··· (overflow menu)                │
└──────────────────────────────────────────────────────────────┘
```

- Status as a colored dot + label, not a heavy badge.
- Date/time line uses relative prefix when within 7 days.
- Primary CTA on the left; everything secondary moves into a `...` dropdown menu (Reschedule, Cancel, Tasks, Rate, Edit, Copy link).
- Expand-to-show details via a chevron — reveals topic, meeting link with copy button, mentee/mentor notes, cancellation reason.
- For mentors: inline "Add meeting link" pill when `meeting_url` is empty and session is upcoming (opens the existing edit dialog focused on the URL field).
- For mentees: "Rate session" CTA appears prominently on completed unrated cards.

### 4. Tabs & grouping
- Keep `Upcoming` / `Past` tabs.
- Within `Upcoming`, group by **Today / This week / Later** with sticky-ish section headers.
- Within `Past`, group by month.
- Tab labels show counts (already do).

### 5. Empty & loading states
- Skeleton cards (3) while loading instead of a single "Loading…" row.
- Empty state per tab with helpful CTA and icon.

### 6. Responsiveness
- Cards stack cleanly; actions collapse into the overflow menu below `sm`.
- Hero card switches to single-column layout below `md`.

## Technical notes

- New shared components in `src/components/sessions/`:
  - `SessionHeroCard.tsx` — hero for the next session (variant: mentor | mentee).
  - `SessionListCard.tsx` — list row card (variant: mentor | mentee).
  - `SessionsToolbar.tsx` — search + filters + sort.
  - `SessionSectionHeader.tsx` — group headers ("Today", "This week", "May 2026").
- Add a small helper `src/lib/relativeTime.ts` for "in 2 hours / tomorrow / yesterday / 3 days ago" using existing `APP_TZ`. Keep all absolute times via `formatIST*` helpers — no new date libs.
- Reuse existing dialogs (`SessionActionItemsPanel`, mentor edit dialog, mentee cancel dialog). Only the visual shell changes.
- All actions, mutations, and data hooks stay exactly as they are (`useMenteeSessions`, `useMentorSessions`, `useCancelMenteeSession`, `useUpdateSessionStatus`, `useUpdateSessionDetails`, `useMyPrograms`, `useMentorMentees`).
- Filtering/sorting/grouping done client-side via `useMemo` on the already-loaded session arrays.
- Use semantic Tailwind tokens only (`bg-card`, `text-muted-foreground`, `border`, `text-primary`, etc.) — no raw colors.
- Use `DropdownMenu` from shadcn for the overflow actions.

## Out of scope

- No changes to the booking flow, feedback flow, action items logic, or any data fetching.
- No backend, RLS, or schema changes.
- No new pages or routes.
