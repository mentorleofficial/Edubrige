## Find Mentor Page Redesign

### Goals
- Tighter, denser layout — no more big gaps between cards
- Compact portrait cards, 4 per row on desktop (2 on tablet, 1-2 on mobile)
- New expertise filter alongside existing search + program filter
- Polished header + filter bar

### Layout

```text
 ┌──────────────────────────────────────────────┐
 │  Find a Mentor                                │
 │  Browse and book sessions                     │
 ├──────────────────────────────────────────────┤
 │ [Search…]  [Expertise ▾]  [Program: All | …]  │ ← sticky filter bar
 │  Active chips: × React  × Design              │
 ├──────────────────────────────────────────────┤
 │  ┌────┐ ┌────┐ ┌────┐ ┌────┐                  │
 │  │card│ │card│ │card│ │card│   ← 4-col grid   │
 │  └────┘ └────┘ └────┘ └────┘     gap-4        │
 │  ┌────┐ ┌────┐ ┌────┐ ┌────┐                  │
 └──────────────────────────────────────────────┘
```

### Card changes
- Drop the fixed `width: 260px` + `aspectRatio 3/4` per-card style that forces wide whitespace inside the grid cell
- Use a proper responsive grid: `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4`
- Card becomes `aspect-[3/4]` and fills cell width
- Keep dark portrait look (full-bleed image, gradient bottom overlay, name + years + Book Now)
- Add top-left small expertise pill (first tag) for quick scanning
- Hover: subtle scale + brighter overlay

### Filters (new)

1. **Expertise multi-select** — extract unique expertise tags from loaded mentors, render as a Popover with checkable list + search. Active selections shown as removable chips under the filter bar. Filter logic: mentor must contain ALL selected tags (AND).
2. **Keep existing**: search input (name/expertise), program pills.
3. **Empty state** when filters return zero: friendly card with "Clear filters" button.

### Technical scope

Files touched:
- `src/pages/MentorDirectory.tsx` — replace card grid styles, add expertise filter state + Popover, sticky filter bar
- New small component `src/features/mentors/components/ExpertiseFilter.tsx` — Popover + Command list for multi-select
- Reuse existing `useMentors`, `Popover`, `Command`, `Badge` (no new deps)

Out of scope: backend queries, mentor schema, booking flow, other filters (years/availability/sort) — can add later if needed.

### Verification
- Resize preview at desktop/tablet/mobile — cards reflow without empty gutters
- Pick 2 expertise tags → grid filters to mentors with both; chips render with × to remove
- Combine with search + program — all three intersect correctly
- Clearing all filters restores full list
