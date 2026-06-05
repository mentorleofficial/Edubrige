// Admin user management — create (invite or temp password), disable, restore.
// Uses service-role internally so it never hijacks the admin's auth session.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Action = "create" | "disable" | "restore" | "delete";
type AppRole = "admin" | "mentor" | "mentee";
type Mode = "invite" | "password";

interface Payload {
  action: Action;
  // create
  email?: string;
  full_name?: string;
  role?: AppRole;
  mode?: Mode;
  password?: string;
  // disable / restore
  user_id?: string;
}

const json = (body: unknown, status = 200) => {
  if (body && typeof body === "object" && "error" in body) {
    console.error("admin-manage-user error:", body.error);
  }
  return new Response(JSON.stringify(body), {
    status: 200, // Always 200 to let client handle the error body directly
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized: Missing Authorization header" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized: " + (userErr?.message ?? "Invalid token") }, 401);
    const callerId = userData.user.id;

    // Service-role client (bypasses RLS for admin ops)
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Confirm admin role
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: callerId,
      _role: "admin",
    });
    if (roleErr) return json({ error: "Forbidden: check role RPC failed: " + roleErr.message }, 403);
    if (!isAdmin) return json({ error: "Forbidden: caller is not an admin" }, 403);

    const body = (await req.json().catch(() => ({}))) as Payload;
    const action = body.action;

    if (action === "create") {
      const email = (body.email ?? "").trim().toLowerCase();
      const full_name = (body.full_name ?? "").trim();
      const role = body.role;
      const mode: Mode = body.mode ?? "invite";
      if (!email || !full_name || !role) {
        return json({ error: "email, full_name and role are required" }, 400);
      }
      if (!["admin", "mentor", "mentee"].includes(role)) {
        return json({ error: "Invalid role" }, 400);
      }

      let userId: string | null = null;

      if (mode === "invite") {
        const redirectTo = `${new URL(req.url).origin.replace(/\/functions\/v1.*$/, "")}`;
        const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
          data: { full_name, role },
          redirectTo: req.headers.get("origin") ?? redirectTo,
        });
        if (error) return json({ error: error.message }, 400);
        userId = data.user?.id ?? null;
      } else {
        const password = body.password ?? "";
        if (password.length < 8) {
          return json({ error: "Password must be at least 8 characters" }, 400);
        }
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name, role },
        });
        if (error) return json({ error: error.message }, 400);
        userId = data.user?.id ?? null;
      }

      // The handle_new_user trigger inserts into public.users + user_roles using
      // the metadata above, so no extra writes required here.

      // Audit
      await admin.from("audit_logs").insert({
        user_id: callerId,
        action: "USER_CREATED",
        entity_type: "users",
        entity_id: userId ?? "",
        details: { email, full_name, role, mode },
      });

      return json({ ok: true, user_id: userId, mode });
    }

    if (action === "disable" || action === "restore") {
      const targetId = body.user_id;
      if (!targetId) return json({ error: "user_id is required" }, 400);
      if (targetId === callerId) return json({ error: "You cannot disable your own account" }, 400);

      const disabling = action === "disable";

      const { error: updErr } = await admin
        .from("users")
        .update({
          is_disabled: disabling,
          disabled_by: disabling ? callerId : null,
        })
        .eq("id", targetId);
      if (updErr) return json({ error: updErr.message }, 400);

      await admin.from("audit_logs").insert({
        user_id: callerId,
        action: disabling ? "USER_DISABLED" : "USER_RESTORED",
        entity_type: "users",
        entity_id: targetId,
        details: {},
      });

      return json({ ok: true });
    }

    if (action === "delete") {
      const targetId = body.user_id;
      if (!targetId) return json({ error: "user_id is required" }, 400);
      if (targetId === callerId) return json({ error: "You cannot delete your own account" }, 400);

      const { error: delErr } = await admin.auth.admin.deleteUser(targetId);
      if (delErr) return json({ error: delErr.message }, 400);

      await admin.from("audit_logs").insert({
        user_id: callerId,
        action: "USER_DELETED",
        entity_type: "users",
        entity_id: targetId,
        details: {},
      });

      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message ?? "Server error" }, 500);
  }
});
