## Problem

On the mentor Sessions page, the "Rate mentee" button on completed sessions navigates to `/session/:id/feedback`, but that route in `src/App.tsx` is gated to mentees only:

```tsx
<Route path="/session/:id/feedback" element={
  <RoleGuard allowedRoles={["mentee"]}>
    <MenteeOnboardingGuard><SessionFeedback /></MenteeOnboardingGuard>
  </RoleGuard>
} />
```

So mentors get bounced out and the feature appears broken. The `SessionFeedback` page itself already supports both roles — it detects mentor vs mentee via `session.mentor_id === user.id` and renders the correct form (including the mentor-only "private note for admins" textarea and the `admin_private` feedback row). RLS also already allows mentors to submit `mentee`/`admin_private` audience feedback.

## Fix

Update the route in `src/App.tsx` to allow both `mentor` and `mentee`, and drop the `MenteeOnboardingGuard` wrapper (it would force mentors through mentee onboarding):

```tsx
<Route path="/session/:id/feedback" element={
  <RoleGuard allowedRoles={["mentor", "mentee"]}>
    <SessionFeedback />
  </RoleGuard>
} />
```

## Scope

- `src/App.tsx` — single route change.
- No backend, RLS, schema, or `SessionFeedback.tsx` changes (page already handles mentor flow).
- No changes to `MentorSessions.tsx`.

## Verification

- As a mentor, open Sessions → completed session → click "Rate mentee" → feedback form loads with star rating, comment, and private admin note.
- Submit → success toast, redirect back to `/mentor/sessions`, button switches to "Rated" pill on next load.
- Mentee flow at `/session/:id/feedback` remains unchanged.
