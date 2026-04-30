import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export type AdminUserRow = {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  created_at: string;
  is_disabled: boolean;
  mentor_profiles: { is_active: boolean }[] | null;
};

export type RoleFilter = AppRole | "all";
export type StatusFilter = "all" | "active" | "disabled";

export type FetchUsersParams = {
  page: number;
  pageSize: number;
  role: RoleFilter;
  status?: StatusFilter;
};

export type FetchUsersResult = {
  rows: AdminUserRow[];
  total: number;
};

export async function fetchAdminUsers({
  page,
  pageSize,
  role,
  status = "active",
}: FetchUsersParams): Promise<FetchUsersResult> {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("users")
    .select(
      "id, full_name, email, role, created_at, is_disabled, mentor_profiles(is_active)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (role !== "all") query = query.eq("role", role);
  if (status === "active") query = query.eq("is_disabled", false);
  else if (status === "disabled") query = query.eq("is_disabled", true);

  const { data, error, count } = await query;
  if (error) throw error;

  const rows: AdminUserRow[] = (data ?? []).map((u: any) => ({
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    role: u.role,
    created_at: u.created_at,
    is_disabled: !!u.is_disabled,
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
  full_name: string;
  role: AppRole;
  mode: "invite" | "password";
  password?: string;
};

async function invokeAdmin(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("admin-manage-user", { body });
  if (error) throw error;
  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String((data as { error: string }).error));
  }
  return data;
}

export async function createUser(input: CreateUserInput) {
  return invokeAdmin({ action: "create", ...input });
}

export async function setUserDisabled(userId: string, disabled: boolean) {
  return invokeAdmin({
    action: disabled ? "disable" : "restore",
    user_id: userId,
  });
}
