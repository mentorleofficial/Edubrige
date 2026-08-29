-- Expose body/heading text colour and body font weight in admin Branding
-- settings. Colours use the same "H S% L%" triplet format as the existing
-- branding colour columns so they can be written straight into CSS variables.
--
-- Defaults match the client brand spec: body #808080, headings #0D0D0D.

ALTER TABLE public.branding
  ADD COLUMN IF NOT EXISTS body_text_color text NOT NULL DEFAULT '0 0% 50%',
  ADD COLUMN IF NOT EXISTS heading_text_color text NOT NULL DEFAULT '0 0% 5%',
  ADD COLUMN IF NOT EXISTS body_font_weight integer NOT NULL DEFAULT 500;

ALTER TABLE public.branding
  DROP CONSTRAINT IF EXISTS branding_body_font_weight_check;

ALTER TABLE public.branding
  ADD CONSTRAINT branding_body_font_weight_check
  CHECK (body_font_weight IN (400, 500, 600));

UPDATE public.branding
SET
  body_text_color = '0 0% 50%',
  heading_text_color = '0 0% 5%',
  body_font_weight = 500,
  updated_at = now();
