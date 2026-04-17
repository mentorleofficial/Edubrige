

## Changes

**1. OTP back to 6 digits**
- `MentorApplicationDialog.tsx` line 283: `maxLength={8}` → `maxLength={6}`
- Line 285: slot map `[0..7]` → `[0..5]`
- Line 293: disabled check → `otp.length !== 6`

Note: Supabase is sending 8-digit codes because the project's auth config has `otp_length=8`. To truly enforce 6, the auth config needs `otp_length: 6` in `supabase/config.toml` (`[auth.email] otp_length = 6`). I'll update that too so emails match the UI.

**2. Phone field accepting alphabets**
- Add `onInput` handler that strips any character not in `[0-9+\-\s().]` so typing letters does nothing visible.
- Keep existing zod regex as the validation backstop.

**3. Audit other fields for wrong input types**
Reviewed the form:
- `full_name`, `email`, `password`, `bio`, `linkedin/portfolio/twitter/github` — text/email/password/url; correct.
- `years_experience` — already `type="number" min=0 max=60`; correct (browser blocks letters).
- `phone` — the only one that needs the input filter.

No other fields have the issue.

## Files

- `src/components/MentorApplicationDialog.tsx` — OTP slots back to 6, phone input filter
- `supabase/config.toml` — set `otp_length = 6` under `[auth.email]` so the emailed code matches

