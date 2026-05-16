# Hide past time slots for today

## Problem
On the Book Session page, when a mentee selects today's date, the slot grid shows all of the day's slots — including times that have already passed in IST. Users can click them and try to book.

## Fix
Filter out (or disable) slots whose start time in IST is at or before "now" when the selected date is today (IST).

## Where
`src/pages/BookSession.tsx`

- Add an `isPastSlot(date, hhmm)` helper that compares the slot's IST start instant (already produced via `toISTDate(date, hhmm)`) to `Date.now()`. Add a small buffer (e.g. 5 minutes) so we don't offer a slot that's about to start.
- Use this in two places:
  1. **Slot grid render** (`daySlotList.map`): hide past slots entirely if the date is today; for cleanliness, simply `filter` them out of the displayed list. Keeps the grid tidy and prevents selection.
  2. **`isDayFullyBooked(date)`**: also treat past slots as unavailable so the calendar can correctly mark today as fully booked when no future slots remain.

No DB / no business-logic changes. Pure presentation filter using existing IST helpers.

## Notes
- Use `toISTDate` (already in the file) to get the correct UTC instant for each slot, then compare with `new Date()` — this correctly handles browsers in any timezone.
- Today comparison uses IST date (`formatISTISODate`) so a user in a different timezone still sees the correct "today".
