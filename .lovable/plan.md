

# Bug fixes + OTP verification

## Bug 1 — Wrong full_name stored

**Root cause:** `handle_new_user` trigger reads `raw_user_meta_data->>'full_name'`, but somewhere the role string ("mentor"/"admin") is being passed as full_name. Looking at `MentorApplicationDialog.tsx` line ~96, the signUp call DOES pass `full_name: values.full_name` correctly. So the bug is likely in the older Login/seed admin path, or `users.full_name` is being overwritten with role elsewhere.

**Fix:** 
- Audit `Login.tsx`, AdminUsers admin-create path, and the admin seed flow to ensure `full_name` is the actual person name, not the role.
- Update `handle_new_user` to fall back to email-prefix instead of empty string when full_name missing, never the role.
- One-time data fix migration: for existing rows where `users.full_name` IN ('mentor','admin','mentee'), update from auth metadata if available, else from email prefix.

## Bug 2 — Application form UX + data types

Issues to fix in `MentorApplicationDialog.tsx`:
- **Phone:** currently free-text. Change to `type="tel"` with regex validation (digits, +, spaces, dashes, 7–20 chars). Add country-code-friendly placeholder.
- **Years experience:** `z.coerce.number()` works but the input shows 0 by default — make placeholder empty and require explicit value; clamp 0–60.
- **Expertise tags:** Enter to add is hidden — add an explicit "Add" button next to input. Show helper count "X/10". Prevent duplicates case-insensitively.
- **Resume upload:** show file size, allow remove (X button), display selected filename more prominently, drag-and-drop hint.
- **Password:** add show/hide toggle, strength hint.
- **LinkedIn:** loosen validator (accept linkedin.com/in/... or linkedin.com/pub/...) and trim trailing slash.
- **Form layout:** sticky submit footer on mobile, better section spacing, clearer required-field asterisks, inline validation on blur (not just on submit).
- **Disable submit** while resume uploading; show progress.
- **Reset state** properly when dialog closes mid-flow.

## Bug 3 — Replace confirmation link with OTP

Switch from email-link confirmation to 6-digit OTP verification:

**Flow:**
1. User fills form → submit
2. Upload resume → call `supabase.auth.signUp({ email, password, options: { data: {...} } })` — Supabase sends OTP token (when "Confirm email" is enabled and template uses `{{ .Token }}`)
3. Show OTP entry step inside the dialog (6-digit input using existing `input-otp` component)
4. User enters OTP → `supabase.auth.verifyOtp({ email, token, type: 'signup' })` 
5. On success: insert mentor_application + mentor_profile (deferred until verified, so we don't create orphan rows for unverified emails), then auto sign-in, redirect to `/dashboard`
6. Resend OTP button with 60s cooldown

**Email template work:**
Scaffold Lovable auth email templates so the signup email contains the OTP code (`{{ .Token }}`) instead of a confirmation link. Apply project branding (DM Sans, primary colors from `index.css`). This requires:
- Email domain setup (if not already configured) — show setup dialog
- `scaffold_auth_email_templates` → customizes `signup.tsx` to display the 6-digit token prominently
- Deploy `auth-email-hook`

If email domain is not configured, the OTP will still be sent via the default Supabase email (which includes the token), but it won't be branded.

## Files to edit

- `supabase/migrations/...` — fix `handle_new_user` fallback + one-time data repair
- `src/components/MentorApplicationDialog.tsx` — full UX pass + OTP step
- `src/pages/Login.tsx` — verify name handling on admin/mentor login paths
- `src/pages/AdminUsers.tsx` — verify create-user paths use real name
- Auth email templates (scaffold + brand) — signup template shows OTP

## Order of operations

1. DB migration: fix trigger + repair existing bad names
2. Update application dialog: add OTP step, defer profile inserts until verified
3. Set up branded auth email templates with OTP token
4. Verify end-to-end

