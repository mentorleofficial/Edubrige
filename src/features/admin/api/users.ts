import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export type AdminUserRow = {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  created_at: string;
  mentor_profiles: { is_active: boolean }[] | null;
};

export type RoleFilter = AppRole | "all";

export type FetchUsersParams = {
  page: number;
  pageSize: number;
  role: RoleFilter;
};

export type FetchUsersResult = {
  rows: AdminUserRow[];
  total: number;
};

export async function fetchAdminUsers({
  page,
  pageSize,
  role,
}: FetchUsersParams): Promise<FetchUsersResult> {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("users")
    .select("id, full_name, email, role, created_at, mentor_profiles(is_active)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (role !== "all") {
    query = query.eq("role", role);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  // Supabase may return mentor_profiles as a single object (unique FK) or array.
  const rows: AdminUserRow[] = (data ?? []).map((u: any) => ({
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    role: u.role,
    created_at: u.created_at,
    mentor_profiles: Array.isArray(u.mentor_profiles)
      ? u.mentor_profiles
      : u.mentor_profiles
        ? [u.mentor_profiles]
        : [],
  }));

  return { rows, total: count ?? 0 };
}

export async function toggleMentorActive(userId: string, isActive: boolean) {
  const { error } = await supabase
    .from("mentor_profiles")
    .upsert({ user_id: userId, is_active: isActive }, { onConflict: "user_id" });
  if (error) throw error;
}

export type CreateUserInput = {
  email: string;
  password: string;
  full_name: string;
  role: AppRole;
};

export async function createUser(input: CreateUserInput) {
  const { error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { full_name: input.full_name, role: input.role } },
  });
  if (error) throw error;
}
