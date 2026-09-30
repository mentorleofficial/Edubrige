-- SEC-04 (follow-up): deactivation must take effect immediately, not when the
-- user's access token expires. Banning the auth user stops new logins and token
-- refreshes, but an already-issued access token stays valid for up to an hour and
-- PostgREST only verifies its signature. This pre-request hook runs before every
-- API request and rejects any request made by a deactivated account.
CREATE OR REPLACE FUNCTION public.block_disabled_users()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_disabled) THEN
    RAISE EXCEPTION 'Your account has been deactivated'
      USING ERRCODE = 'P0001', HINT = 'account_deactivated';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.block_disabled_users() FROM public;
GRANT EXECUTE ON FUNCTION public.block_disabled_users() TO anon, authenticated, service_role;

ALTER ROLE authenticator SET pgrst.db_pre_request = 'public.block_disabled_users';
NOTIFY pgrst, 'reload config';
