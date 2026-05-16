# Production Routing Fix Plan

## Goal

Make refresh/deep links work in production for client-side routes such as `/dashboard`, `/admin/settings`, `/mentor/sessions`, and other React Router pages.

## What I found

- The app uses `BrowserRouter`, which is correct for clean production URLs.
- Routes like `/dashboard` and `/admin/settings` exist in `src/App.tsx`.
- A `vercel.json` file already exists, but I will harden it for Vercel SPA hosting and make the production fallback explicit.
- The exact path `/admin` is not currently defined; only nested admin routes exist, such as `/admin/users`, `/admin/settings`, `/admin/applications`.

## Changes to make

1. Update Vercel routing configuration
   - Ensure all non-file page navigations are served by `/index.html`.
   - Keep static asset caching intact for `/assets/*`.
   - Preserve production security headers.

2. Add missing top-level redirects in the app router
   - `/admin` redirects to a valid admin page, likely `/admin/applications`.
   - `/mentor` redirects to `/mentor/sessions` or dashboard.
   - `/mentee` redirects to `/mentee/sessions` or dashboard.

3. Verify production-readiness configuration
   - Confirm Vite builds with root-relative assets.
   - Confirm no basename/subdirectory routing issue exists.
   - Confirm published Lovable visibility is public.

## Expected result

Refreshing or directly opening production URLs like these should load the app instead of showing a hosting 404:

```text
/dashboard
/admin
/admin/settings
/mentor/sessions
/mentee/sessions
```

## Deployment note

After implementation, redeploy/update the frontend on the production host. Backend changes deploy automatically, but frontend routing/config changes require a new production deployment.
