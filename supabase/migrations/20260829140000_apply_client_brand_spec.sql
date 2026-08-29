-- Client brand spec: Plus Jakarta Sans, CTA #1E3A8A.
-- The branding row overrides the CSS defaults at runtime via BrandingProvider,
-- so the row itself must be updated for the theme to take effect in production.
--
-- Body #808080 and heading #0D0D0D are compile-time tokens in index.css
-- (--muted-foreground / --foreground); the branding table has no columns for
-- them, so they are not set here.

UPDATE public.branding
SET
  body_font = 'Plus Jakarta Sans',
  heading_font = 'Plus Jakarta Sans',
  primary_color = '224 64% 33%',
  updated_at = now();
