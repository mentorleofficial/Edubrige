-- =====================================================================
-- Second audit fixes (2026-09-30). IDs match the verification report.
-- =====================================================================

-- ---------------------------------------------------------------------
-- N8: a user must not be able to change the email on their own profile row.
-- Mentor approval and account lookups match on this column, so pointing it at
-- someone else's address could redirect another applicant's approval.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_self_privilege_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins (acting on anyone) and the service role bypass these locks
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Non-admins editing their own row cannot change privileged columns
  IF auth.uid() = NEW.id THEN
    NEW.role         := OLD.role;
    NEW.is_disabled  := OLD.is_disabled;
    NEW.disabled_at  := OLD.disabled_at;
    NEW.disabled_by  := OLD.disabled_by;
    NEW.external_id  := OLD.external_id;
    NEW.email        := OLD.email;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- N4: applicants may only resubmit their own application (from "changes
-- requested" or "invited" back to "pending"); review fields are admin-only.
-- New applications also respect the rejection cooldown server-side, and a
-- second pending application for the same email is refused.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_applicant_application_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cooldown integer;
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status NOT IN ('changes_requested', 'invited') THEN
      RAISE EXCEPTION 'This application is under review and can no longer be edited'
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'pending' THEN
      RAISE EXCEPTION 'Applicants can only resubmit an application for review'
        USING ERRCODE = 'check_violation';
    END IF;
    NEW.email            := OLD.email;
    NEW.admin_notes      := OLD.admin_notes;
    NEW.reviewed_by      := OLD.reviewed_by;
    NEW.reviewed_at      := OLD.reviewed_at;
    NEW.rejection_reason := OLD.rejection_reason;
    -- Resubmitting clears the feedback; applicants can't write their own.
    IF NEW.changes_feedback IS NOT NULL THEN
      NEW.changes_feedback := OLD.changes_feedback;
    END IF;
    RETURN NEW;
  END IF;

  -- INSERT
  SELECT COALESCE(rejection_cooldown_days, 30) INTO cooldown FROM public.branding LIMIT 1;
  cooldown := COALESCE(cooldown, 30);
  IF cooldown > 0 AND EXISTS (
    SELECT 1 FROM public.mentor_applications a
    WHERE lower(a.email) = lower(NEW.email)
      AND a.status = 'rejected'
      AND a.reviewed_at > now() - make_interval(days => cooldown)
  ) THEN
    RAISE EXCEPTION 'You can reapply once the % day cooldown after your last rejection has passed', cooldown
      USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.mentor_applications a
    WHERE lower(a.email) = lower(NEW.email) AND a.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'You already have an application waiting for review'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_applicant_application_changes ON public.mentor_applications;
CREATE TRIGGER trg_guard_applicant_application_changes
BEFORE INSERT OR UPDATE ON public.mentor_applications
FOR EACH ROW EXECUTE FUNCTION public.guard_applicant_application_changes();

-- ---------------------------------------------------------------------
-- N1: feedback only on sessions that actually happened (status completed).
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Mentors submit mentee feedback" ON public.feedback;
CREATE POLICY "Mentors submit mentee feedback" ON public.feedback
FOR INSERT TO authenticated
WITH CHECK (
  submitted_by = auth.uid()
  AND audience IN ('mentee'::feedback_audience, 'admin_private'::feedback_audience)
  AND EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = feedback.session_id AND s.mentor_id = auth.uid() AND s.status = 'completed'
  )
);

DROP POLICY IF EXISTS "Mentees submit mentor feedback" ON public.feedback;
CREATE POLICY "Mentees submit mentor feedback" ON public.feedback
FOR INSERT TO authenticated
WITH CHECK (
  submitted_by = auth.uid()
  AND audience = 'mentor'::feedback_audience
  AND EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = feedback.session_id AND s.mentee_id = auth.uid() AND s.status = 'completed'
  )
);

-- ---------------------------------------------------------------------
-- N5: mentors can't reassign a session to someone else, move it in time, or
-- mark it completed / no-show before it has started. Mentees can't change a
-- session's participants or time either (they may only cancel it).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_session_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.mentee_id IS DISTINCT FROM OLD.mentee_id
     OR NEW.mentor_id IS DISTINCT FROM OLD.mentor_id
     OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
     OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes THEN
    RAISE EXCEPTION 'A session''s participants and time can''t be changed here'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status IN ('completed', 'no_show')
     AND NEW.status IS DISTINCT FROM OLD.status
     AND OLD.scheduled_at > now() THEN
    RAISE EXCEPTION 'A session can only be marked completed or no-show after it has started'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_session_updates ON public.sessions;
CREATE TRIGGER trg_guard_session_updates
BEFORE UPDATE ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.guard_session_updates();

-- ---------------------------------------------------------------------
-- N2: event registration respects capacity, the registration deadline and the
-- event start, enforced in the database (the event row is locked so two people
-- can't take the last seat at once).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_event_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev public.events_programs%ROWTYPE;
  taken integer;
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO ev FROM public.events_programs WHERE id = NEW.event_id FOR UPDATE;
  IF ev.id IS NULL THEN
    RAISE EXCEPTION 'Event not found' USING ERRCODE = 'check_violation';
  END IF;
  IF ev.start_date IS NOT NULL AND ev.start_date <= now() THEN
    RAISE EXCEPTION 'This event has already started' USING ERRCODE = 'check_violation';
  END IF;
  IF ev.registration_deadline IS NOT NULL AND ev.registration_deadline < now() THEN
    RAISE EXCEPTION 'Registration for this event has closed' USING ERRCODE = 'check_violation';
  END IF;
  IF ev.max_participants IS NOT NULL THEN
    SELECT count(*) INTO taken FROM public.event_participants WHERE event_id = NEW.event_id;
    IF taken >= ev.max_participants THEN
      RAISE EXCEPTION 'This event is full. Registration is no longer available.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_event_registration ON public.event_participants;
CREATE TRIGGER trg_enforce_event_registration
BEFORE INSERT ON public.event_participants
FOR EACH ROW EXECUTE FUNCTION public.enforce_event_registration();

-- ---------------------------------------------------------------------
-- N3: only mentors (or admins) can create/edit mentorship offerings, and the
-- public listing only shows offerings from active, real mentors.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Mentors manage own offerings" ON public.mentorship_offerings;
CREATE POLICY "Mentors manage own offerings" ON public.mentorship_offerings
FOR ALL TO authenticated
USING ((mentor_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (
  (mentor_id = auth.uid() AND public.has_role(auth.uid(), 'mentor'::app_role))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE OR REPLACE FUNCTION public.list_public_offerings()
RETURNS TABLE(id uuid, title text, description text, duration_minutes integer, price numeric, category text, status text, mentor_id uuid, mentor_full_name text, mentor_avatar_url text, mentor_current_role text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.title, o.description, o.duration_minutes, o.price, o.category, o.status,
         o.mentor_id, u.full_name, u.avatar_url, mp."current_role"
  FROM public.mentorship_offerings o
  JOIN public.users u ON u.id = o.mentor_id
  JOIN public.mentor_profiles mp ON mp.user_id = o.mentor_id
  WHERE o.status = 'active'
    AND COALESCE(u.is_disabled, false) = false
    AND mp.is_active = true
    AND public.has_role(o.mentor_id, 'mentor')
  ORDER BY o.created_at DESC;
$$;
REVOKE EXECUTE ON FUNCTION public.list_public_offerings() FROM public;
GRANT EXECUTE ON FUNCTION public.list_public_offerings() TO anon, authenticated;

-- ---------------------------------------------------------------------
-- S1: session attachments are private. Readable only by the session's mentor
-- and mentee (the first path segment is the session id) and admins.
-- ---------------------------------------------------------------------
UPDATE storage.buckets
   SET public = false, file_size_limit = 10485760
 WHERE id = 'session-attachments';

DROP POLICY IF EXISTS "Session attachments public read" ON storage.objects;
DROP POLICY IF EXISTS "Session participants read attachments" ON storage.objects;
CREATE POLICY "Session participants read attachments" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'session-attachments'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE (storage.foldername(objects.name))[1] ~ '^[0-9a-f-]{36}$'
        AND s.id = ((storage.foldername(objects.name))[1])::uuid
        AND (s.mentor_id = auth.uid() OR s.mentee_id = auth.uid())
    )
  )
);

-- ---------------------------------------------------------------------
-- S2: mentee resumes are private. Readable by the mentee, admins, and mentors
-- who have a session with the mentee or share a program with them.
-- ---------------------------------------------------------------------
UPDATE storage.buckets SET public = false WHERE id = 'mentee-resumes';

DROP POLICY IF EXISTS "mentee_resume_read" ON storage.objects;
CREATE POLICY "mentee_resume_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'mentee-resumes'
  AND (storage.foldername(name))[1] = 'resumes'
  AND (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$'
  AND (
    (storage.foldername(name))[2] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.mentor_id = auth.uid()
        AND s.mentee_id = ((storage.foldername(objects.name))[2])::uuid
    )
    OR EXISTS (
      SELECT 1 FROM public.program_mentors pm
      JOIN public.program_mentees pe ON pe.program_id = pm.program_id
      WHERE pm.mentor_id = auth.uid()
        AND pe.mentee_id = ((storage.foldername(objects.name))[2])::uuid
    )
  )
);

-- ---------------------------------------------------------------------
-- S3: application resumes (uploadable before signup) are limited to PDF/Word
-- documents of at most 5 MB.
-- ---------------------------------------------------------------------
UPDATE storage.buckets
   SET file_size_limit = 5242880,
       allowed_mime_types = ARRAY[
         'application/pdf',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
       ]
 WHERE id = 'mentor-resumes';

-- ---------------------------------------------------------------------
-- S5: a mentor can only upload/replace/delete banners for events they created
-- (banner file names start with the event id). Images only, 5 MB max.
-- ---------------------------------------------------------------------
UPDATE storage.buckets
   SET file_size_limit = 5242880,
       allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
 WHERE id = 'event-banners';

DROP POLICY IF EXISTS "Mentors and admins can upload event banners" ON storage.objects;
DROP POLICY IF EXISTS "Mentors and admins can update event banners" ON storage.objects;
DROP POLICY IF EXISTS "Mentors and admins can delete event banners" ON storage.objects;

CREATE POLICY "Event owners and admins upload banners" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'event-banners'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.events_programs e
      WHERE e.created_by = auth.uid() AND objects.name LIKE e.id::text || '-%'
    )
  )
);

CREATE POLICY "Event owners and admins update banners" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'event-banners'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.events_programs e
      WHERE e.created_by = auth.uid() AND objects.name LIKE e.id::text || '-%'
    )
  )
);

CREATE POLICY "Event owners and admins delete banners" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'event-banners'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.events_programs e
      WHERE e.created_by = auth.uid() AND objects.name LIKE e.id::text || '-%'
    )
  )
);

-- ---------------------------------------------------------------------
-- U5: profile photos must be ordinary images (JPEG/PNG/WebP).
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users upload their own avatar" ON storage.objects;
CREATE POLICY "Users upload their own avatar" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'branding-assets'
  AND (storage.foldername(name))[1] = 'avatars'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND lower(name) ~ '\.(jpe?g|png|webp)$'
);
