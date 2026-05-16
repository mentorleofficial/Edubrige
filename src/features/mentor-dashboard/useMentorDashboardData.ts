import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  mentorSessionsKey,
  type MentorSessionRow,
} from "@/features/mentor-sessions/useMentorSessions";

export type MentorDashSession = MentorSessionRow;

export type MentorDashFeedback = {
  id: string;
  session_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  submitted_by: string;
};

export type MentorProfileRow = {
  bio: string | null;
  expertise: string[] | null;
  qualifications: unknown[] | null;
  experiences: unknown[] | null;
  resume_url: string | null;
  headline: string | null;
  avatar_url: string | null;
};

export type MentorDashData = {
  sessions: MentorDashSession[];
  feedback: MentorDashFeedback[];
  profile: MentorProfileRow | null;
  availabilityCount: number;
};

export const useMentorDashboardData = (userId?: string) => {
  const qc = useQueryClient();

  return useQuery<MentorDashData>({
    queryKey: ["mentor", "dashboard", userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      // Sessions — reuse the shared cache key so MentorSessions page and
      // MyMenteesPanel hit the same in-flight request / cached data.
      const cachedSessions = qc.getQueryData<MentorSessionRow[]>(
        mentorSessionsKey(userId)
      );
      const sessions: MentorSessionRow[] =
        cachedSessions ??
        (await qc.fetchQuery({
          queryKey: mentorSessionsKey(userId),
          staleTime: 60_000,
          queryFn: async () => {
            const { data, error } = await supabase
              .from("sessions")
              .select(
                "id, scheduled_at, duration_minutes, status, notes, mentee_notes, meeting_url, cancellation_reason, mentee_id, cancelled_at, mentee:users!sessions_mentee_id_fkey(full_name, avatar_url)"
              )
              .eq("mentor_id", userId!)
              .order("scheduled_at", { ascending: false });
            if (error) throw error;
            return (data as unknown as MentorSessionRow[]) ?? [];
          },
        }));

      const [mpRes, avRes, userRes] = await Promise.all([
        supabase
          .from("mentor_profiles")
          .select("bio, expertise, qualifications, experiences, resume_url, headline")
          .eq("user_id", userId!)
          .maybeSingle(),
        supabase
          .from("mentor_availability")
          .select("id, day_of_week")
          .eq("mentor_id", userId!),
        supabase.from("users").select("avatar_url").eq("id", userId!).maybeSingle(),
      ]);

      const sessionIds = sessions.map((s) => s.id);
      let feedback: MentorDashFeedback[] = [];
      if (sessionIds.length > 0) {
        const fbRes = await supabase
          .from("feedback")
          .select("id, session_id, rating, comment, created_at, submitted_by")
          .eq("audience", "mentor")
          .in("session_id", sessionIds);
        feedback = (fbRes.data as MentorDashFeedback[] | null) ?? [];
      }

      const profile: MentorProfileRow | null = mpRes.data
        ? {
            ...(mpRes.data as Omit<MentorProfileRow, "avatar_url">),
            avatar_url: userRes.data?.avatar_url ?? null,
          }
        : null;

      return {
        sessions,
        feedback,
        profile,
        availabilityCount: avRes.data?.length ?? 0,
      };
    },
  });
};
