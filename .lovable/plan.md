## Goal

Extend the admin **Branding** page so admins can:
1. Customize the **sidebar colors** (background, foreground, primary accent) — currently hard-coded in `src/index.css`.
2. Choose the **fonts** used for body text and headings from a curated list of Google Fonts.

Changes are persisted in the existing `branding` table and applied globally via CSS variables (same mechanism already used for primary/secondary/accent).

---

## What the user will see

In `Admin → Settings → Branding`, two new cards appear below the existing "Colors" card:

- **Sidebar colors** — three color tiles (Background, Foreground/text, Active item) with the same picker UX as existing color tiles, plus the same preset chips concept (Dark, Light, Brand-tinted).
- **Typography** — two dropdowns (Body font, Heading font) populated with ~8 curated Google Fonts (DM Sans, Inter, Roboto, Poppins, Lato, Nunito for body; DM Serif Display, Playfair Display, Lora, Merriweather, Space Grotesk for headings). A small live sample shows the chosen pairing.

The right-hand **Live preview** card gets a mini sidebar strip and a heading/body sample so changes are visible before saving.

After saving, the new values apply instantly across the whole app (sidebar in `AppSidebar`, headings everywhere via the global `h1..h6` rule).

---

## Technical plan

### 1. Database — new migration

Add columns to `public.branding`:
- `sidebar_background` text default `'220 25% 10%'`
- `sidebar_foreground` text default `'40 33% 96%'`
- `sidebar_primary` text default `'199 89% 48%'` (active item / accent inside sidebar)
- `body_font` text default `'DM Sans'`
- `heading_font` text default `'DM Serif Display'`

Existing RLS (admin-only update, public read) already covers these.
Existing `audit_branding` trigger will pick them up automatically.

### 2. Font loading

Replace the hard-coded `@import` in `src/index.css` with **dynamic injection** done in `BrandingProvider`:
- Maintain a static map `FONT_OPTIONS = { 'DM Sans': '<google-fonts url>', ... }`.
- On branding load, inject/update a single `<link id="branding-fonts" rel="stylesheet">` in `<head>` containing the two selected families.
- Set CSS vars `--font-sans` and `--font-serif` on `:root`.

### 3. Tailwind / CSS wiring

- In `tailwind.config.ts`, change `fontFamily.sans` / `fontFamily.serif` to read from the new CSS vars with sensible fallbacks:
  ```
  sans: ["var(--font-sans)", "DM Sans", "system-ui", "sans-serif"]
  serif: ["var(--font-serif)", "DM Serif Display", "Georgia", "serif"]
  ```
- In `src/index.css`, drop the static `@import` and add `--font-sans` / `--font-serif` defaults under `:root`. Keep the global `h1..h6 { font-family: var(--font-serif) }` rule.
- Add `--sidebar-background`, `--sidebar-foreground`, `--sidebar-primary` defaults (already present); `BrandingProvider` will overwrite them at runtime.

### 4. `BrandingContext.tsx`

- Extend `BrandingConfig` with the 5 new fields.
- After fetching, set the additional CSS vars (`--sidebar-background`, `--sidebar-foreground`, `--sidebar-primary`, `--font-sans`, `--font-serif`) and call the font-link injector.

### 5. `BrandingSettings.tsx`

- Extend `BrandingRow` and `draft` shape with the new fields.
- New **Sidebar colors** card reusing the existing `ColorTile` component (3 tiles).
- New **Typography** card with two `Select` dropdowns + a text sample.
- Update `save()` to include the new columns and apply the new CSS vars + reload font link immediately on success.
- Update the right-hand live preview to show: a mini dark sidebar strip using the chosen sidebar colors, and a heading + body line using the chosen fonts.

### 6. Types regeneration

`src/integrations/supabase/types.ts` will be updated automatically when the migration runs.

---

## Files touched

- new: `supabase/migrations/<ts>_branding_sidebar_fonts.sql`
- edited: `src/index.css` (remove static @import, add font-var defaults)
- edited: `tailwind.config.ts` (font families read from CSS vars)
- edited: `src/contexts/BrandingContext.tsx` (load + apply new fields, inject Google Fonts link)
- edited: `src/components/admin/BrandingSettings.tsx` (Sidebar colors card, Typography card, updated preview, updated save)
- auto-edited: `src/integrations/supabase/types.ts`

---

## Out of scope (can do in a follow-up if you want)

- Per-role sidebar themes (e.g. different sidebar look for mentor vs admin).
- Uploading custom font files. We stick to a curated Google Fonts list to keep performance and licensing predictable.
- Dark-mode-specific sidebar overrides — current app is light-mode only in practice; sidebar already uses its own dark tokens, which is what we'll customize.
