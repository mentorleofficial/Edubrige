import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type SessionStatus = Database["public"]["Enums"]["session_status"];

export interface MenteeSessionRow {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: SessionStatus;
  mentor_id: string;
  title: string;
  topic: string;
  mentee_notes: string;
  notes: string | null;
  meeting_url: string;
  cancellation_reason: string;
  cancelled_at: string | null;
  mentor: { full_name: string; avatar_url: string | null } | null;
}

export const menteeSessionsKey = (userId?: string) =>
  ["mentee", "sessions", userId] as const;
export const menteeRatedKey = (userId?: string) =>
  ["mentee", "rated-sessions", userId] as const;

export async function fetchMenteeSessions(userId: string): Promise<MenteeSessionRow[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id, scheduled_at, duration_minutes, status, mentor_id, title, topic, mentee_notes, notes, meeting_url, cancellation_reason, cancelled_at, mentor:users!sessions_mentor_id_fkey(full_name, avatar_url)"
    )
    .eq("mentee_id", userId)
    .order("scheduled_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as MenteeSessionRow[]) ?? [];
}

export function useMenteeSessions(userId?: string) {
  return useQuery({
    queryKey: menteeSessionsKey(userId),
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: () => fetchMenteeSessions(userId!),
  });
}

export function useMenteeRatedSessions(userId?: string, sessionIds?: string[]) {
  const enabled = !!userId && !!sessionIds && sessionIds.length > 0;
  return useQuery({
    queryKey: [...menteeRatedKey(userId), sessionIds?.length ?? 0],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback")
        .select("session_id")
        .eq("submitted_by", userId!)
        .eq("audience", "mentor")
        .in("session_id", sessionIds!);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.session_id as string));
    },
  });
}

export function useCancelMenteeSession(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; reason?: string }) => {
      const { error } = await supabase
        .from("sessions")
        .update({
          status: "cancelled",
          cancelled_by: userId,
          cancelled_at: new Date().toISOString(),
          cancellation_reason: input.reason || "Cancelled by mentee",
        } as never)
        .eq("id", input.id);
      if (error) throw error;
      return input;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: menteeSessionsKey(userId) });
      const prev = qc.getQueryData<MenteeSessionRow[]>(menteeSessionsKey(userId));
      if (prev) {
        qc.setQueryData<MenteeSessionRow[]>(
          menteeSessionsKey(userId),
          prev.map((s) =>
            s.id === input.id
              ? {
                  ...s,
                  status: "cancelled",
                  cancelled_at: new Date().toISOString(),
                  cancellation_reason: input.reason || "Cancelled by mentee",
                }
              : s
          )
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(menteeSessionsKey(userId), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: menteeSessionsKey(userId) });
      qc.invalidateQueries({ queryKey: ["mentee-dashboard", userId] });
    },
  });
}

export type MentorProgramTag = { name: string; color: string; slug: string };

export function useMenteeMentorPrograms(
  programIds: string[],
  mentorIds: string[]
) {
  return useQuery({
    queryKey: ["mentee", "mentor-programs", programIds.sort().join(","), mentorIds.sort().join(",")],
    enabled: programIds.length > 0 && mentorIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_mentors")
        .select("program_id, mentor_id")
        .in("program_id", programIds)
        .in("mentor_id", mentorIds);
      if (error) throw error;
      return (data ?? []) as { program_id: string; mentor_id: string }[];
    },
  });
}
