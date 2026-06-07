import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Program = Database["public"]["Tables"]["programs"]["Row"];
export type ProgramTag = Database["public"]["Tables"]["program_tags"]["Row"];

export type ProgramWithCounts = Program & {
  mentor_count: number;
  mentee_count: number;
  tags: ProgramTag[];
};

/**
 * Fetch programs the current user belongs to.
 * Mentors → via program_mentors. Mentees → via program_mentees.
 * RLS already restricts both tables to the authenticated user.
 */
export async function fetchMyPrograms(
  userId: string,
  role: "mentor" | "mentee",
): Promise<ProgramWithCounts[]> {
  const linkTable = role === "mentor" ? "program_mentors" : "program_mentees";
  const userCol = role === "mentor" ? "mentor_id" : "mentee_id";

  const { data: links, error: linkErr } = await supabase
    .from(linkTable as any)
    .select("program_id")
    .eq(userCol, userId);
  if (linkErr) throw linkErr;

  const programIds = Array.from(
    new Set(((links || []) as any[]).map((r) => r.program_id).filter(Boolean)),
  );
  if (programIds.length === 0) return [];

  const [{ data: programs, error: pErr }, { data: mentors }, { data: mentees }, { data: tags }] =
    await Promise.all([
      supabase.from("programs").select("*").in("id", programIds).order("starts_on", { ascending: false }),
      supabase.from("program_mentors").select("program_id").in("program_id", programIds),
      supabase.from("program_mentees").select("program_id").in("program_id", programIds),
      supabase.from("program_tags").select("*").in("program_id", programIds),
    ]);
  if (pErr) throw pErr;

  const countBy = (rows: { program_id: string }[] | null) => {
    const m: Record<string, number> = {};
    (rows || []).forEach((r) => (m[r.program_id] = (m[r.program_id] || 0) + 1));
    return m;
  };
  const mc = countBy(mentors as any);
  const ec = countBy(mentees as any);
  const tagsBy: Record<string, ProgramTag[]> = {};
  (tags || []).forEach((t) => (tagsBy[t.program_id] = [...(tagsBy[t.program_id] || []), t]));

  return (programs || []).map((p) => ({
    ...p,
    mentor_count: mc[p.id] || 0,
    mentee_count: ec[p.id] || 0,
    tags: tagsBy[p.id] || [],
  }));
}

export type ProgramOverview = {
  program: Program;
  mentors: ProgramMember[];
  tags: ProgramTag[];
  assignedMentor: ProgramMember | null;
};

/**
 * One-shot fetch for the mentee program detail page.
 * Returns program + mentor list + tags + the mentee's assigned mentor.
 */
export async function fetchMenteeProgramOverview(
  slug: string,
  menteeId: string,
): Promise<ProgramOverview | null> {
  const program = await fetchProgramBySlug(slug);
  if (!program) return null;
  const [mentors, tags, assignedMentor] = await Promise.all([
    fetchProgramMentors(program.id),
    fetchProgramTags(program.id),
    fetchMyAssignedMentor(program.id, menteeId),
  ]);
  return { program, mentors, tags, assignedMentor };
}

export async function fetchProgramBySlug(slug: string): Promise<Program | null> {
  const { data, error } = await supabase.from("programs").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data;
}

export type ProgramMember = { id: string; full_name: string; email: string; avatar_url: string | null };

export async function fetchProgramMentors(programId: string): Promise<ProgramMember[]> {
  const { data: rows } = await supabase
    .from("program_mentors")
    .select("mentor_id")
    .eq("program_id", programId);
  const ids = Array.from(new Set((rows || []).map((r) => r.mentor_id).filter(Boolean)));
  if (ids.length === 0) return [];
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, email, avatar_url")
    .in("id", ids)
    .order("full_name");
  return (users || []) as ProgramMember[];
}

export async function fetchProgramMentees(programId: string): Promise<ProgramMember[]> {
  const { data: rows } = await supabase
    .from("program_mentees")
    .select("mentee_id")
    .eq("program_id", programId);
  const ids = Array.from(new Set((rows || []).map((r) => r.mentee_id).filter(Boolean)));
  if (ids.length === 0) return [];
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, email, avatar_url")
    .in("id", ids)
    .eq("is_disabled", false)
    .order("full_name");
  return (users || []) as ProgramMember[];
}

export async function fetchProgramTags(programId: string): Promise<ProgramTag[]> {
  const { data } = await supabase
    .from("program_tags")
    .select("*")
    .eq("program_id", programId)
    .order("label");
  return data || [];
}

/**
 * For a given mentee in a program, return the assigned mentor (if any).
 */
export async function fetchMyAssignedMentor(programId: string, menteeId: string) {
  const { data: row } = await supabase
    .from("mentor_mentee_assignments")
    .select("mentor_id")
    .eq("program_id", programId)
    .eq("mentee_id", menteeId)
    .maybeSingle();
  if (!row?.mentor_id) return null;
  const { data: u } = await supabase
    .from("users")
    .select("id, full_name, email, avatar_url")
    .eq("id", row.mentor_id)
    .maybeSingle();
  return u as ProgramMember | null;
}

/**
 * For a given mentor in a program, return the explicit 1:1 assigned mentees.
 */
export async function fetchMyAssignedMentees(
  programId: string,
  mentorId: string,
): Promise<ProgramMember[]> {
  const { data: rows } = await supabase
    .from("mentor_mentee_assignments")
    .select("mentee_id")
    .eq("program_id", programId)
    .eq("mentor_id", mentorId);
  const ids = Array.from(new Set((rows || []).map((r) => r.mentee_id).filter(Boolean)));
  if (ids.length === 0) return [];
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, email, avatar_url")
    .in("id", ids)
    .eq("is_disabled", false)
    .order("full_name");
  return (users || []) as ProgramMember[];
}
