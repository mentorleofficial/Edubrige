import { supabase } from "@/integrations/supabase/client";

export interface MentorWithProfile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  mentor_profiles: {
    bio: string | null;
    expertise: string[] | null;
    years_experience: number | null;
  }[];
}

/**
 * Fetch all active mentors with their public profile data.
 * Single source of truth for the mentor directory query.
 */
export async function fetchActiveMentors(): Promise<MentorWithProfile[]> {
  const { data, error } = await supabase
    .from("users")
    .select(
      "id, full_name, email, avatar_url, mentor_profiles!inner(bio, expertise, years_experience, is_active)"
    )
    .eq("role", "mentor")
    .eq("mentor_profiles.is_active", true);

  if (error) throw error;
  return (data as unknown as MentorWithProfile[]) ?? [];
}
