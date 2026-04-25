# Fix: Slug exists in DB but UI still shares UUID

## Root cause
Confirmed via DB query — the slug `abhishek-soni` is correctly saved on the mentor profile. The bug is in the frontend:

`src/features/mentor-profile/api/mentorProfile.ts` → `fetchMentorProfile` queries `select("*")` (so slug IS returned), but the returned `MentorProfileData` object **does not include `slug`** in its mapped output. So when `MentorProfile.tsx` does `(data as any)?.slug`, it's `undefined` and falls back to `userId`.

## Fix
1. Add `slug: string | null` to the `MentorProfileData` interface in `src/features/mentor-profile/api/mentorProfile.ts`.
2. Map `slug: (p as any)?.slug ?? null` in the returned object inside `fetchMentorProfile`.

That's it — the existing `MentorProfile.tsx` code already reads `(data as any)?.slug`, so once the field is populated, the LinkedIn share + Copy link buttons will produce `https://mentorle.lovable.app/mentors/abhishek-soni`.

## Out of scope
No DB or backend changes — slugs are already correctly generated and stored.
