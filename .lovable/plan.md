## Auto-detect timezone

Use the browser's `Intl.DateTimeFormat().resolvedOptions().timeZone` to detect the mentor's local timezone, and apply it automatically when they haven't explicitly set one yet.

### Behavior
- On loading the Availability page, if the saved timezone is the default `"UTC"` (i.e. never set by the mentor), auto-fill it with the browser-detected timezone and persist it silently.
- If the mentor already has a non-UTC timezone saved, leave it alone (respect their choice).
- Add a small "Detect" button next to the timezone selector so they can re-detect manually anytime.
- Show the detected zone as the default selection in the dropdown.

### Technical changes
- **`src/features/availability/timeUtils.ts`**: add `detectTimezone()` helper returning `Intl.DateTimeFormat().resolvedOptions().timeZone` with a `"UTC"` fallback. Ensure detected zone is included in the `TIMEZONES` list if missing.
- **`src/pages/MentorAvailability.tsx`**:
  - After `refresh()` resolves, if `timezone === "UTC"`, call `onTimezoneChange(detectTimezone())` once (guarded by a ref so it doesn't loop).
  - Add a "Detect" ghost button beside the timezone `<Select>` that calls `onTimezoneChange(detectTimezone())`.
- No DB schema change needed — `mentor_profiles.timezone` already exists.

### Notes
- Auto-set is silent (uses existing "Saving…/Saved" indicator).
- A future improvement could distinguish "never set" from "explicitly set to UTC" via a nullable column, but treating UTC-default as "unset" is sufficient for now.