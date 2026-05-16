# Force IST (Asia/Kolkata) everywhere

Make every user-visible date/time render in **Indian Standard Time (Asia/Kolkata, UTC+5:30)** — across the app UI, booking flow, booking emails, calendar invites (.ics + Google), mentor availability, and admin tables. Stored data in the database stays in UTC (correct & unchanged); only the display/formatting layer is forced to IST.

## What changes for the user

- All session times in dashboards, lists, calendars, and pop-ups show in IST with an "IST" suffix.
- Booking flow's time picker shows mentor availability in IST regardless of the mentor's stored timezone.
- Booking confirmation / reminder emails show times in IST.
- "Add to calendar" .ics + Google Calendar links use the correct UTC instant (so the user's calendar shows the right local time), and the event description includes the IST time for clarity.
- Mentor "Availability" page is locked to IST — the timezone selector + auto-detect are removed (or shown read-only as "Asia/Kolkata (IST)").

## Implementation outline (technical)

1. **Add a shared formatter** `src/lib/datetime.ts`:
   - Constant `APP_TZ = "Asia/Kolkata"`.
   - Helpers `formatIST(date, pattern)`, `formatISTDate`, `formatISTTime`, `formatISTDateTime` built on `date-fns-tz` (`formatInTimeZone`). Each appends `IST` where appropriate.
   - `toISTParts(date)` for components that need day/hour pieces in IST.
2. **Replace ad-hoc formatting** across the ~30 files listed below with the shared helpers. Files to update:
   - Pages: `BookSession`, `MenteeSessions`, `MentorSessions`, `AdminSessions`, `AdminAuditLogs`, `AdminUsers`, `AdminApplications`, `AdminFeedback`, `AdminPrivacyRequests`, `AccountPrivacy`, `MenteeProgramDetail`, `MentorProgramDetail`, `MentorAvailability`, `PublicMentorProfile`.
   - Dashboard widgets: `mentee/NextSessionCard`, `mentee/SessionsCalendar`, `mentee/RecentActivity`, `mentor/NextSessionCard`, `mentor/WeeklySchedule`, `mentor/RecentActivityFeed`, `mentor/RecentFeedbackPanel`, `mentor/MyMenteesPanel`, `admin/RecentSessions`, `admin/RecentFeedback`, `admin/RecentAudit`, `admin/WeekSchedule`.
   - Components: `ApplicationDetailDialog`, `programs/ProgramCard`, `availability/components/AvailabilityPreview`.
3. **Booking-time grid (`BookSession.tsx` + `useBookSessionData`)**: compute available slots by converting the mentor's weekly availability (stored as `day_of_week` + `HH:MM` in their tz) into UTC instants, then render the picker in IST. The slot generator already uses the mentor's timezone — switch the display tz to IST and keep the conversion math correct.
4. **Mentor Availability page (`MentorAvailability.tsx`)**: hardcode timezone to `Asia/Kolkata`. Hide the timezone `Select` and "Detect" button (or show a read-only "Asia/Kolkata (IST)" badge). Stop auto-updating `mentor_profiles.timezone`. Backfill existing rows to `Asia/Kolkata` via a one-line migration.
5. **Booking emails (`supabase/functions/send-booking-email/index.ts`)**: format `scheduled_at` with `Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", ... })` and label times "IST" in the email body + subject.
6. **Calendar links (`src/lib/calendarLinks.ts`)**:
   - .ics: keep `DTSTART`/`DTEND` in UTC (`Z` format) so calendars render in the attendee's local zone correctly. Add the IST time to the event `DESCRIPTION` (e.g. "Scheduled: 16 May 2026, 6:30 PM IST").
   - Google Calendar URL: keep the UTC `dates=` param; append IST string into `details`.
7. **Database**: one migration to set every `mentor_profiles.timezone` to `'Asia/Kolkata'` and change the column default to `'Asia/Kolkata'` (was `'UTC'`).

## Out of scope

- Changing how timestamps are stored in Postgres (they stay `timestamptz` / UTC).
- Letting users choose a different display timezone (explicitly removed).

## Verification

- Book a session as a mentee → confirm time shown in picker, confirmation toast, dashboard, mentor's sessions list, admin sessions table, and the email all match the same IST wall-clock time.
- Download the .ics and open in Google/Apple Calendar → event appears at the same IST instant.
- Mentor Availability page shows "Asia/Kolkata (IST)" and no timezone selector.
