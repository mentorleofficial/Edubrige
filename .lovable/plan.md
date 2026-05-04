## Redesign Mentee Booking — Calendar + Side Slot Panel

Replace the current vertical list of bookable slots on `src/pages/BookSession.tsx` with the same calendar-based interface used in the mentor `AvailabilityPreview`: a month calendar on the left (color-coded by availability) and a slot panel on the right that appears when a date is selected.

### Layout

```
┌──────────── Mentor header ────────────┐
│ Avatar  Name + timezone note          │
└───────────────────────────────────────┘
┌─────────── Calendar ─────────┐ ┌──── Slots for [Date] ─────┐
│   < November 2026 >          │ │ Wed, Nov 12               │
│   S  M  T  W  T  F  S        │ │                           │
│   ·  ·  ·  ·  ·  1  2        │ │ [ 9:00 AM ] [ 9:30 AM ]   │
│   3  4  5  6  7  8  9        │ │ [10:00 AM ] [10:30 AM ]   │
│  10 11 12 13 14 15 16        │ │ [11:00 AM ] (taken)       │
│  ...                         │ │                           │
│ Legend: Avail · Custom · Full│ │ Notes (optional) [textarea]│
└──────────────────────────────┘ │ [ Confirm Booking ]       │
                                 └───────────────────────────┘
```

On mobile (single column) the calendar stacks above the slot panel.

### Behaviour

1. **Calendar grid** (reuse helpers from `src/features/availability/previewUtils.ts`):
   - Month navigation (prev/next), Sunday-first 6×7 grid.
   - Color coding per date:
     - **Available** (has weekly slots or custom override with free time): primary tint background.
     - **Custom hours** (override defines non-default hours): amber ring.
     - **Fully booked** (all slots that day are taken): muted with strikethrough + "Full" dot.
     - **Blocked** (mentor override `is_unavailable`): muted, line-through, destructive dot.
     - **Past** dates: disabled.
     - **Today**: ring.
     - **Selected**: filled primary.
   - Only future dates within the next ~90 days are clickable.

2. **Side slot panel** (renders when a date is selected):
   - Header shows the formatted selected date and a badge if Custom/Blocked.
   - Builds half-hour slots from that date's ranges using `sliceIntoSlots(ranges, 30)`.
   - Each slot becomes a clickable chip:
     - Free → outlined primary, click to select.
     - Taken (matches `bookedTimes` set from existing `sessions` query) → disabled with "Taken" label.
     - Selected → filled primary with check icon.
   - Below the chips: "What would you like to discuss?" textarea (existing behavior).
   - "Confirm Booking" / "Reschedule to this slot" button → opens the existing confirmation `AlertDialog`.
   - Empty state: "No availability on this day." or "Marked unavailable on this date."

3. **Booking logic**: unchanged. Same insert into `sessions`, same overlap-error handling, same reschedule flow (cancels old session if `?reschedule=` param present).

### Technical Notes

- **File edited**: `src/pages/BookSession.tsx` only. No DB changes, no new routes.
- Reuse existing utilities:
  - `getMonthMatrix`, `getRangesForDate`, `getOverrideKind`, `sliceIntoSlots`, `formatSlotLabel`, `hasAnyAvailability`, `isSameDay`, `ymd` from `src/features/availability/previewUtils.ts`.
- New local helper `isSlotTakenAt(date, hhmm)` that builds the ISO string and checks against the existing `bookedTimes: Set<string>` (already populated from the `sessions` query in the current file).
- Compute a per-date "fully booked" flag by intersecting the day's slot list with `bookedTimes` so the calendar can dim those days.
- Keep the same data fetch (mentor row, `mentor_availability`, `mentor_profiles`, `mentor_availability_overrides`, future booked `sessions`) — no API changes.
- Keep the timezone info line ("Times shown in mentor's timezone: …").
- Keep the existing confirm `AlertDialog` and toast messages.
- Two-column layout via `grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6`; calendar card and slot card are siblings.

### Out of scope

- No change to mentor-side availability editor.
- No change to `MenteeSessions`, `MentorSessions`, or `AdminSessions`.
- No DB migration.
