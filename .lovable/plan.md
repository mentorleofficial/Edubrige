# Login RLS Function Permission Fix Plan

## Goal

Restore login by fixing the database permission error that blocks the app from reading the signed-in user's profile.

## What I found

- Login succeeds at Supabase Auth, but profile loading fails immediately afterward.
- The failing `/users` request includes a valid authenticated token.
- Supabase returns: `permission denied for function is_program_mentor`.
- A previous security migration revoked execute access from helper functions used inside RLS policies, including `is_program_mentor`, `is_program_member`, `can_mentee_book_mentor`, and `has_role`.
- Because `users` RLS policies call these helper functions, Postgres rejects the profile query and the app signs the user out.

## Changes to make

1. Add a Supabase migration to restore safe execute permissions for RLS helper functions
   - Grant `authenticated` execute access to helper functions used by authenticated RLS policies.
   - Keep these functions as `SECURITY DEFINER` with pinned `search_path`.
   - Keep anonymous access restricted unless needed for a public-facing policy.

2. Validate the login path
   - Confirm the helper functions can be executed by authenticated users.
   - Confirm the user's own `users` row can be read under RLS.
   - Confirm login no longer signs out after profile fetch.

## Expected result

After the migration is approved and applied, login should complete normally and authenticated pages like `/dashboard` and `/admin` should load instead of returning to `/login`.
