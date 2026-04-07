

# Mentorship Platform — Implementation Plan

## Database Schema (Supabase Migrations)

### Tables:
1. **users** — id (uuid, FK auth.users), email, full_name, role (enum: admin/mentor/mentee), external_id (nullable, for EduBridge), avatar_url, created_at, updated_at
2. **user_roles** — id, user_id (FK auth.users), role (app_role enum) — for RLS security-definer checks
3. **branding** — id, app_name, logo_url, primary_color, secondary_color, accent_color, login_bg_url, updated_at (single-row config)
4. **jwt_config** — id, issuer, audience, public_key, algorithm, enabled, updated_at (single-row config)
5. **mentor_profiles** — id, user_id (FK users), bio, expertise (text[]), years_experience, linkedin_url
6. **mentor_availability** — id, mentor_id (FK users), day_of_week (int), start_time (time), end_time (time), is_recurring (bool)
7. **mentee_profiles** — id, user_id (FK users), goals, interests (text[]), organization_unit
8. **sessions** — id, mentor_id, mentee_id, scheduled_at (timestamptz), duration_minutes, status (enum: booked/completed/cancelled/no_show), notes, created_at
9. **feedback** — id, session_id (FK sessions), submitted_by, rating (1-5), comment, created_at
10. **audit_logs** — id, user_id, action, entity_type, entity_id, details (jsonb), ip_address, created_at

### RLS Policies:
- Admins: full access to all tables
- Mentors: read/write own profile & availability, read assigned sessions, read feedback on own sessions
- Mentees: read mentor profiles & availability, book sessions, submit feedback
- Branding/JWT config: admin-only write, public read for branding
- Security-definer `has_role()` function to prevent RLS recursion

## Edge Functions

1. **edubridge-auth** — Receives redirect callback from EduBridge:
   - Validates JWT (issuer, audience, signature using stored public key from jwt_config)
   - Extracts user details (name, email, external_id)
   - Auto-provisions mentee user if not exists
   - Creates Supabase session, redirects to platform with auth cookie

## Frontend Architecture

### Pages & Routes:
- `/login` — Admin/Mentor email+password login (dynamically branded)
- `/auth/edubridge/callback` — EduBridge redirect landing, calls edge function
- `/dashboard` — Role-based dashboard (Admin/Mentor/Mentee see different views)
- `/admin/users` — User management CRUD
- `/admin/settings` — Branding config + JWT config
- `/admin/audit-logs` — Searchable/filterable audit log viewer
- `/mentors` — Mentor directory with profiles (mentee view)
- `/mentor/profile` — Mentor's own profile editor
- `/mentor/availability` — Calendar availability manager
- `/mentor/sessions` — Mentor's session list
- `/mentee/profile` — Mentee profile editor
- `/mentee/sessions` — Mentee's booked sessions
- `/book/:mentorId` — Session booking flow (pick from available slots)
- `/session/:id/feedback` — Post-session feedback form

### Key Components:
- **BrandingProvider** — Context that loads branding from DB & applies CSS variables dynamically
- **AuthProvider** — Handles login state, role-based redirects, EduBridge JWT flow
- **RoleGuard** — Route protection component based on user role
- **MentorCard** — Displays mentor info, expertise, availability summary
- **AvailabilityCalendar** — Weekly calendar for mentors to set time slots
- **BookingModal** — Slot selection + confirmation for mentees
- **FeedbackForm** — Star rating + text comment
- **AuditLogTable** — Paginated, filterable table with action details

### Branding System:
- Admin uploads logo to Supabase Storage, sets colors and app name
- BrandingProvider fetches config and sets CSS custom properties on `:root`
- Login page uses configurable background image
- All UI components use CSS variables for theming

### Audit Logging:
- Database trigger or edge function middleware logs key actions (user creation, session booking, settings changes, login events)
- Stored with user_id, action type, entity reference, and details

