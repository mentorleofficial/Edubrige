# Pre-fill the LinkedIn post with the mentor's caption

## The problem
LinkedIn's `share-offsite` endpoint we're currently using is **URL-only by design** — it ignores any `text` / `summary` / `title` parameter and only shows the link itself. That's why the user sees just the Mentorle URL when LinkedIn opens.

## The fix
Switch to LinkedIn's **feed composer** endpoint, which does accept a `text` parameter:

```
https://www.linkedin.com/feed/?shareActive=true&text={encoded caption}
```

The caption already contains the profile link inline, so the post will read:

> Excited to share that I've joined Mentorle as a mentor! 🚀
>
> If you're looking for guidance in {expertise}, let's connect.
>
> Check out my profile: https://mentorle.lovable.app/mentors/jane-doe

## Changes

1. **`src/features/mentor-approval/ApprovalCelebrationModal.tsx`**
   - Replace `share-offsite/?url=...` with `feed/?shareActive=true&text={encoded caption}`.
   - Keep the clipboard copy as a safety net (so the user can paste manually if LinkedIn ever ignores the param), and update the toast: "Caption copied! Paste it on LinkedIn if it doesn't appear."

2. **`src/pages/MentorProfile.tsx`** (header "Share on LinkedIn" button)
   - Currently shares only the bare URL with no message. Build the same default caption ("Check out my mentor profile on {appName}: {url}") and use the composer endpoint so the body is prefilled.
   - Also copy the caption to clipboard as a fallback.

## Notes
- LinkedIn caps prefilled text at ~700 chars; the default caption is well under that.
- The composer requires the user to be logged into LinkedIn — same as the existing share flow.
- If LinkedIn ever drops the `text` param, the clipboard fallback means the user can still paste with Cmd/Ctrl+V.

## Out of scope
- Posting via LinkedIn's API (would need OAuth + LinkedIn app review).
- Image/preview customization beyond what OG meta tags already provide on the public profile page.
