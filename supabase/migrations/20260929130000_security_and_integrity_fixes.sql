-- =====================================================================
-- Security & integrity hardening (QA audit 2026-09-29)
-- =====================================================================

-- ---------------------------------------------------------------------
-- SEC-01: signup must not let the browser choose a privileged role.
-- The client fully controls raw_user_meta_data on auth.signUp(), so 'admin'
-- coming from there is never trusted. raw_app_meta_data is settable only via
-- the service-role admin API, so it stays authoritative for legitimate admin
-- and mentor creation done by admin-manage-user.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_role text := NEW.raw_user_meta_data->>'role';
  app_role_claim text := NEW.raw_app_meta_data->>'role';
  final_role public.app_role;
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF app_role_claim IN ('admin', 'mentor', 'mentee') THEN
    final_role := app_role_claim::public.app_role;      -- set by service role only
  ELSIF meta_role IN ('mentor', 'mentee') THEN
    final_role := meta_role::public.app_role;           -- self-signup: never 'admin'
  ELSE
    final_role := 'mentee';
  END IF;

  INSERT INTO public.users (id, email, full_name, role)
  VALUES (NEW.id, lower(NEW.email), COALESCE(NEW.raw_user_meta_data->>'full_name', ''), final_role)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, final_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- SEC-02: a mentor (or anyone) must not be able to self-activate.
-- "Mentors manage own profile" is FOR ALL, so without this guard a user can
-- set is_active = true (skipping approval) or forge slug/approval fields.
-- Admins bypass the lock.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_mentor_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- The service role (edge functions like approve-mentor-application, and admin
  -- tooling) legitimately sets is_active/slug, and so do admin users. Only lock
  -- these columns for ordinary authenticated users editing their own row.
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- A self-served profile always starts inactive and unslugged.
    NEW.is_active := false;
    NEW.slug := NULL;
    NEW.approval_acknowledged_at := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Non-admins cannot change approval-controlled columns on their own row.
    -- approval_acknowledged_at is deliberately NOT locked: the mentor sets it
    -- themselves to dismiss the post-approval celebration, and it grants nothing.
    NEW.is_active := OLD.is_active;
    NEW.slug := OLD.slug;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_mentor_profile_privileges ON public.mentor_profiles;
CREATE TRIGGER trg_protect_mentor_profile_privileges
BEFORE INSERT OR UPDATE ON public.mentor_profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_mentor_profile_privileges();

-- Public/booking surfaces must additionally require the user to actually hold
-- the mentor role, so a mentee who forged a mentor_profiles row is never listed
-- or bookable.
CREATE OR REPLACE FUNCTION public.list_public_mentors()
RETURNS TABLE (
  user_id uuid, slug text, full_name text, avatar_url text,
  headline text, bio text, expertise text[], years_experience integer, "current_role" text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT u.id, mp.slug, u.full_name, u.avatar_url,
         mp.headline, mp.bio, mp.expertise, mp.years_experience, mp.current_role
  FROM public.mentor_profiles mp
  JOIN public.users u ON u.id = mp.user_id
  WHERE mp.is_active = true
    AND u.is_disabled = false
    AND public.has_role(u.id, 'mentor');
$$;
REVOKE EXECUTE ON FUNCTION public.list_public_mentors() FROM public;
GRANT EXECUTE ON FUNCTION public.list_public_mentors() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_mentor(_slug_or_id text)
RETURNS TABLE (
  user_id uuid, slug text, full_name text, avatar_url text, headline text, bio text,
  expertise text[], years_experience integer, current_organization text, "current_role" text,
  linkedin_url text, portfolio_url text, qualifications jsonb, experiences jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT u.id, mp.slug, u.full_name, u.avatar_url, mp.headline, mp.bio,
         mp.expertise, mp.years_experience, mp.current_organization, mp.current_role,
         mp.linkedin_url, mp.portfolio_url, mp.qualifications, mp.experiences
  FROM public.mentor_profiles mp
  JOIN public.users u ON u.id = mp.user_id
  WHERE mp.is_active = true
    AND u.is_disabled = false
    AND public.has_role(u.id, 'mentor')
    AND (
      mp.slug = _slug_or_id
      OR (
        _slug_or_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND mp.user_id = _slug_or_id::uuid
      )
    )
  LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.get_public_mentor(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_mentor(text) TO anon, authenticated;

-- ---------------------------------------------------------------------
-- SEC-04: a booked mentee must be an active mentor's counterpart AND not be
-- disabled themselves. Previously the _mentee argument was ignored entirely.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_mentee_book_mentor(_mentee uuid, _mentor uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.mentor_profiles mp
    JOIN public.users um ON um.id = mp.user_id
    JOIN public.users ue ON ue.id = _mentee
    WHERE mp.user_id = _mentor
      AND mp.is_active = true
      AND um.is_disabled = false
      AND ue.is_disabled = false
      AND public.has_role(_mentor, 'mentor')
  );
$$;

-- ---------------------------------------------------------------------
-- SEC-07: enforce the core booking invariants server-side. Availability /
-- notice / buffer remain UI-checked, but a mentee can no longer insert a
-- past-dated session or a session in any status other than 'booked'.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_mentee_session_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.mentee_id = auth.uid() THEN
    IF NEW.status <> 'booked' THEN
      RAISE EXCEPTION 'New bookings must have status booked' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.scheduled_at <= now() THEN
      RAISE EXCEPTION 'Cannot book a session in the past' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_mentee_session_insert ON public.sessions;
CREATE TRIGGER trg_enforce_mentee_session_insert
BEFORE INSERT ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.enforce_mentee_session_insert();

-- ---------------------------------------------------------------------
-- VAL-03: program capacity is now enforced. Adding a mentee beyond capacity
-- raises instead of silently over-enrolling.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_program_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cap integer;
  current_count integer;
BEGIN
  SELECT capacity INTO cap FROM public.programs WHERE id = NEW.program_id;
  IF cap IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO current_count FROM public.program_mentees WHERE program_id = NEW.program_id;
  IF current_count >= cap THEN
    RAISE EXCEPTION 'Program is at capacity (% of %)', current_count, cap USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_program_capacity ON public.program_mentees;
CREATE TRIGGER trg_enforce_program_capacity
BEFORE INSERT ON public.program_mentees
FOR EACH ROW EXECUTE FUNCTION public.enforce_program_capacity();

-- ---------------------------------------------------------------------
-- FUN-04: atomic program deletion. Children go with the parent in one tx so a
-- half-deleted program with its members stripped can never be left behind.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_program(_program_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can delete programs' USING ERRCODE = 'insufficient_privilege';
  END IF;
  DELETE FROM public.mentor_mentee_assignments WHERE program_id = _program_id;
  DELETE FROM public.program_mentors WHERE program_id = _program_id;
  DELETE FROM public.program_mentees WHERE program_id = _program_id;
  DELETE FROM public.program_tags WHERE program_id = _program_id;
  DELETE FROM public.programs WHERE id = _program_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.delete_program(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_program(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- ALR-06: the SSO callback and logout redirect need a few non-secret jwt_config
-- fields, but the table is admin-only. Expose just those fields via a definer
-- RPC so an anonymous visitor can start the SSO flow.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_jwt_login_config()
RETURNS TABLE (
  enabled boolean,
  token_param_name text,
  login_redirect_url text,
  logout_redirect_url text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT enabled, token_param_name, login_redirect_url, logout_redirect_url
  FROM public.jwt_config
  LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.get_jwt_login_config() FROM public;
GRANT EXECUTE ON FUNCTION public.get_jwt_login_config() TO anon, authenticated;

-- ---------------------------------------------------------------------
-- ALR-07 / ALR-08: reschedule atomically. The old session is cancelled and the
-- new one inserted in a single transaction, so a failure can never leave a
-- duplicate, and rescheduling into the moved session's own slot no longer trips
-- the overlap guard. The "reschedule only once" rule is enforced here, not just
-- in the UI. Runs as the caller (SECURITY INVOKER) so RLS still applies.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reschedule_session(
  _old_session_id uuid,
  _mentor_id uuid,
  _scheduled_at timestamptz,
  _duration integer,
  _notes text,
  _title text,
  _topic text,
  _offering_id uuid,
  _program_id uuid
)
RETURNS TABLE (session_id uuid, meeting_url text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_mentee uuid := auth.uid();
  v_url text := 'https://meet.jit.si/mentorle-' || gen_random_uuid();
  v_old public.sessions%ROWTYPE;
  v_new_id uuid;
BEGIN
  SELECT * INTO v_old FROM public.sessions WHERE id = _old_session_id;
  IF v_old.id IS NULL THEN
    RAISE EXCEPTION 'Original session not found';
  END IF;
  IF v_old.mentee_id <> v_mentee THEN
    RAISE EXCEPTION 'You can only reschedule your own session';
  END IF;
  IF v_old.rescheduled_from_id IS NOT NULL THEN
    RAISE EXCEPTION 'This session has already been rescheduled once';
  END IF;

  UPDATE public.sessions
     SET status = 'cancelled', cancelled_by = v_mentee, cancelled_at = now(), cancellation_reason = 'Rescheduled'
   WHERE id = _old_session_id;

  INSERT INTO public.sessions (
    mentor_id, mentee_id, scheduled_at, duration_minutes, mentee_notes,
    title, topic, meeting_url, offering_id, program_id, rescheduled_from_id, status
  ) VALUES (
    _mentor_id, v_mentee, _scheduled_at, _duration, COALESCE(_notes, ''),
    _title, COALESCE(_topic, ''), v_url, _offering_id, _program_id, _old_session_id, 'booked'
  )
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT v_new_id, v_url;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reschedule_session(uuid, uuid, timestamptz, integer, text, text, text, uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reschedule_session(uuid, uuid, timestamptz, integer, text, text, text, uuid, uuid) TO authenticated;
