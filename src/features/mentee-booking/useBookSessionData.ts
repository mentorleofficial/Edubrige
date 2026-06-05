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
  buffer_time_minutes: number;
  minimum_notice_hours: number;
}
export interface BookingOffering {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  category: string;
}
export interface BookSessionStaticData {
  mentor: BookingMentor | null;
  slots: BookingSlot[];
  mentorProfile: BookingMentorProfile | null;
  overrides: BookingOverride[];
  offerings: BookingOffering[];
}

export interface BookedTime {
  scheduled_at: string;
  duration_minutes: number;
}

export const bookSessionStaticKey = (mentorId?: string) =>
  ["book-session", "static", mentorId] as const;
export const bookSessionBookedKey = (mentorId?: string, excludeSessionId?: string | null) =>
  ["book-session", "booked-times", mentorId, excludeSessionId] as const;

/**
 * Mentor + availability + overrides + offerings — stable, cached across visits.
 */
export function useBookSessionStatic(mentorId?: string) {
  return useQuery<BookSessionStaticData>({
    queryKey: bookSessionStaticKey(mentorId),
    enabled: !!mentorId,
    staleTime: 60_000,
    queryFn: async () => {
      const todayDate = new Date().toISOString().slice(0, 10);
      const [mentorRes, slotsRes, mpRes, ovRes, offeringsRes] = await Promise.all([
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
          .select("is_active, timezone, buffer_time_minutes, minimum_notice_hours")
          .eq("user_id", mentorId!)
          .maybeSingle(),
        supabase
          .from("mentor_availability_overrides")
          .select("id, date, is_unavailable, start_time, end_time")
          .eq("mentor_id", mentorId!)
          .gte("date", todayDate)
          .order("date"),
        supabase
          .from("mentorship_offerings")
          .select("id, title, description, duration_minutes, price, category")
          .eq("mentor_id", mentorId!)
          .eq("status", "active")
          .order("duration_minutes"),
      ]);
      return {
        mentor: (mentorRes.data as BookingMentor | null) ?? null,
        slots: (slotsRes.data as BookingSlot[] | null) ?? [],
        mentorProfile: (mpRes.data as BookingMentorProfile | null) ?? null,
        overrides: (ovRes.data as BookingOverride[] | null) ?? [],
        offerings: (offeringsRes.data as BookingOffering[] | null) ?? [],
      };
    },
  });
}

/**
 * Booked times — invalidated after a successful booking.
 */
export function useBookedTimes(mentorId?: string, excludeSessionId?: string | null) {
  return useQuery<BookedTime[]>({
    queryKey: bookSessionBookedKey(mentorId, excludeSessionId),
    enabled: !!mentorId,
    staleTime: 30_000,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + 90);
      
      let query = supabase
        .from("sessions")
        .select("scheduled_at, duration_minutes")
        .eq("mentor_id", mentorId!)
        .eq("status", "booked")
        .gte("scheduled_at", nowIso)
        .lte("scheduled_at", horizon.toISOString());

      if (excludeSessionId) {
        query = query.neq("id", excludeSessionId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as BookedTime[];
    },
  });
}

export interface BookSessionInput {
  mentorId: string;
  menteeId: string;
  scheduledAt: Date;
  durationMinutes: number;
  notes: string;
  title: string;
  topic?: string;
  rescheduleId?: string | null;
  offeringId?: string | null;
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
          title: input.title,
          topic: input.topic ?? "",
          offering_id: input.offeringId || null,
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
      qc.invalidateQueries({ queryKey: bookSessionBookedKey(vars.mentorId, vars.rescheduleId) });
      qc.invalidateQueries({ queryKey: menteeSessionsKey(vars.menteeId) });
      qc.invalidateQueries({ queryKey: ["mentee-dashboard", vars.menteeId] });
    },
  });
}
