-- Bulk CSV invitations: batch header + per-row outcome.
-- Row history doubles as the counter for the daily invite cap, so it must not
-- be pruned the way audit_logs can be.

CREATE TABLE IF NOT EXISTS public.invite_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  filename text,
  total_rows integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invite_batch_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.invite_batches(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role public.app_role NOT NULL,
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'skipped_duplicate')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Daily cap counts sent rows since IST midnight; this is the hot path.
CREATE INDEX IF NOT EXISTS invite_batch_rows_sent_at_idx
  ON public.invite_batch_rows (created_at)
  WHERE status = 'sent';

CREATE INDEX IF NOT EXISTS invite_batch_rows_batch_id_idx
  ON public.invite_batch_rows (batch_id);

ALTER TABLE public.invite_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_batch_rows ENABLE ROW LEVEL SECURITY;

-- Read-only for admins. All writes go through the admin-manage-user edge
-- function using the service role, which bypasses RLS.
CREATE POLICY "Admins read invite batches"
  ON public.invite_batches
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins read invite batch rows"
  ON public.invite_batch_rows
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
