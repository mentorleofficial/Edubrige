-- ALR-01 (follow-up): approving a mentor touches five rows (role, user, mentor
-- profile, application, history cleanup). Done as separate calls from the edge
-- function, a failure part-way left a mentor activated while their application
-- still read "pending". This function does the whole approval in one
-- transaction: it either all happens or none of it does.
-- Callable only by the service role (the approve-mentor-application function),
-- which has already verified the caller is an admin.
CREATE OR REPLACE FUNCTION public.approve_mentor_application_tx(
  _application_id uuid,
  _admin_id uuid,
  _admin_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app public.mentor_applications%ROWTYPE;
  v_email text;
  v_user_id uuid;
  v_slug text;
BEGIN
  SELECT * INTO v_app FROM public.mentor_applications WHERE id = _application_id FOR UPDATE;
  IF v_app.id IS NULL THEN
    RAISE EXCEPTION 'Application not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_app.status IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Application already reviewed with status: %', v_app.status USING ERRCODE = 'P0001';
  END IF;

  -- Auth stores addresses lower-cased; the application keeps what was typed.
  v_email := lower(btrim(v_app.email));
  SELECT id INTO v_user_id FROM public.users WHERE lower(email) = v_email LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user account found for this email. Applicant may not have completed signup.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'mentor')
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.users SET role = 'mentor', full_name = v_app.full_name WHERE id = v_user_id;

  v_slug := public.generate_mentor_slug(v_app.full_name, v_user_id);

  INSERT INTO public.mentor_profiles (
    user_id, bio, expertise, years_experience, linkedin_url, portfolio_url, phone,
    resume_url, is_active, approval_acknowledged_at, slug,
    current_organization, "current_role", professional_status
  ) VALUES (
    v_user_id, v_app.bio, v_app.expertise, v_app.years_experience,
    COALESCE(v_app.linkedin_url, ''), COALESCE(v_app.portfolio_url, ''), COALESCE(v_app.phone, ''),
    COALESCE(v_app.resume_url, ''), true, NULL, v_slug,
    COALESCE(v_app.current_organization, ''), COALESCE(v_app."current_role", ''), COALESCE(v_app.professional_status, '')
  )
  ON CONFLICT (user_id) DO UPDATE SET
    bio = EXCLUDED.bio,
    expertise = EXCLUDED.expertise,
    years_experience = EXCLUDED.years_experience,
    linkedin_url = EXCLUDED.linkedin_url,
    portfolio_url = EXCLUDED.portfolio_url,
    phone = EXCLUDED.phone,
    resume_url = EXCLUDED.resume_url,
    is_active = true,
    approval_acknowledged_at = NULL,
    slug = EXCLUDED.slug,
    current_organization = EXCLUDED.current_organization,
    "current_role" = EXCLUDED."current_role",
    professional_status = EXCLUDED.professional_status;

  UPDATE public.mentor_applications
     SET status = 'approved',
         admin_notes = _admin_notes,
         reviewed_by = _admin_id,
         reviewed_at = now()
   WHERE id = _application_id;

  -- Remove this applicant's older applications (e.g. earlier rejections).
  DELETE FROM public.mentor_applications
   WHERE lower(email) = v_email AND id <> _application_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (_admin_id, 'approve_mentor_application', 'mentor_applications', _application_id::text,
          jsonb_build_object('mentor_user_id', v_user_id, 'email', v_app.email));

  INSERT INTO public.outbound_events (event_type, payload)
  VALUES ('mentor.approved', jsonb_build_object(
    'mentor_user_id', v_user_id, 'email', v_app.email, 'full_name', v_app.full_name, 'slug', v_slug));

  RETURN jsonb_build_object('mentor_user_id', v_user_id, 'slug', v_slug);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_mentor_application_tx(uuid, uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_mentor_application_tx(uuid, uuid, text) TO service_role;
