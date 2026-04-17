

# Mentor Application Flow (Updated)

## Database Changes

**New enum:** `application_status` (pending/approved/rejected)

**New table: `mentor_applications`**
- id, full_name, email, phone
- linkedin_url, portfolio_url, social_links (jsonb)
- bio, expertise (text[]), years_experience
- resume_url, status, admin_notes
- reviewed_by, reviewed_at, created_at, updated_at

**Update `mentor_profiles`:** add `is_active boolean default false` column. Approved mentors get a profile row with `is_active=true`. Self-registered mentors (if any path remains) default to `false`.

**Update `users`:** add `is_active boolean default true` column. Newly approved mentor accounts start with `is_active=false` until admin activates them OR set `true` on approval but keep `mentor_profiles.is_active=false` as the gating flag — we'll use `mentor_profiles.is_active` as the source of truth for mentor activation.

**Decision:** Use `mentor_profiles.is_active` only (avoids dual-flag confusion). Default `false`. Admin "approve application" creates the account + profile with `is_active=false`. Admin can flip to active from a separate action or it auto-activates on first login confirmation.

**RLS for mentor_applications:**
- INSERT: anon + authenticated (public form)
- SELECT/UPDATE/DELETE: admins only

**Storage bucket: `mentor-resumes`** (private)
- INSERT: anyone
- SELECT: admins only

## Inactive Mentor Behavior

- Mentor can log in normally
- AuthContext loads `mentor_profiles.is_active`
- If role=mentor and `is_active=false`:
  - Sidebar shows limited items (Dashboard + Profile only)
  - Dashboard shows "Account Pending Activation" banner explaining limited access
  - `/mentor/availability` and `/mentor/sessions` redirect to dashboard with toast
  - Mentee directory query filters out mentors where `is_active=false`
  - Booking page blocks attempts on inactive mentors
- Admin gets a toggle in `/admin/users` and `/admin/applications` detail to activate/deactivate

## Pages & Routes

1. **`/become-a-mentor`** (public) — hero, benefits, how-it-works, Apply Now button, FAQ
2. **MentorApplicationDialog** — multi-section zod form + resume upload to `mentor-resumes`
3. **`/admin/applications`** — tabs (Pending/Approved/Rejected/All), table, detail dialog with approve/reject + notes + resume link
4. Login page footer: "Want to mentor? Apply here"

## Edge Function

**`approve-mentor-application`** (verify_jwt=true)
- Verify caller is admin
- Service role: `admin.inviteUserByEmail` with metadata `{ role: 'mentor', full_name }`
- Insert `mentor_profiles` row with bio/expertise/linkedin/years_experience and `is_active=false`
- Update application: status=approved, reviewed_by, reviewed_at

Reject is a direct DB update from client (admin RLS allows it).

## Navigation

- Public link from `/login` footer → `/become-a-mentor`
- Admin sidebar: add "Applications" item with pending count badge
- Mentor sidebar: conditional rendering based on `is_active`

## Components

- `MentorLanding.tsx`, `MentorApplicationDialog.tsx`
- `AdminApplications.tsx`, `ApplicationDetailDialog.tsx`
- `InactiveMentorBanner.tsx` — shown on mentor dashboard when not active
- Update `AuthContext` to expose `mentorActive: boolean`
- Update `AppSidebar` and `RoleGuard` (new optional `requireActiveMentor` prop)

## Validation

Zod: email format, URL validation, bio ≥50 chars, expertise ≥1 tag, resume required (PDF/DOC ≤5MB).

