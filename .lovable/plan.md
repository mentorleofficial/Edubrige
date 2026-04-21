

# Redesign /become-a-mentor as a focused application page

Replace the marketing landing page with a clean, branded, single-purpose application form. No hero, no benefits grid, no FAQ, no "how it works" — just the form, well-structured, with a clear multi-step flow and great UX.

## What changes

**`src/pages/MentorLanding.tsx`** — gut the page. Remove benefits, steps, FAQs sections. Keep only:
- Minimal branded header (logo + app name + Sign in link)
- A centered application card with the form embedded directly (not a dialog)
- Minimal footer

**`src/components/MentorApplicationDialog.tsx`** → split into two:
- Keep the dialog wrapper (still used elsewhere if needed) 
- Extract form internals into a new `src/components/MentorApplicationForm.tsx` so the same form can render inline on the page AND inside a dialog

## New form UX (multi-step wizard, inline on the page)

A single card with a progress indicator at top and 4 clear steps. User moves Next/Back between steps; each step validates before advancing.

```text
[Step 1 of 4 ───────────  ] Progress bar
[● Account] [○ About you] [○ Experience] [○ Verify]
```

**Step 1 — Account**
- Full name
- Email
- Password + confirm
- Phone (numeric-only filter retained)

**Step 2 — About you**
- Short bio (textarea, char counter)
- LinkedIn (url)
- Portfolio / Website (url, optional)
- Twitter / GitHub (optional)

**Step 3 — Experience**
- Years of experience (number input)
- Areas of expertise (chips/multi-select)
- Resume URL or uploader (whatever current dialog uses)
- Why do you want to mentor? (textarea)

**Step 4 — Verify email**
- Sends OTP on entering this step
- 8-digit OTP input (matches current Supabase config)
- Resend code link with 30s cooldown
- Success → redirect to dashboard

### UX details
- Sticky Next / Back buttons at the bottom of the card
- Inline field errors under each input (no toast spam)
- Disabled Next until current step is valid
- "Save and continue later" not added (out of scope)
- Auto-focus first field on each step
- On mobile: full-width card, larger tap targets
- Numeric-only filter on phone retained
- All inputs use proper HTML5 types (email, url, tel, number, password)

## Branding & typography

- All colors via existing CSS vars (`--primary`, `--secondary`, `--accent`, `--background`, `--foreground`, `--muted`, `--border`) — no hardcoded hex
- Headings use the project's serif display font, body uses DM Sans (per branding rules)
- Logo and app name pulled from `useBranding()` as today
- Card uses `bg-card`, subtle border, soft shadow — matches rest of app
- Progress bar and step dots use `--primary`
- Buttons keep existing `Button` component variants

## Layout

```text
┌─────────────────────────────────────────────┐
│ [logo] AppName                    Sign in   │  <- header
├─────────────────────────────────────────────┤
│                                             │
│        Become a mentor                      │  <- page title (serif)
│        Share your expertise...              │  <- one-line subtitle
│                                             │
│   ┌───────────────────────────────────┐     │
│   │ ●──○──○──○   Step 1 of 4         │     │
│   │                                   │     │
│   │  [form fields for current step]   │     │
│   │                                   │     │
│   │            [Back]  [Next →]       │     │
│   └───────────────────────────────────┘     │
│                                             │
├─────────────────────────────────────────────┤
│              © 2026 AppName                 │
└─────────────────────────────────────────────┘
```

Max width ~640px, vertically centered-ish (top padding, not flex-center, so long forms scroll naturally).

## Files

- `src/pages/MentorLanding.tsx` — strip to header + title + `<MentorApplicationForm />` + footer
- `src/components/MentorApplicationForm.tsx` — NEW, extracted multi-step form (account → about → experience → verify)
- `src/components/MentorApplicationDialog.tsx` — slim wrapper that renders `<MentorApplicationForm />` inside a Dialog (preserves any other call sites)

## Out of scope

- No backend/schema changes
- OTP stays at 8 digits (current working state)
- No email template changes
- No new fields beyond what the current dialog already collects

