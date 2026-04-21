
# Improve `/admin/settings` — Branding & JWT

Make Branding visually approachable (no HSL strings, live preview, logo upload, login background) and make JWT comprehensive enough to actually validate and map an external JWT to a user.

---

## 1. Branding tab — UX overhaul

Goal: an admin who doesn't know what HSL is can still set up the brand in under a minute.

**Identity section**
- App name (text)
- Logo upload (image picker → uploads to a new public `branding-assets` bucket → stores public URL in `branding.logo_url`)
- Live preview chip showing the logo + app name as it will appear in the sidebar

**Colors section** — replace raw HSL inputs with native color pickers
- Primary, Secondary, Accent rendered as a row of three swatch tiles
- Each tile = `<input type="color">` + readable hex shown below + small "advanced" toggle to paste an HSL string for power users
- Internally convert hex ⇄ HSL on the fly so DB storage stays `H S% L%` (no schema change)
- "Reset to defaults" button per color
- Preset palette row (4 ready-made themes: Default, Ocean, Forest, Sunset) — one click applies all three colors

**Login background section**
- Image upload → stored in same `branding-assets` bucket → URL written to `branding.login_bg_url`
- Preview thumbnail with "Remove" button

**Live preview panel** (right side on desktop, stacked on mobile)
- A mini mock card showing: header with logo + app name, primary button, secondary button, accent badge, sample text — all driven by the unsaved values in real time so admin sees changes before saving
- Applied to CSS vars on `Save` (existing behavior kept)

**Layout**
- Two-column on `md+`: left = controls, right = sticky live preview
- Save bar pinned at the bottom of the card with `Save changes` + `Discard` (disabled when no changes)

---

## 2. JWT tab — complete SSO config

Goal: cover everything needed to validate an external JWT and map its claims to a Lovable user.

Current fields kept: `enabled`, `issuer`, `audience`, `algorithm`, `public_key`.

**New fields added** (requires a small migration on `jwt_config`):
- `jwks_url` (text) — alternative to pasting a public key; if set, keys are fetched & cached from issuer's JWKS endpoint
- `login_redirect_url` (text) — URL on the external IdP where unauthenticated users are sent
- `logout_redirect_url` (text) — where to send users after logout
- `token_param_name` (text, default `token`) — query/hash param to read the JWT from on callback
- `claim_email` (text, default `email`) — which claim holds the email
- `claim_full_name` (text, default `name`)
- `claim_user_id` (text, default `sub`) — used as `external_id`
- `claim_role` (text, default `role`) — optional, used to assign role on provisioning
- `default_role` (USER-DEFINED app_role, default `mentee`) — fallback when no role claim
- `auto_provision` (boolean, default `true`) — create user if not found
- `allowed_clock_skew_seconds` (int, default 30)

**UI structure** — sectioned form (collapsible groups):

1. **Status** — Enable SSO toggle + a status pill ("Active / Disabled / Misconfigured") computed from required fields
2. **Identity provider** — Issuer, Audience, Algorithm (Select: RS256 / RS384 / ES256 / HS256)
3. **Signing keys** — Tabs: "JWKS URL" (recommended) or "Static public key (PEM)". Only one is required.
4. **Redirect URLs** — Login redirect, Logout redirect, plus a read-only "Callback URL" field showing the app's callback (`<origin>/auth/jwt/callback`) with a copy button so admin can paste it into EduBridge
5. **Claim mapping** — fields above with inline help ("Which JWT claim contains the user's email?")
6. **Provisioning** — auto-provision toggle, default role select, clock skew
7. **Test panel** — textarea to paste a sample JWT + "Validate" button that calls a new edge function `validate-jwt-config` which: decodes header/payload, verifies signature against current config, checks issuer/audience/exp, returns mapped claims preview. Result rendered as a green/red panel with the extracted user fields.

Save bar pinned at bottom (same pattern as Branding).

---

## 3. Backend changes

**Migration**
- Add new columns to `public.jwt_config` (all nullable / sane defaults so existing row keeps working)
- Create public storage bucket `branding-assets` with RLS: anyone read; only admins (`has_role(auth.uid(),'admin')`) insert/update/delete

**New edge function `validate-jwt-config`** (admin-only, JWT-verified caller)
- Input: `{ token: string }`
- Loads current `jwt_config`, verifies the supplied token using either the JWKS URL or the stored PEM, checks issuer/audience/exp with clock skew
- Returns `{ ok, errors[], header, payload, mapped: { email, full_name, external_id, role } }`
- Pure validation — does not create a session

No changes needed to existing mentee JWT login flow logic in this task; this just makes config richer & testable.

---

## 4. Files

- `src/pages/AdminSettings.tsx` — full rewrite into two tab components, two-column layouts, save bars
- `src/components/admin/BrandingSettings.tsx` (new) — color pickers, logo/bg uploaders, live preview, presets, hex⇄HSL helpers
- `src/components/admin/JwtSettings.tsx` (new) — sectioned form, callback URL display, test panel
- `src/lib/color.ts` (new) — `hexToHsl`, `hslToHex` utilities
- `supabase/functions/validate-jwt-config/index.ts` (new)
- `supabase/migrations/<timestamp>_jwt_config_extend_and_branding_bucket.sql` (new)

## Out of scope
- Wiring the new claim-mapping fields into the actual mentee login callback (current flow continues to work; can be a follow-up)
- Changing how branding values are stored (still HSL strings in DB)
