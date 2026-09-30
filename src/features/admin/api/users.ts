import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { assertLocalSession, endDeadSession } from "@/lib/session";

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
  search?: string;
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
  search,
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

  // Search across the whole result set, not just the current page. Strip
  // characters that would break the PostgREST or() filter grammar.
  const term = (search ?? "").trim().replace(/[,()%*]/g, " ").trim();
  if (term) {
    query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
  }

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
  await assertLocalSession();

  const { data, error } = await supabase.functions.invoke("admin-manage-user", { body });

  if (error) {
    const response = error instanceof FunctionsHttpError ? error.context : null;
    if (response instanceof Response) {
      // 401 means the token was rejected outright, so the session is gone even
      // though it still looks valid locally. 403 is a live session without the
      // rights for this action — surface that, do not sign the user out.
      if (response.status === 401) throw await endDeadSession();

      const payload = await response
        .clone()
        .json()
        .catch(() => null);
      // Functions reply { error }; the gateway replies { message } when a
      // function is unreachable. Surface either instead of the generic text.
      const reason = payload && typeof payload === "object"
        ? (payload as { error?: unknown; message?: unknown }).error ?? (payload as { message?: unknown }).message
        : null;
      if (reason) throw new Error(String(reason));
    }
    throw error;
  }

  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String((data as { error: string }).error));
  }
  return data;
}

export async function createUser(input: CreateUserInput) {
  return invokeAdmin({ action: "create", ...input });
}

export type BulkInviteRow = {
  email: string;
  full_name: string;
  role: Extract<AppRole, "mentor" | "mentee">;
};

export type BulkInviteResultRow = BulkInviteRow & {
  status: "sent" | "failed" | "skipped_duplicate";
  error_message: string | null;
};

export type BulkInviteResult = {
  ok: true;
  batch_id: string;
  sent: number;
  failed: number;
  skipped: number;
  remaining_today: number;
  results: BulkInviteResultRow[];
};

export async function bulkInvite(rows: BulkInviteRow[], filename?: string): Promise<BulkInviteResult> {
  return (await invokeAdmin({ action: "bulk_invite", rows, filename })) as BulkInviteResult;
}

export async function setUserDisabled(userId: string, disabled: boolean) {
  return invokeAdmin({
    action: disabled ? "disable" : "restore",
    user_id: userId,
  });
}

export type PendingInvite = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  invited_at: string | null;
};

// Invitations that haven't been accepted yet. These people have no profile row
// until they accept, so they never appear in the regular Users list.
export type PendingInvitesParams = {
  page: number;
  pageSize: number;
  role: RoleFilter;
  search?: string;
};

export async function listPendingInvites(
  params: PendingInvitesParams,
): Promise<{ rows: PendingInvite[]; total: number }> {
  const data = (await invokeAdmin({
    action: "list_pending_invites",
    page: params.page,
    page_size: params.pageSize,
    role: params.role === "all" ? undefined : params.role,
    search: params.search || undefined,
  })) as { invites?: PendingInvite[]; total?: number };
  const rows = data?.invites ?? [];
  return { rows, total: data?.total ?? rows.length };
}

export async function resendInvite(userId: string) {
  return invokeAdmin({
    action: "resend_invite",
    user_id: userId,
  });
}

export async function deleteUser(userId: string) {
  return invokeAdmin({
    action: "delete",
    user_id: userId,
  });
}

export type AdminUserDetails = {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  avatar_url: string | null;
  created_at: string;
  is_disabled: boolean;
  profile: any;
};

export async function fetchUserProfileAdmin(userId: string, role: AppRole): Promise<AdminUserDetails> {
  const { data: u, error: uErr } = await supabase
    .from("users")
    .select("id, full_name, email, role, avatar_url, created_at, is_disabled")
    .eq("id", userId)
    .single();

  if (uErr) throw uErr;

  let profile: any = null;
  if (role === "mentor") {
    const { data: p, error: pErr } = await supabase
      .from("mentor_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (pErr) throw pErr;
    profile = p;
  } else if (role === "mentee") {
    const { data: p, error: pErr } = await supabase
      .from("mentee_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (pErr) throw pErr;
    profile = p;
  }

  return {
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    role: u.role as AppRole,
    avatar_url: u.avatar_url,
    created_at: u.created_at,
    is_disabled: !!u.is_disabled,
    profile,
  };
}
