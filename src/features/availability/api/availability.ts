import { supabase } from "@/integrations/supabase/client";

export interface WeeklySlot {
  id: string;
  mentor_id: string;
  day_of_week: number;
  start_time: string; // "HH:MM:SS" or "HH:MM"
  end_time: string;
  is_recurring: boolean;
}

export interface DateOverride {
  id: string;
  mentor_id: string;
  date: string; // YYYY-MM-DD
  is_unavailable: boolean;
  start_time: string | null;
  end_time: string | null;
}

export async function fetchWeeklySlots(mentorId: string): Promise<WeeklySlot[]> {
  const { data, error } = await supabase
    .from("mentor_availability")
    .select("*")
    .eq("mentor_id", mentorId)
    .order("day_of_week")
    .order("start_time");
  if (error) throw error;
  return (data ?? []) as WeeklySlot[];
}

export async function fetchOverrides(mentorId: string): Promise<DateOverride[]> {
  const { data, error } = await supabase
    .from("mentor_availability_overrides")
    .select("*")
    .eq("mentor_id", mentorId)
    .order("date");
  if (error) throw error;
  return (data ?? []) as DateOverride[];
}

export async function fetchTimezone(mentorId: string): Promise<string> {
  const { data, error } = await supabase
    .from("mentor_profiles")
    .select("timezone")
    .eq("user_id", mentorId)
    .maybeSingle();
  if (error) throw error;
  return (data?.timezone as string) ?? "UTC";
}

export async function updateTimezone(mentorId: string, timezone: string) {
  const { error } = await supabase
    .from("mentor_profiles")
    .update({ timezone })
    .eq("user_id", mentorId);
  if (error) throw error;
}

export async function addSlot(input: {
  mentor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}) {
  const { data, error } = await supabase
    .from("mentor_availability")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as WeeklySlot;
}

export async function updateSlot(
  id: string,
  patch: { start_time?: string; end_time?: string }
) {
  const { error } = await supabase.from("mentor_availability").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteSlot(id: string) {
  const { error } = await supabase.from("mentor_availability").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteSlotsForDay(mentorId: string, dayOfWeek: number) {
  const { error } = await supabase
    .from("mentor_availability")
    .delete()
    .eq("mentor_id", mentorId)
    .eq("day_of_week", dayOfWeek);
  if (error) throw error;
}

export async function copySlotsToDays(
  mentorId: string,
  sourceSlots: { start_time: string; end_time: string }[],
  targetDays: number[]
) {
  // Wipe target days first to keep them in sync
  for (const day of targetDays) {
    await deleteSlotsForDay(mentorId, day);
  }
  const rows = targetDays.flatMap((day) =>
    sourceSlots.map((s) => ({
      mentor_id: mentorId,
      day_of_week: day,
      start_time: s.start_time,
      end_time: s.end_time,
    }))
  );
  if (rows.length === 0) return;
  const { error } = await supabase.from("mentor_availability").insert(rows);
  if (error) throw error;
}

export async function addOverride(input: Omit<DateOverride, "id">) {
  const { data, error } = await supabase
    .from("mentor_availability_overrides")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as DateOverride;
}

export async function deleteOverride(id: string) {
  const { error } = await supabase
    .from("mentor_availability_overrides")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
