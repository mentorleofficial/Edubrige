# Create dummy mentee user

Create a test mentee account you can log in with to test the mentee flow (onboarding wizard, mentor browsing, booking, etc.).

## Credentials
- **Email:** `mentee.test@mentorle.dev`
- **Password:** `Mentee#Test123`
- **Full name:** Test Mentee
- **Role:** mentee
- **Onboarding status:** Not onboarded (so you can test the hard-gate + wizard end-to-end)

## How it will be created

Since the password-based mentee user must go through Supabase Auth (not just `public.users`), I'll run a one-shot script using the service role key that:

1. Calls `supabase.auth.admin.createUser` with `email_confirm: true` so you can log in immediately without email verification.
2. Lets the existing `handle_new_user` trigger insert the matching `public.users` and `public.user_roles` rows with role `mentee`.
3. Verifies the rows were created and prints the credentials.

No `mentee_profiles` row will be inserted — that way `onboarded_at` is NULL and the `MenteeOnboardingGuard` will redirect you to `/onboarding/mentee` on first navigation, exactly like a real first-time user.

## How to use it
1. Go to `/login`
2. Sign in with the credentials above
3. You'll be hard-gated into the mentee onboarding wizard
4. Complete (or skip through) the wizard to unlock `/mentors`, `/book/:mentorId`, `/mentee/sessions`

## Notes
- If you'd like a second variant that's already onboarded (skipping the wizard), say the word and I'll seed that one too.
- If you prefer different credentials (your real email, a different password), tell me and I'll use those instead.
