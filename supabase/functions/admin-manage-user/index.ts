// Admin user management — create (invite or temp password), disable, restore.
// Uses service-role internally so it never hijacks the admin's auth session.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { SENDER_EMAIL, escapeHtml, getEmailBranding, renderEmail, type EmailBranding } from "../_shared/emailLayout.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Action = "create" | "disable" | "restore" | "delete" | "bulk_invite" | "resend_invite" | "list_pending_invites";
type AppRole = "admin" | "mentor" | "mentee";
type Mode = "invite" | "password";

// Re-inviting an address that was invited but never accepted is allowed by
// GoTrue: it reuses the same user and invalidates the previous link. Once the
// invite is accepted, a re-invite is refused ("already registered").

interface BulkRow {
  email?: string;
  full_name?: string;
  role?: AppRole;
}

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
  // bulk_invite
  rows?: BulkRow[];
  filename?: string;
  // list_pending_invites
  page?: number;
  page_size?: number;
  search?: string;
}

const MAX_PER_UPLOAD = 20;
const MAX_PER_DAY = 100;

// Invite volume is capped per IST day, not per UTC day — a UTC boundary would
// reset the quota at 5:30 AM local and read as a bug to whoever is watching.
const istDayStartUtc = (): string => {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowIst = new Date(Date.now() + IST_OFFSET_MS);
  const midnightIst = Date.UTC(
    nowIst.getUTCFullYear(),
    nowIst.getUTCMonth(),
    nowIst.getUTCDate(),
  );
  return new Date(midnightIst - IST_OFFSET_MS).toISOString();
};

const joinUrl = (base: string, path: string) =>
  base.endsWith("/") ? `${base}${path}` : `${base}/${path}`;

const json = (body: unknown, status = 200) => {
  if (body && typeof body === "object" && "error" in body) {
    console.error("admin-manage-user error:", body.error);
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
};

function getAppUrl(req: Request, branding?: any): string {
  // 1. Check database-configured site URL first
  if (branding?.site_url) {
    const dbUrl = branding.site_url.trim();
    if (dbUrl && !dbUrl.includes("localhost") && !dbUrl.includes("127.0.0.1")) {
      return dbUrl.startsWith("http") ? dbUrl : `https://${dbUrl}`;
    }
  }

  // 2. Check custom environment variable
  const envUrl = Deno.env.get("APP_URL") || Deno.env.get("SITE_URL") || Deno.env.get("PUBLIC_APP_URL");
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
  }

  // 3. Fallback to Origin or Referer header if not localhost or internal Supabase URL
  const origin = req.headers.get("origin") || req.headers.get("referer") || "";
  if (origin && !origin.includes("localhost") && !origin.includes("127.0.0.1") && !origin.includes("supabase.co") && !origin.includes("supabase.in")) {
    try {
      const parsed = new URL(origin);
      return parsed.origin;
    } catch (_) {
      // ignore
    }
  }

  // 4. Detect if running local supabase instance
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  if (supabaseUrl.includes("localhost") || supabaseUrl.includes("127.0.0.1")) {
    try {
      if (origin) return new URL(origin).origin;
    } catch (_) {
      // ignore
    }
    if (envUrl) return envUrl;
    return "http://localhost:5173";
  }

  // 5. Production fallback
  return "https://mentorle.vercel.app/";
}

interface InviteCtx {
  // deno-lint-ignore no-explicit-any
  admin: any;
  appUrl: string;
  branding: EmailBranding;
  brevoKey: string;
}

// Single invite: auth link + Brevo email + mentor placeholder application.
// Shared by the one-off "create" action and the CSV "bulk_invite" loop so both
// paths stay identical.
async function inviteOne(
  ctx: InviteCtx,
  email: string,
  full_name: string,
  role: AppRole,
  opts: { resend?: boolean } = {},
): Promise<{ ok: boolean; userId: string | null; error?: string }> {
  const isResend = !!opts.resend;
  const redirectUrl = joinUrl(ctx.appUrl, "reset-password");

  const { data: linkData, error: inviteErr } = await ctx.admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { data: { full_name, role }, redirectTo: redirectUrl },
  });
  if (inviteErr || !linkData?.properties?.hashed_token) {
    return { ok: false, userId: null, error: inviteErr?.message ?? "Failed to generate invitation link" };
  }

  // The emailed link points at our own page carrying the hashed token, not at
  // GoTrue's /verify action_link. The action_link is consumed by the first GET,
  // so mail scanners and in-app browser previews burn it before the invitee
  // ever clicks. Our page redeems the token from JS on a real user click.
  const acceptUrl =
    `${redirectUrl}?token_hash=${encodeURIComponent(linkData.properties.hashed_token)}` +
    `&type=invite`;

  const userId = linkData.user?.id ?? null;

  // Stamp the authoritative role into app_metadata (service-role only), so when
  // the invitee confirms their email the role is honoured even for 'admin'.
  // handle_new_user only trusts user_metadata for mentor/mentee.
  if (userId) {
    await ctx.admin.auth.admin.updateUserById(userId, { app_metadata: { role } }).catch(() => {});
  }

  const appName = ctx.branding.appName;
  const html = renderEmail({
    branding: ctx.branding,
    heading: isResend
      ? `Your invitation to join ${appName}`
      : `You've been invited to join ${appName}`,
    intro: isResend
      ? `Hello ${escapeHtml(full_name)}, here is a fresh link to finish setting up your <strong>${escapeHtml(appName)}</strong> account as a <strong>${escapeHtml(role)}</strong>. Any earlier invitation link is no longer valid.`
      : `Hello ${escapeHtml(full_name)}, you have been invited to join <strong>${escapeHtml(appName)}</strong> as a <strong>${escapeHtml(role)}</strong>. Use the button below to accept the invitation and set your password.`,
    cta: { label: "Accept invitation", url: acceptUrl },
    note: "This link can only be used once. If you were not expecting this invitation you can safely ignore this email.",
  });

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": ctx.brevoKey,
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: SENDER_EMAIL, name: appName },
      to: [{ email, name: full_name }],
      subject: isResend
        ? `Your invitation to join ${appName}`
        : `Invitation to join ${appName} as a ${role}`,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, userId, error: `Brevo error ${res.status}: ${text}` };
  }

  // Re-inviting someone still pending (resend, or the same address in a later
  // CSV) must not create a second placeholder application.
  const { count: existingApps } = await ctx.admin
    .from("mentor_applications")
    .select("id", { count: "exact", head: true })
    .eq("email", email.toLowerCase());
  if (role === "mentor" && !isResend && !existingApps) {
    // 'invited' (not 'changes_requested') so the mentor's dashboard shows
    // onboarding wording rather than "the admin reviewed and requested changes".
    const { error: appErr } = await ctx.admin.from("mentor_applications").insert({
      full_name,
      email: email.toLowerCase(),
      bio: "",
      status: "invited",
    });
    if (appErr) console.error("Failed to create placeholder mentor application:", appErr);
  }

  return { ok: true, userId };
}

// deno-lint-ignore no-explicit-any
async function buildInviteCtx(admin: any, req: Request): Promise<InviteCtx | { error: string }> {
  const brevoKey = Deno.env.get("BREVO_API_KEY");
  if (!brevoKey) return { error: "BREVO_API_KEY not configured" };

  const { data: brandingRow } = await admin.from("branding").select("*").limit(1).maybeSingle();
  return {
    admin,
    appUrl: getAppUrl(req, brandingRow),
    branding: await getEmailBranding(admin, brandingRow),
    brevoKey: brevoKey.trim(),
  };
}

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
        const ctx = await buildInviteCtx(admin, req);
        if ("error" in ctx) return json({ error: ctx.error }, 500);

        const result = await inviteOne(ctx, email, full_name, role);
        if (!result.ok) return json({ error: result.error }, 400);
        userId = result.userId;
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
          app_metadata: { role },
        });
        if (error) return json({ error: error.message }, 400);
        userId = data.user?.id ?? null;

        // If the created user is a mentor, create a placeholder application in the
        // 'invited' state so their dashboard shows onboarding, not review, wording.
        if (role === "mentor") {
          const { error: appErr } = await admin.from("mentor_applications").insert({
            full_name,
            email: email.toLowerCase(),
            bio: "",
            status: "invited",
          });
          if (appErr) {
            console.error("Failed to create placeholder mentor application:", appErr);
          }
        }
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

    if (action === "list_pending_invites") {
      const pending: { id: string; email: string; full_name: string; role: string; invited_at: string | null }[] = [];
      for (let page = 1; page <= 50; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) return json({ error: error.message }, 500);
        for (const u of data.users) {
          if (u.email_confirmed_at || !u.invited_at) continue;
          const meta = (u.user_metadata ?? {}) as { full_name?: string; role?: string };
          const app = (u.app_metadata ?? {}) as { role?: string };
          pending.push({
            id: u.id,
            email: u.email ?? "",
            full_name: meta.full_name ?? "",
            role: app.role ?? meta.role ?? "mentee",
            invited_at: u.invited_at ?? null,
          });
        }
        if (data.users.length < 1000) break;
      }
      const search = String(body.search ?? "").trim().toLowerCase().slice(0, 100);
      const roleFilter = ["admin", "mentor", "mentee"].includes(body.role ?? "") ? body.role : null;
      const matches = pending.filter((p) =>
        (!roleFilter || p.role === roleFilter) &&
        (!search || p.email.toLowerCase().includes(search) || p.full_name.toLowerCase().includes(search))
      );
      matches.sort((a, b) => (b.invited_at ?? "").localeCompare(a.invited_at ?? ""));
      const pageSize = Math.min(100, Math.max(1, Math.floor(Number(body.page_size) || 25)));
      const page = Math.max(0, Math.floor(Number(body.page) || 0));
      return json({
        ok: true,
        invites: matches.slice(page * pageSize, (page + 1) * pageSize),
        total: matches.length,
      });
    }

    if (action === "resend_invite") {
      const userId = (body.user_id ?? "").trim();
      if (!userId) return json({ error: "user_id is required" }, 400);

      // Pending invitees have no public.users row yet (it is created when they
      // accept), so the target is read from auth directly.
      const { data: authData, error: authErr } = await admin.auth.admin.getUserById(userId);
      if (authErr || !authData?.user?.email) return json({ error: "Invitation not found" }, 404);
      const au = authData.user;
      if (au.email_confirmed_at) {
        return json({ error: "This user has already accepted their invitation" }, 400);
      }
      const target = {
        email: au.email as string,
        full_name: ((au.user_metadata ?? {}) as { full_name?: string }).full_name ?? "",
      };
      const claimed = ((au.app_metadata ?? {}) as { role?: string }).role ?? ((au.user_metadata ?? {}) as { role?: string }).role;
      const role = (["admin", "mentor", "mentee"].includes(claimed ?? "") ? claimed : "mentee") as AppRole;

      const ctx = await buildInviteCtx(admin, req);
      if ("error" in ctx) return json({ error: ctx.error }, 500);

      const result = await inviteOne(ctx, target.email, target.full_name, role, { resend: true });
      if (!result.ok) return json({ error: result.error }, 400);

      await admin.from("audit_logs").insert({
        user_id: callerId,
        action: "USER_INVITE_RESENT",
        entity_type: "users",
        entity_id: userId,
        details: { email: target.email, role },
      });

      return json({ ok: true, user_id: userId });
    }

    if (action === "bulk_invite") {
      const rawRows = Array.isArray(body.rows) ? body.rows : [];
      if (rawRows.length === 0) return json({ error: "No rows supplied" }, 400);
      if (rawRows.length > MAX_PER_UPLOAD) {
        return json({ error: `A single upload is limited to ${MAX_PER_UPLOAD} invites` }, 400);
      }

      // Validate and de-duplicate before touching the network. Bulk creation of
      // admins is deliberately not supported — that stays a one-at-a-time action.
      const seen = new Set<string>();
      const parsed: { email: string; full_name: string; role: AppRole }[] = [];
      for (const [i, r] of rawRows.entries()) {
        const email = (r.email ?? "").trim().toLowerCase();
        const full_name = (r.full_name ?? "").trim();
        const role = r.role;
        if (!email || !full_name || !role) {
          return json({ error: `Row ${i + 1}: name, email and role are required` }, 400);
        }
        if (role !== "mentor" && role !== "mentee") {
          return json({ error: `Row ${i + 1}: role must be mentee or mentor` }, 400);
        }
        if (seen.has(email)) continue;
        seen.add(email);
        parsed.push({ email, full_name, role });
      }

      const ctx = await buildInviteCtx(admin, req);
      if ("error" in ctx) return json({ error: ctx.error }, 500);

      // Existing accounts are skipped rather than failed — generateLink errors
      // on a duplicate email and that is not something the admin can act on.
      const { data: existing } = await admin
        .from("users")
        .select("email")
        .in("email", parsed.map((r) => r.email));
      const existingEmails = new Set((existing ?? []).map((u: { email: string }) => u.email.toLowerCase()));

      const { count: sentToday } = await admin
        .from("invite_batch_rows")
        .select("id", { count: "exact", head: true })
        .eq("status", "sent")
        .gte("created_at", istDayStartUtc());

      let remaining = Math.max(0, MAX_PER_DAY - (sentToday ?? 0));

      const { data: batch, error: batchErr } = await admin
        .from("invite_batches")
        .insert({
          uploaded_by: callerId,
          filename: body.filename ?? null,
          total_rows: parsed.length,
        })
        .select("id")
        .single();
      if (batchErr) return json({ error: batchErr.message }, 500);

      const results: {
        email: string;
        status: "sent" | "failed" | "skipped_duplicate";
        error_message: string | null;
      }[] = [];

      // Sequential on purpose: 20 parallel Brevo calls risk rate limiting, and a
      // single failure must never abort the rest of the batch.
      for (const row of parsed) {
        if (existingEmails.has(row.email)) {
          results.push({ email: row.email, status: "skipped_duplicate", error_message: "An account already exists for this email" });
          continue;
        }
        if (remaining <= 0) {
          results.push({ email: row.email, status: "failed", error_message: `Daily limit of ${MAX_PER_DAY} invites reached` });
          continue;
        }
        const r = await inviteOne(ctx, row.email, row.full_name, row.role);
        if (r.ok) {
          remaining--;
          results.push({ email: row.email, status: "sent", error_message: null });
        } else {
          results.push({ email: row.email, status: "failed", error_message: r.error ?? "Invite failed" });
        }
      }

      const rowsToInsert = parsed.map((row, i) => ({
        batch_id: batch.id,
        email: row.email,
        full_name: row.full_name,
        role: row.role,
        status: results[i].status,
        error_message: results[i].error_message,
      }));
      const { error: rowsErr } = await admin.from("invite_batch_rows").insert(rowsToInsert);
      if (rowsErr) console.error("Failed to record invite batch rows:", rowsErr);

      const sent = results.filter((r) => r.status === "sent").length;
      const failed = results.filter((r) => r.status === "failed").length;
      const skipped = results.filter((r) => r.status === "skipped_duplicate").length;

      await admin
        .from("invite_batches")
        .update({ sent_count: sent, failed_count: failed, skipped_count: skipped })
        .eq("id", batch.id);

      await admin.from("audit_logs").insert({
        user_id: callerId,
        action: "USERS_BULK_INVITED",
        entity_type: "invite_batches",
        entity_id: batch.id,
        details: { total: parsed.length, sent, failed, skipped, filename: body.filename ?? null },
      });

      return json({
        ok: true,
        batch_id: batch.id,
        sent,
        failed,
        skipped,
        remaining_today: Math.max(0, remaining),
        results: parsed.map((row, i) => ({
          email: row.email,
          full_name: row.full_name,
          role: row.role,
          status: results[i].status,
          error_message: results[i].error_message,
        })),
      });
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

      // Actually block sign-in: flip the flag AND ban/unban the auth user so
      // existing sessions cannot keep operating and the user cannot log back in.
      const { error: banErr } = await admin.auth.admin.updateUserById(targetId, {
        ban_duration: disabling ? "876000h" : "none",
      });
      if (banErr) console.error("Failed to update auth ban state:", banErr.message);

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
