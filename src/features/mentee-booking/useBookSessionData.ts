import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { menteeSessionsKey } from "@/features/mentee-sessions/useMenteeSessions";

export interface BookingMentor {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
}
export interface BookingSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}
export interface BookingOverride {
  id: string;
  date: string;
  is_unavailable: boolean;
  start_time: string | null;
  end_time: string | null;
}
export interface BookingMentorProfile {
  is_active: boolean;
  timezone: string;
}
export interface BookSessionStaticData {
  mentor: BookingMentor | null;
  slots: BookingSlot[];
  mentorProfile: BookingMentorProfile | null;
  overrides: BookingOverride[];
}

export const bookSessionStaticKey = (mentorId?: string) =>
  ["book-session", "static", mentorId] as const;
export const bookSessionBookedKey = (mentorId?: string) =>
  ["book-session", "booked-times", mentorId] as const;

/**
 * Mentor + availability + overrides — stable, cached across visits.
 */
export function useBookSessionStatic(mentorId?: string) {
  return useQuery<BookSessionStaticData>({
    queryKey: bookSessionStaticKey(mentorId),
    enabled: !!mentorId,
    staleTime: 60_000,
    queryFn: async () => {
      const todayDate = new Date().toISOString().slice(0, 10);
      const [mentorRes, slotsRes, mpRes, ovRes] = await Promise.all([
        supabase
          .from("users")
          .select("id, full_name, avatar_url, email")
          .eq("id", mentorId!)
          .single(),
        supabase
          .from("mentor_availability")
          .select("id, day_of_week, start_time, end_time")
          .eq("mentor_id", mentorId!)
          .order("day_of_week"),
        supabase
          .from("mentor_profiles")
          .select("is_active, timezone")
          .eq("user_id", mentorId!)
          .maybeSingle(),
        supabase
          .from("mentor_availability_overrides")
          .select("id, date, is_unavailable, start_time, end_time")
          .eq("mentor_id", mentorId!)
          .gte("date", todayDate)
          .order("date"),
      ]);
      return {
        mentor: (mentorRes.data as BookingMentor | null) ?? null,
        slots: (slotsRes.data as BookingSlot[] | null) ?? [],
        mentorProfile: (mpRes.data as BookingMentorProfile | null) ?? null,
        overrides: (ovRes.data as BookingOverride[] | null) ?? [],
      };
    },
  });
}

/**
 * Booked times — invalidated after a successful booking.
 */
export function useBookedTimes(mentorId?: string) {
  return useQuery<Set<string>>({
    queryKey: bookSessionBookedKey(mentorId),
    enabled: !!mentorId,
    staleTime: 30_000,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + 90);
      const { data, error } = await supabase
        .from("sessions")
        .select("scheduled_at, duration_minutes")
        .eq("mentor_id", mentorId!)
        .eq("status", "booked")
        .gte("scheduled_at", nowIso)
        .lte("scheduled_at", horizon.toISOString());
      if (error) throw error;
      const set = new Set<string>();
      (data ?? []).forEach((s: { scheduled_at: string }) =>
        set.add(new Date(s.scheduled_at).toISOString())
      );
      return set;
    },
  });
}

export interface BookSessionInput {
  mentorId: string;
  menteeId: string;
  scheduledAt: Date;
  durationMinutes: number;
  notes: string;
  rescheduleId?: string | null;
}
export interface BookSessionResult {
  sessionId: string;
  meetingUrl: string;
}

export function useBookSession() {
  const qc = useQueryClient();
  return useMutation<BookSessionResult, Error, BookSessionInput>({
    mutationFn: async (input) => {
      const { data: inserted, error } = await supabase
        .from("sessions")
        .insert({
          mentor_id: input.mentorId,
          mentee_id: input.menteeId,
          scheduled_at: input.scheduledAt.toISOString(),
          duration_minutes: input.durationMinutes,
          mentee_notes: input.notes,
        })
        .select("id")
        .single();
      if (error || !inserted) throw error || new Error("Insert failed");

      const meetingUrl = `https://meet.jit.si/mentorle-${inserted.id}`;
      await supabase
        .from("sessions")
        .update({ meeting_url: meetingUrl })
        .eq("id", inserted.id);

      if (input.rescheduleId) {
        await supabase
          .from("sessions")
          .update({
            status: "cancelled",
            cancelled_by: input.menteeId,
            cancelled_at: new Date().toISOString(),
            cancellation_reason: "Rescheduled",
          })
          .eq("id", input.rescheduleId);
      }

      return { sessionId: inserted.id, meetingUrl };
    },
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: bookSessionBookedKey(vars.mentorId) });
      qc.invalidateQueries({ queryKey: menteeSessionsKey(vars.menteeId) });
      qc.invalidateQueries({ queryKey: ["mentee-dashboard", vars.menteeId] });
    },
  });
}
