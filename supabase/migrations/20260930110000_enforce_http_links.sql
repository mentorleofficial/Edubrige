-- SEC-06 (follow-up): links a mentor controls are rendered as clickable links to
-- mentees and admins, so only http(s) URLs may be stored. Enforced in the database
-- because the UI checks can be bypassed by writing through the API directly.
-- NOT VALID: new and updated rows are checked; any pre-existing bad rows are left
-- for review rather than blocking this migration.
ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_meeting_url_http;
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_meeting_url_http
  CHECK (meeting_url IS NULL OR meeting_url = '' OR meeting_url ~* '^https?://[^[:space:]]+$') NOT VALID;

ALTER TABLE public.events_programs
  DROP CONSTRAINT IF EXISTS events_programs_links_http;
ALTER TABLE public.events_programs
  ADD CONSTRAINT events_programs_links_http
  CHECK (
    (meeting_link IS NULL OR meeting_link = '' OR meeting_link ~* '^https?://[^[:space:]]+$')
    AND (registration_link IS NULL OR registration_link = '' OR registration_link ~* '^https?://[^[:space:]]+$')
    AND (speaker_image IS NULL OR speaker_image = '' OR speaker_image ~* '^https?://[^[:space:]]+$')
    AND (speaker_linkedin IS NULL OR speaker_linkedin = '' OR speaker_linkedin ~* '^https?://[^[:space:]]+$')
    AND (speaker_github IS NULL OR speaker_github = '' OR speaker_github ~* '^https?://[^[:space:]]+$')
  ) NOT VALID;
