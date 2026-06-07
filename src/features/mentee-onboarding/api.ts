import { supabase } from "@/integrations/supabase/client";
import type { MenteeOnboardingValues } from "./schema";

export interface MenteeProfileData extends MenteeOnboardingValues {
  avatar_url: string | null;
  email: string;
  onboarded_at: string | null;
}

type MenteeProfileUpdate = {
  user_id: string;
  headline?: string;
  bio?: string;
  organization_unit?: string;
  linkedin_url?: string;
  goals?: string;
  interests?: string[];
  preferred_mentor_areas?: string[];
  onboarded_at?: string;
  academic_details?: string;
  github_url?: string;
  portfolio_url?: string;
};

type UserUpdate = {
  full_name?: string;
  avatar_url?: string | null;
};

export async function fetchMenteeProfile(userId: string): Promise<MenteeProfileData> {
  const [{ data: u }, { data: p }] = await Promise.all([
    supabase.from("users").select("full_name, email, avatar_url").eq("id", userId).maybeSingle(),
    supabase.from("mentee_profiles").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  return {
    full_name: u?.full_name ?? "",
    email: u?.email ?? "",
    avatar_url: u?.avatar_url ?? null,
    headline: (p as any)?.headline ?? "",
    bio: (p as any)?.bio ?? "",
    organization_unit: p?.organization_unit ?? "",
    linkedin_url: (p as any)?.linkedin_url ?? "",
    goals: p?.goals ?? "",
    interests: p?.interests ?? [],
    preferred_mentor_areas: ((p as any)?.preferred_mentor_areas ?? []) as string[],
    onboarded_at: ((p as any)?.onboarded_at as string | null) ?? null,
    academic_details: (p as any)?.academic_details ?? "",
    github_url: (p as any)?.github_url ?? "",
    portfolio_url: (p as any)?.portfolio_url ?? "",
  };
}

export async function upsertMenteeProfile(
  userId: string,
  values: Partial<MenteeOnboardingValues> & { full_name?: string; avatar_url?: string | null },
  opts?: { markOnboarded?: boolean }
) {
  const { full_name, avatar_url, ...profile } = values;

  if (full_name !== undefined || avatar_url !== undefined) {
    const update: UserUpdate = {};
    if (full_name !== undefined) update.full_name = full_name;
    if (avatar_url !== undefined) update.avatar_url = avatar_url;
    const { error: uErr } = await supabase.from("users").update(update).eq("id", userId);
    if (uErr) throw uErr;
  }

  const payload: MenteeProfileUpdate = { user_id: userId };
  if (profile.headline !== undefined) payload.headline = profile.headline;
  if (profile.bio !== undefined) payload.bio = profile.bio;
  if (profile.organization_unit !== undefined) payload.organization_unit = profile.organization_unit;
  if (profile.linkedin_url !== undefined) payload.linkedin_url = profile.linkedin_url;
  if (profile.goals !== undefined) payload.goals = profile.goals;
  if (profile.interests !== undefined) payload.interests = profile.interests;
  if (profile.preferred_mentor_areas !== undefined)
    payload.preferred_mentor_areas = profile.preferred_mentor_areas;
  if (profile.academic_details !== undefined) payload.academic_details = profile.academic_details;
  if (profile.github_url !== undefined) payload.github_url = profile.github_url;
  if (profile.portfolio_url !== undefined) payload.portfolio_url = profile.portfolio_url;
  if (opts?.markOnboarded) payload.onboarded_at = new Date().toISOString();

  const { error: pErr } = await supabase
    .from("mentee_profiles")
    .upsert(payload, { onConflict: "user_id" });
  if (pErr) throw pErr;
}

export async function uploadMenteeAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `avatars/${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("branding-assets")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("branding-assets").getPublicUrl(path);
  return data.publicUrl;
}
