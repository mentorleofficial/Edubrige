

# Keep users signed in — local sessions + external JWT SSO

Two related problems to fix:

1. **Local (admin/mentor) sessions** persist via `localStorage` already, but a brief loading flicker on every refresh re-runs profile fetches and can bounce users to `/login` if the guard renders before `getSession()` resolves. We'll harden this.
2. **External JWT (mentee SSO)** has admin config + a test panel, but **no actual callback handler exists**. Mentees coming from EduBridge with a token in the URL have nothing to receive it, so they re-authenticate every visit. We'll build the callback + a real Supabase session so they stay logged in like any other user.

---

## 1. Harden local session persistence

**`src/integrations/supabase/client.ts`**
- Already correct: `storage: localStorage`, `persistSession: true`, `autoRefreshToken: true`. Add `detectSessionInUrl: true` (needed for the JWT callback below) and `flowType: 'pkce'` for safer refresh.

**`src/contexts/AuthContext.tsx`**
- Cache the last known `profile` in `localStorage` under `app:lastProfile` so the first paint after refresh is instant (no flicker, no guard bounce). Replace it on every successful `fetchProfile`.
- Initialize `loading` based on whether a session exists in storage (`supabase.auth.getSession()` is sync-readable from storage); only show the spinner if there is genuinely no cached session.
- Keep the existing `onAuthStateChange` + `getSession()` pattern (the order is already correct).

**`src/components/RoleGuard.tsx`**
- While `loading` is true but a cached profile exists, render children optimistically instead of the spinner. Prevents the "logged in but kicked to /login on refresh" feel.

---

## 2. External JWT — real callback + persistent session

Today the admin sees a "Callback URL" (`<origin>/auth/jwt/callback`) but the route doesn't exist. We'll:

### a. New route `/auth/jwt/callback` → `src/pages/JwtCallback.tsx`
- Reads the JWT from the URL using the configured `token_param_name` (query OR hash).
- Calls a new edge function `jwt-exchange` to validate the external token and return a Supabase session for the mapped user.
- Calls `supabase.auth.setSession({ access_token, refresh_token })` so the session is stored in `localStorage` exactly like a normal login → autoRefreshToken keeps it alive indefinitely.
- Redirects to the originally requested page (`?next=` param) or `/dashboard`.
- Shows a clean "Signing you in…" state with branded logo.

### b. New edge function `supabase/functions/jwt-exchange/index.ts`
Public endpoint (no caller auth — the external JWT IS the auth).
- Loads `jwt_config`; rejects if `enabled = false`.
- Verifies the external JWT signature (JWKS URL or static PEM), `iss`, `aud`, `exp` with `allowed_clock_skew_seconds`.
- Maps claims → `email`, `full_name`, `external_id`, `role` per `claim_*` config.
- Looks up user by `external_id` (and email fallback). If not found and `auto_provision = true`, creates the auth user + `public.users` row + `user_roles` row with `default_role` (or claimed role).
- Issues a Supabase session for that user using the service role admin API (`admin.generateLink` of type `magiclink` then exchange, OR `admin.createUser` + sign-in token — pick the standard pattern: `admin.generateLink({ type: 'magiclink' })` and parse the action_link's hash tokens).
- Returns `{ access_token, refresh_token, expires_at, user_id }`.
- Logs to `audit_logs` (`jwt_login_success` / `jwt_login_failure`).

### c. Schema
Add a column to `public.users`:
- `external_id text unique` — for lookups when SSO user comes back.
Migration also adds an index on it.

### d. Skip re-auth on subsequent visits
Because `setSession()` writes to `localStorage` and `autoRefreshToken` is on, **the user stays signed in across page reloads, tabs, and days** until the refresh token expires (Supabase default: 30 days, sliding). No re-prompt to EduBridge needed.

### e. Auto-redirect when session is fresh
On `/login` and `/become-a-mentor`, if `useAuth().session` already exists, redirect to `/dashboard` immediately — prevents the "I'm already logged in why am I seeing the login page" issue.

### f. Logout
`signOut()` already clears localStorage. After signOut, if `jwt_config.logout_redirect_url` is set, redirect there so the IdP session is also ended.

---

## 3. Files

- **Modified**: `src/integrations/supabase/client.ts`, `src/contexts/AuthContext.tsx`, `src/components/RoleGuard.tsx`, `src/App.tsx` (add `/auth/jwt/callback` route), `src/pages/Login.tsx` (auto-redirect if session), `src/pages/MentorLanding.tsx` (auto-redirect if session)
- **New**: `src/pages/JwtCallback.tsx`, `supabase/functions/jwt-exchange/index.ts`
- **Migration**: add `external_id` column + index on `public.users`

## Out of scope
- Changing Supabase refresh-token lifetime (default 30 days is fine; tweak in Supabase Auth dashboard if longer needed).
- Sentry / observability (covered by earlier checklist).
- Wiring claim-mapping changes into local email logins (only relevant to JWT SSO).

