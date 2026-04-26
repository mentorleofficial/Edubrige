# Show date overrides in the preview + live updates

## What changes for the user

On the Availability page's preview calendar:

- **Blocked dates** (e.g., holidays) appear with a red dot underneath the day number and a strikethrough, and are not clickable.
- **Custom-hours dates** (override with specific times) get an amber ring around the day number to distinguish them from regular weekly availability (which stays blue).
- **Auto-jump**: when a mentor adds a new override, the preview automatically navigates its month view to that date and selects it, so the change is immediately visible without scrolling or reloading.
- **Selected-date panel** shows a small badge: "Holiday — unavailable" or "Custom hours" when an override is in effect on that date.
- A tiny **legend** under the calendar explains the three states (Available / Custom / Blocked).

The page already auto-refreshes state after every save, so edits propagate live — no browser reload needed. The auto-jump makes that obvious.

## Technical changes

**`src/features/availability/previewUtils.ts`** — add helper:
```ts
export type OverrideKind = "blocked" | "custom" | null;
export function getOverrideKind(date, overrides): OverrideKind
```

**`src/features/availability/components/AvailabilityPreview.tsx`**
- Compute `kind = getOverrideKind(date, overrides)` per day cell. Render:
  - `blocked` → muted text + line-through + small `bg-destructive` dot
  - `custom` → amber ring (`ring-2 ring-amber-500/60`) + clickable
  - else → existing blue highlight
- Add `useEffect` watching `overrides` length: when a new override is added, set `cursor` to that override's month and `setSelected` to its date. Use a ref to track previously seen IDs so we only jump on additions.
- In the slot panel, when `selected` has an override, show a `<Badge>`:
  - blocked → "Holiday — unavailable"
  - custom → "Custom hours"
- Add a 3-item legend row below the grid using small colored dots.

**No DB or API changes.** State already flows live from `MentorAvailability.tsx` via `refresh()` after each mutation.

## Out of scope
- Editing overrides directly from the calendar (still done in the Date overrides card).
- Recurring/range overrides spanning multiple days.
