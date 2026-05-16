# Remaining Features Plan — Mentorle × EduBridge

Scope: deliver the gaps between the current build and the integration spec. Grouped by priority so we can ship in safe waves.

---

## Wave 1 — Session Core Gaps (Mentor + Mentee)

Goal: complete the session workflow that mentors/mentees touch every day.

### 1.1 Session Title & Topic
- Add `title` (text) and `topic` (text) to `sessions`.
- Mentee booking form: required Title, optional Topic.
- Mentor session detail: edit Title/Topic.
- Display on mentor/mentee/admin session lists, calendar tooltips, emails.

### 1.2 Action Items (tasks/follow-ups)
- New table `session_action_items`: `session_id`, `mentor_id`, `mentee_id`, `title`, `description`, `due_date`, `status` (open/done), `completed_at`.
- RLS: mentor of session can CRUD; mentee of session can read + mark done; admin full.
- Mentor session view: "Action Items" panel — add/edit/delete.
- Mentee session view + new "My Tasks" tab on mentee dashboard: list, mark complete.
- Dashboard count widgets ("Open tasks") on both sides.

### 1.3 Session Notes Polish
- `notes` already exists — surface a clean "Mentor Notes" editor (rich text, autosave) on mentor side; read-only render for mentee after session ends.

---

## Wave 2 — Compliance & Privacy (Spec §13)

### 2.1 Consent Management
- New table `user_consents`: `user_id`, `policy_version`, `accepted_at`, `ip_address`, `user_agent`, `withdrawn_at`.
- Privacy notice + consent checkbox in mentee onboarding and mentor application.
- Block app usage until current `policy_version` accepted; banner to re-accept on version bump.
- Admin setting: current privacy policy version + URL.

### 2.2 User Rights Center
- New `/account/privacy` page for all roles:
  - Download my data (JSON export via edge function).
  - Request correction (opens profile edit).
  - Request deletion (creates `data_deletion_requests` row, admin reviews).
  - Withdraw consent (sets `withdrawn_at`, disables account, notifies admin).
- Admin page `AdminPrivacyRequests` to action deletion/withdrawal requests.

### 2.3 Data Retention
- Admin setting: retention windows (sessions, audit logs, inactive users).
- Scheduled edge function `retention-sweep` (daily) anonymises/deletes per policy and writes audit logs.

### 2.4 Audit Log Coverage
- Ensure consent grant/withdraw, deletion request, retention sweep, mentor approval/reject, role changes, branding/JWT updates all hit `audit_logs`.

---

## Wave 3 — Mentor Engagement

### 3.1 Badges (Bronze / Silver / Gold)
- New tables: `badges` (code, name, tier, criteria_json, icon_url) and `mentor_badges` (mentor_id, badge_id, awarded_at).
- Edge function `evaluate-mentor-badges` runs after each completed session + nightly: awards based on completed sessions count, avg rating, mentee count.
- Display badges on mentor dashboard, MentorProfile, and public `PublicMentorProfile`.

### 3.2 Leaderboard
- New view/materialized view `mentor_leaderboard` (mentor_id, completed_sessions_30d, avg_rating_30d, score).
- `/mentor/leaderboard` page (visible to mentors + admins): top mentors, your rank, deltas.
- Admin toggle: leaderboard visibility on/off.

### 3.3 Social Sharing (static)
- Share buttons (LinkedIn, X, copy link) on `PublicMentorProfile` and on badge-award toast/modal.
- Pre-filled share text uses mentor name + tagline.

### 3.4 Mentor Community Link
- Branding/admin setting: `mentor_community_url`.
- Sidebar link "Mentor Community" for mentors when set.

---

## Wave 4 — EduBridge Integration & White-Label

### 4.1 Outbound Data Exchange
- Admin setting: `edubridge_webhook_url` + signing secret.
- Edge function `sync-to-edubridge` posts session lifecycle events (created/completed/cancelled) and feedback aggregates.
- Retry table `outbound_events` with status (pending/sent/failed).

### 4.2 White-Label Audit
- Sweep UI for "Mentorle" strings — replace with branding `app_name`.
- Ensure login/auth screens, emails, meta tags, and favicon honour branding.

### 4.3 Approval Notification Email
- Brevo template + edge function call on `mentor_applications.status` change (approved/rejected/changes_requested).

---

## Wave 5 — Analytics & Reporting

- Admin Analytics page with: sessions scheduled vs completed (line), feedback score distribution, top programs, leaderboard snapshot.
- CSV export per chart.
- Reuse existing dashboard data hooks where possible.

---

## Technical Notes

- All new tables: RLS-on by default, policies modelled on existing `has_role`/`is_program_member` patterns.
- New edge functions: `evaluate-mentor-badges`, `retention-sweep`, `sync-to-edubridge`, `export-user-data`, `mentor-application-decision-email`.
- All time-based validations via triggers (not CHECK constraints).
- Frontend: keep React Query cache-key conventions established in earlier optimisation passes.
- No new third-party deps anticipated except a lightweight rich-text editor for session notes (e.g. `@tiptap/react`) — confirm before adding.

## Out of Scope (per spec §14 Excluded)

- Attendance tracking
- Deep engagement analytics
- Automated social sharing
- Impact measurement metrics

## Suggested Order

Wave 1 → Wave 2 → Wave 3 → Wave 4 → Wave 5. Each wave is independently shippable.
