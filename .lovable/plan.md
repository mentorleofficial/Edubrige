## Mentor Availability — Calendly-Style Redesign

Rebuild the Availability page so mentors set their weekly hours the way Calendly does: each weekday lists its own time ranges inline, with a toggle to mark the day off, "+" to add another range on the same day, and a quick "copy times to other days" action. Add timezone support and one-off date overrides (e.g. holidays or extra availability on a specific date).

### UX (mirrors Calendly "Weekly hours")

```text
Timezone:  [ Asia/Kolkata ▾ ]

WEEKLY HOURS
─────────────────────────────────────────────
[●] SUN     09:00 ▾  –  17:00 ▾   [+] [⧉] [✕]
[ ] MON     Unavailable                  [⧉]
[●] TUE     09:00 ▾  –  12:00 ▾   [+] [⧉] [✕]
            13:00 ▾  –  17:00 ▾   [+] [⧉] [✕]
[●] WED     09:00 ▾  –  17:00 ▾   [+] [⧉] [✕]
…

DATE-SPECIFIC OVERRIDES
─────────────────────────────────────────────
[+ Add date override]
• 26 Apr 2026 — Unavailable        [✕]
• 02 May 2026 — 10:00 – 14:00      [✕]
```

- Day toggle on the left switches the day between Available / Unavailable.
- `+` adds another time range under the same day.
- `⧉` (copy) opens a small popover: "Apply these times to: [ ] Mon [ ] Tue …" → bulk-creates ranges.
- `✕` removes a single range.
- Time pickers use 15-min increments (00, 15, 30, 45) instead of hourly.
- Validation: end > start, no overlapping ranges within the same day; show inline error.
- Auto-save each change (debounced) with a small "Saved" indicator — no manual Save button.

### Date overrides

A separate section lets the mentor pick a specific calendar date and either:
- mark it fully **Unavailable** (blocks bookings even if the weekday is normally open), or
- set **custom hours** for that date only (replaces weekly hours for that day).

### Data model changes

1. Extend `mentor_availability` (already weekly-recurring) — no schema change needed for weekly hours; the existing `day_of_week / start_time / end_time` row already supports multiple ranges per day.
2. Add `timezone text` to `mentor_profiles` (default `'UTC'`).
3. New table `mentor_availability_overrides`:
   - `id uuid pk`
   - `mentor_id uuid not null`
   - `date date not null`
   - `is_unavailable boolean not null default false`
   - `start_time time null`
   - `end_time time null`
   - `created_at timestamptz default now()`
   - unique `(mentor_id, date, start_time)` to allow multiple ranges per date
   - RLS: mentor manages own; authenticated read; admin full access (mirrors `mentor_availability`).

### Booking page impact (`BookSession.tsx`)

- When generating the next bookable date for a weekday, check overrides:
  - If date has `is_unavailable=true` → skip.
  - If date has custom range → show that range instead of weekly default.
- Display times in mentor's timezone with a note ("Mentor's timezone: Asia/Kolkata").

### Files

- **Edit** `src/pages/MentorAvailability.tsx` — full rebuild with the layout above.
- **New** `src/features/availability/api/availability.ts` — fetch/upsert/delete weekly ranges and overrides.
- **New** `src/features/availability/hooks/useAvailability.ts` — react-query hooks with auto-save.
- **New** `src/features/availability/components/DayRow.tsx`, `TimeRangePicker.tsx`, `CopyTimesPopover.tsx`, `OverrideList.tsx`.
- **Edit** `src/pages/BookSession.tsx` — respect overrides + timezone label.
- **New migration** — add `timezone` to `mentor_profiles`, create `mentor_availability_overrides` with RLS.

### Out of scope (can come later)

- Buffer time between bookings, min notice, max bookings/day.
- Calendar sync (Google/Outlook).
- Per-event-type schedules (Calendly's "Event types" concept).
