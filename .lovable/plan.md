
Switch the mentor application OTP UI back to 8 digits to match what Supabase is actually sending.

## Changes

**`src/components/MentorApplicationDialog.tsx`**
- `<InputOTP maxLength={6}>` → `maxLength={8}`
- Slot map `[0,1,2,3,4,5]` → `[0,1,2,3,4,5,6,7]`
- Verify button: `disabled={otp.length !== 6 || verifying}` → `otp.length !== 8`
- Update any "6-digit" copy to "8-digit" (or generic "verification code")

**`supabase/config.toml`**
- `[auth.email] otp_length = 6` → `otp_length = 8` so repo config matches the live behavior

No other files need changes. OTP UI will render 8 slots and accept the 8-digit code from email.
