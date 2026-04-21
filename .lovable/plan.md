

# Production Readiness Checklist & Hardening Plan

A concrete, repo-aware audit of what's needed before shipping. Grouped by area, each item maps to a specific file or change. I'll deliver this as both **(a) a written checklist document committed to the repo** at `docs/PRODUCTION_CHECKLIST.md` and **(b) the code fixes for items marked "auto-fix" below**.

---

## 1. Security

- **No private keys in frontend** — verified. `.env` only contains `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY` (anon, safe). `SUPABASE_SERVICE_ROLE_KEY` lives only in edge function secrets. ✅ keep it that way — add a lint rule + CI grep to fail if `SERVICE_ROLE` ever appears under `src/`.
- **RLS** — every table has RLS via `rls_auto_enable` event trigger. Auto-fix: run `supabase--linter` and fix any warnings.
- **Roles in `user_roles` table** with `has_role()` security-definer — already correct. ✅
- **Edge functions auth** — `validate-jwt-config` already verifies caller + admin role. Audit `approve-mentor-application` for same pattern.
- **Storage buckets** — `mentor-resumes` (private) and `branding-assets` (public). Confirm RLS policies on `branding-assets` restrict write to admins.
- **Security headers** — add `_headers` (or `vercel.json` `headers`) for: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and a CSP allowing only Supabase + self.
- **Run security scan** — execute `security--run_security_scan` and resolve findings before launch.

## 2. Frontend performance / fast loading

- **Route-level code splitting** — `App.tsx` imports all 17 pages eagerly. Convert to `React.lazy()` + `<Suspense>` with a skeleton fallback. Cuts initial bundle ~60%.
- **React Query defaults** — `new QueryClient()` uses defaults. Set `staleTime: 60_000`, `gcTime: 5*60_000`, `refetchOnWindowFocus: false` to cut redundant requests.
- **Manual chunks in Vite** — split `react`, `@radix-ui/*`, `recharts`, `@supabase/supabase-js` into vendor chunks via `build.rollupOptions.output.manualChunks`.
- **Image hygiene** — all uploaded logos/backgrounds served from Supabase storage; add `loading="lazy"` and `decoding="async"` on non-hero images.
- **Drop unused Radix packages** if any after audit (tree-shaken anyway, but removes maintenance surface).
- **Preconnect** to Supabase URL in `index.html` (`<link rel="preconnect" href="https://uibbavdzxmictgqdcuny.supabase.co">`).
- **Compression** — Vercel handles brotli automatically. ✅
- **Bundle analyzer** — add `rollup-plugin-visualizer` script (`npm run build -- --mode analyze`) for ongoing monitoring.

## 3. State management

- Server state → React Query (already in tree but underused — many pages use raw `useEffect + supabase.from(...)` with local `useState`). Migrate data fetching in pages like `MentorDirectory`, `AdminUsers`, `AdminApplications` to `useQuery` for caching, dedup, retries.
- Auth state → Context (`AuthContext`) ✅ correct pattern.
- Branding state → Context (`BrandingContext`) ✅.
- Form state → `react-hook-form` + `zod` (already installed) — apply to `MentorApplicationForm`, `BookSession` for inline validation instead of manual `useState`.
- No global Redux/Zustand needed at this size.

## 4. Error handling & resilience

- Add a top-level `<ErrorBoundary>` in `App.tsx` rendering a friendly fallback.
- Add `<Suspense>` boundaries around lazy routes.
- Standardize Supabase error toasts via a small helper (`src/lib/handleError.ts`).
- React Query global `onError` for unhandled query/mutation failures.

## 5. Observability

- Wire a lightweight error reporter (e.g. Sentry browser SDK) behind `VITE_SENTRY_DSN`. Optional but recommended.
- Edge function logs already in Supabase dashboard — document where to find them in the checklist.
- Add `console.error` → reporter in the ErrorBoundary.

## 6. Vercel / hosting setup

The project is currently published via Lovable hosting (`mentorle.lovable.app`). If migrating to Vercel:

- **`vercel.json`** with:
  - `rewrites: [{ "source": "/(.*)", "destination": "/index.html" }]` for SPA routing
  - `headers` block (security headers above)
  - `cleanUrls: true`
- **Build command**: `npm run build`, output `dist`.
- **Environment variables** in Vercel dashboard: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` (mark as "Production" + "Preview"). Never add the service role key.
- **Preview deployments** auto-build per PR — Supabase CORS already accepts `*` for anon endpoints; if you tighten it, allowlist `*.vercel.app`.
- **Custom domain + HTTPS** — Vercel handles automatically; ensure `Site URL` and `Redirect URLs` in Supabase Auth settings match the production domain (otherwise email confirmations/OTP redirects break).
- **`robots.txt`** already exists; confirm it allows production and disallows previews.

## 7. SEO / metadata (`index.html`)

- Title and OG tags currently hard-coded to "Mentorle"/Lovable preview. Replace OG image with a production asset; set `meta name="author"` to your org; add `<link rel="canonical">`.

## 8. "Microservices" / code structure

True microservices aren't appropriate for a Vite SPA, but the equivalent here is **modular, well-bounded code**. Concrete refactors:

- **Feature folders** under `src/features/{auth,mentors,sessions,admin,branding}` with each containing `api/` (supabase calls), `hooks/` (react-query), `components/`, `types.ts`. Move existing files accordingly.
- **One Supabase call layer per feature** — no raw `supabase.from(...)` in components. Pages call hooks like `useMentors()`, `useApplications()`.
- **Edge functions = your microservices.** Keep them small and single-purpose. Today: `approve-mentor-application`, `validate-jwt-config`. Future server-side work (e.g. JWT login callback, session reminders) goes into new functions, not a monolith.
- Shared utilities in `src/lib/`, primitive UI in `src/components/ui/` (already done).

## 9. CI / quality gates

- Add a GitHub Action (or Vercel check) that runs: `npm run lint`, `npm run test`, `tsc --noEmit`, `npm run build`. Fail the deploy on any error.
- Add `grep -r "SERVICE_ROLE" src/` step that fails the build if matched.

## 10. Auth / config sanity

- `AuthContext` does an async `await` inside `onAuthStateChange` callback indirectly via `setTimeout(fetchProfile, 0)` ✅ (avoids deadlock — keep).
- Confirm Supabase Auth dashboard: Site URL = production domain; Redirect URLs include prod + `localhost:8080`; OTP length = 8 (matches `config.toml`); email templates branded.
- Disable Supabase email signups entirely if mentees only enter via JWT (admin choice).

---

## Deliverables in implementation phase

1. `docs/PRODUCTION_CHECKLIST.md` — this checklist as a living doc with checkboxes.
2. `vercel.json` — SPA rewrites + security headers.
3. `src/App.tsx` — convert routes to `React.lazy` + add `ErrorBoundary` + `Suspense`.
4. `src/components/ErrorBoundary.tsx` — new.
5. `src/lib/queryClient.ts` — extracted `QueryClient` with sane defaults.
6. `vite.config.ts` — `manualChunks` for vendor splitting.
7. `index.html` — `preconnect` to Supabase, cleaned meta.
8. `.github/workflows/ci.yml` (optional, ask before adding) — lint/test/build/grep gate.
9. Begin feature-folder migration with **one** vertical slice (mentors) as the template; rest can follow incrementally to avoid a giant PR.

## Out of scope for this pass

- Sentry signup (needs DSN from user).
- Full feature-folder migration of every page (do incrementally).
- Switching hosting from Lovable → Vercel (only prepare config; user decides when to flip DNS).

