import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DashSession = {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: "booked" | "completed" | "cancelled";
  mentor_id: string;
  meeting_url: string;
  cancelled_at: string | null;
  mentor: { full_name: string; avatar_url: string | null } | null;
};

export type DashFeedback = {
  id: string;
  session_id: string;
  rating: number;
  created_at: string;
};

export type RecommendedMentor = {
  user_id: string;
  slug: string | null;
  full_name: string;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  expertise: string[] | null;
  years_experience: number | null;
};

export type DashData = {
  sessions: DashSession[];
  feedback: DashFeedback[];
  preferredAreas: string[];
  recommended: RecommendedMentor[];
};

export const useMenteeDashboardData = (userId?: string) =>
  useQuery<DashData>({
    queryKey: ["mentee-dashboard", userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const [sessRes, fbRes, profRes, mentorsRes] = await Promise.all([
        supabase
          .from("sessions")
          .select(
            "id, scheduled_at, duration_minutes, status, mentor_id, meeting_url, cancelled_at, mentor:users!sessions_mentor_id_fkey(full_name, avatar_url)"
          )
          .eq("mentee_id", userId!)
          .order("scheduled_at", { ascending: true }),
        supabase
          .from("feedback")
          .select("id, session_id, rating, created_at")
          .eq("submitted_by", userId!)
          .eq("audience", "mentor"),
        supabase
          .from("mentee_profiles")
          .select("preferred_mentor_areas")
          .eq("user_id", userId!)
          .maybeSingle(),
        supabase.rpc("list_public_mentors"),
      ]);

      const preferredAreas: string[] =
        (profRes.data?.preferred_mentor_areas as string[] | null) ?? [];
      const allMentors = (mentorsRes.data as RecommendedMentor[] | null) ?? [];
      const lcAreas = preferredAreas.map((a) => a.toLowerCase());
      const scored = allMentors
        .map((m) => {
          const exp = (m.expertise ?? []).map((e) => e.toLowerCase());
          const overlap = exp.filter((e) => lcAreas.includes(e)).length;
          return { m, overlap };
        })
        .sort((a, b) => b.overlap - a.overlap || (b.m.years_experience ?? 0) - (a.m.years_experience ?? 0));
      const recommended = scored.map((s) => s.m).slice(0, 4);

      return {
        sessions: (sessRes.data as DashSession[] | null) ?? [],
        feedback: (fbRes.data as DashFeedback[] | null) ?? [],
        preferredAreas,
        recommended,
      };
    },
  });
