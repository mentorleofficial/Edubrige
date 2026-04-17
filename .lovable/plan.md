

# Updated Mentor Application Flow

## New behavior

When a mentor submits the application form on `/become-a-mentor`:
1. Create the auth user immediately with email + auto-generated password (or let them set one in the form)
2. Send email verification OTP to confirm the email address
3. Insert mentor_application row (status=pending) AND mentor_profile row (is_active=false), both linked to the new user
4. Sign the user in automatically after submission
5. Redirect them to their dashboard — which shows the "Pending Activation" banner since `mentor_profiles.is_active=false`

So the mentor instantly has account access (limited dashboard + profile) while admin still reviews the application to flip `is_active=true`.

## Form changes (`MentorApplicationDialog`)

Add a **password field** (required, min 8 chars) so the mentor can log in immediately. Email verification happens via OTP sent by Supabase auth.

## Submission logic changes

Replace the current "insert into mentor_applications + upload resume" flow with:

1. Upload resume to `mentor-resumes` bucket (unchanged)
2. `supabase.auth.signUp({ email, password, options: { data: { full_name, role: 'mentor' }, emailRedirectTo: window.location.origin + '/login' } })` — this triggers Supabase to send the verification email automatically
3. The existing `handle_new_user` DB trigger creates the `users` row + `user_roles` row with role=mentor
4. Insert mentor_application (status=pending, link via email)
5. Insert mentor_profile with `is_active=false`, bio/expertise/linkedin from form
6. Show success screen: "Account created! Check your email to verify, then log in to access your dashboard. Admin will review your application for full mentor activation."

## Auth email verification (OTP / confirmation link)

Supabase already sends a default confirmation email out of the box when `signUp` is called — no extra setup required for basic functionality. The email contains a verification link the mentor clicks to confirm their address before they can log in.

If the user wants this email **branded** with the platform's look & feel (logo, colors, custom copy), we'd scaffold custom auth email templates. For now I'll rely on the default Supabase confirmation email so the flow works immediately. We can brand it as a follow-up.

> Note: in Supabase Auth settings, "Confirm email" must remain enabled (it is by default) for the verification email to be sent.

## Admin approval flow changes

The `approve-mentor-application` edge function no longer needs to invite the user — the account already exists. Simplify it to:
1. Verify caller is admin
2. Look up the user by email from the application
3. Update `mentor_profiles.is_active = true`
4. Update application status = approved + reviewed_by/at
5. Log audit event

Reject flow unchanged (just status update + notes).

## RLS / DB

No schema changes needed. Existing tables and policies already support this:
- `mentor_applications` INSERT allowed for anon+authenticated ✓
- `mentor_profiles` — mentor manages own ✓, admin full access ✓
- `handle_new_user` trigger already creates users/user_roles from signUp metadata ✓

## Files to edit

- `src/components/MentorApplicationDialog.tsx` — add password field, replace submit logic with signUp + dual insert + auto sign-in
- `supabase/functions/approve-mentor-application/index.ts` — simplify to "activate existing user" instead of invite
- `src/pages/MentorLanding.tsx` — minor success-state copy update if needed

## Edge cases

- **Email already in use**: signUp returns an error → show "An account with this email already exists. Please log in." with link to /login
- **Resume upload fails**: abort before signUp so we don't create an orphan account
- **mentor_profile insert fails after signUp**: log error, surface message; user can complete profile from their dashboard later

