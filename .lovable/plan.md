# Fix empty Mentor/Mentee lists in Program Members tab

## What's wrong

You have 1 mentor (Abhishek Soni) and 1 mentee (Test Mentee) in the database, but the Members tab shows "No mentors match" / "No mentees match". The data is there — it's not being fetched.

The page calls `loadDirectory()` immediately on mount. If the Supabase auth session hasn't finished restoring at that moment, `auth.uid()` is `null`, the admin RLS policy on `user_roles` evaluates to false, and the query silently returns an empty array. There's no retry, so the empty state sticks until you reload.

## Fix

In `src/pages/AdminProgramDetail.tsx`:

1. **Gate the directory + program loads on `user` from `useAuth()`**. Don't fire either query until `user?.id` is available.
2. **Add empty-state messaging** that distinguishes "no users on platform yet" from "no search match":
   - If `allMentors.length === 0` (after load completes), show: *"No mentors exist yet. Approve mentor applications or invite mentors from Admin → Users."* with two link buttons to `/admin/applications` and `/admin/users`.
   - Same for mentees, pointing to `/admin/users`.
   - Only show "No mentors match" when the user has typed a search that filters everything out.
3. **Add a small `loading` flag** so we don't flash the "no mentors" message during the initial fetch.

No DB changes, no schema changes — purely a client-side timing + UX fix.

## Why this matches what you saw

Your screenshot shows both cards empty with "0 in program" and "No mentors match" before you've typed anything in search. With the fix, you'll see Abhishek Soni in the Mentors card and Test Mentee in the Mentees card, each with a checkbox to add them to the Spring 2026 program.
