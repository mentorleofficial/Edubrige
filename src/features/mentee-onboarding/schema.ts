import { z } from "zod";

export const menteeOnboardingSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Please enter your full name")
    .max(120, "Name is too long"),
  headline: z.string().trim().max(160, "Keep it under 160 characters").default(""),
  bio: z.string().trim().max(600, "Keep it under 600 characters").default(""),
  organization_unit: z.string().trim().max(120).default(""),
  linkedin_url: z
    .string()
    .trim()
    .max(255)
    .refine(
      (v) => v === "" || /^https?:\/\/(www\.)?linkedin\.com\//i.test(v),
      "Enter a valid LinkedIn URL"
    )
    .default(""),
  goals: z
    .string()
    .trim()
    .min(20, "Tell mentors a bit more about your goals (≥20 chars)")
    .max(800, "Keep it under 800 characters"),
  interests: z
    .array(z.string().trim().min(1).max(40))
    .min(3, "Add at least 3 interests")
    .max(20, "That's plenty — keep it under 20"),
  preferred_mentor_areas: z
    .array(z.string().trim().min(1).max(40))
    .min(1, "Pick at least one mentor area")
    .max(15, "Keep it under 15"),
});

export type MenteeOnboardingValues = z.infer<typeof menteeOnboardingSchema>;

export const emptyOnboarding: MenteeOnboardingValues = {
  full_name: "",
  headline: "",
  bio: "",
  organization_unit: "",
  linkedin_url: "",
  goals: "",
  interests: [],
  preferred_mentor_areas: [],
};
