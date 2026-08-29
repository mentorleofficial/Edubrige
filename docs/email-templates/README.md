# Email templates

Two systems send email from this project.

## 1. Transactional emails (in code)

Sent by edge functions via Brevo. All six share
`supabase/functions/_shared/emailLayout.ts`, which pulls the app name, logo and
colours from the `branding` table at send time — so changing branding in
Admin → Settings updates every email with no redeploy.

Functions: `admin-manage-user`, `mentor-application-submitted-email`,
`mentor-application-decision-email`, `send-booking-email`,
`send-session-reminders`, `send-feedback-request`.

## 2. Supabase Auth emails (NOT in code)

Rendered by Supabase's own mailer from templates stored in the dashboard. The
only one currently reaching users is **Recovery** — the 8-digit verification
code from `resetPasswordForEmail()` on /forgot-password.

To apply `supabase-recovery.html`:

1. Supabase Dashboard → Authentication → Emails → Templates → **Reset Password**
2. Paste the file contents into the message body, save.
3. Also set Authentication → **SMTP Settings** to your own sender. Without this,
   auth mail sends from `noreply@mail.app.supabase.io` no matter what the
   template says, and is rate limited to a few messages per hour.

The logo URL and colours in that file are hardcoded, because Supabase templates
cannot query the database. If branding changes, update this file too.
