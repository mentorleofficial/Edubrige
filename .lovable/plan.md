# Calendar Preview for Mentor Availability

Add a live, Calendly-style calendar preview alongside the editor on `/availability` so mentors can visually see their bookable hours as they configure them.

## What the user will see

A new **"Preview"** panel on the Mentor Availability page showing how mentees will see their calendar:

- **Month view (left)**: Compact calendar grid. Days with availability are highlighted (filled circle in the brand color). Past dates and fully blocked dates are dimmed. Clicking a date selects it.
- **Time slots (right)**: For the selected date, shows the available 30‑min slots (e.g., `9:00 AM`, `9:30 AM`, …) computed from weekly hours + date overrides, in the mentor's timezone.
- **Header**: Shows the mentor's timezone and a "View as mentee" hint.
- **Empty states**: "No availability on this day" when a day is unavailable; "Select a date" prompt initially.

Layout on `/availability`:

```text
┌────────────────────────────────────────────────────┐
│ Availability      [Saving… / Saved]                │
├────────────────────┬───────────────────────────────┤
│ Editor (left)      │ Preview (right, sticky)       │
│ - Timezone         │ ┌─────────────┬─────────────┐ │
│ - Weekly hours     │ │ Month grid  │ Time slots  │ │
│ - Date overrides   │ │ (highlight) │ for date    │ │
│                    │ └─────────────┴─────────────┘ │
└────────────────────┴───────────────────────────────┘
```

On screens < lg, the preview stacks below the editor.

## How it works

The preview reads the same in-memory `slots` and `overrides` state already managed in `MentorAvailability.tsx`, so it updates instantly on every edit (no extra fetch).

For each date in the visible month:
1. If a `mentor_availability_overrides` row exists for that date:
   - `is_unavailable=true` → no slots
   - else → use the override's `start_time`/`end_time` ranges
2. Else → use weekly `slots` for that `day_of_week`
3. Slice each range into 30‑minute starts to render slot chips
4. Skip slots whose start time is in the past (for today)

## Technical changes

**New files**
- `src/features/availability/components/AvailabilityPreview.tsx` — the panel: month nav (prev/next), day grid, slot list. Pure presentational, props: `{ slots, overrides, timezone }`.
- `src/features/availability/previewUtils.ts` — helpers:
  - `getMonthMatrix(year, month)` → 6×7 date grid
  - `getRangesForDate(date, slots, overrides)` → `{start,end}[]`
  - `sliceIntoSlots(ranges, stepMinutes=30)` → `string[]` of `HH:MM`
  - `formatSlotLabel(hhmm)` → `"9:30 AM"`
  - `hasAnyAvailability(date, ...)` → boolean (for month-grid highlight)

**Edited**
- `src/pages/MentorAvailability.tsx`
  - Switch the outer container from `max-w-3xl` single column to a 2‑column grid (`lg:grid-cols-[minmax(0,1fr)_380px]`).
  - Right column: sticky `<AvailabilityPreview slots={slots} overrides={overrides} timezone={timezone} />`.
  - No data-layer changes; reuses existing state.

**Reused**
- `src/components/ui/calendar.tsx` (shadcn) for the month grid with a custom `modifiers` map marking days that have availability, styled with the brand `primary` token.
- Existing `Card`, `Button`, `Badge` primitives.

## Out of scope
- No new DB tables or migrations.
- No changes to `BookSession.tsx` (it already consumes the same data).
- No drag-to-create on the calendar — editing stays in the existing weekly/overrides UI.
