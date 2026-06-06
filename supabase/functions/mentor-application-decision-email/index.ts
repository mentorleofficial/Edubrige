// Sends mentor application decision emails (approved/rejected/changes_requested) via Brevo.
// Called from the admin flow after a decision is recorded.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Decision = "approved" | "rejected" | "changes_requested";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const buildHtml = (appName: string, recipientName: string, decision: Decision, notes: string, loginUrl: string) => {
  const safeNotes = notes ? escapeHtml(notes) : "";
  const heading =
    decision === "approved" ? `Welcome aboard, ${escapeHtml(recipientName)}!`
    : decision === "rejected" ? `Update on your ${escapeHtml(appName)} mentor application`
    : `We need a few more details on your ${escapeHtml(appName)} application`;

  const intro =
    decision === "approved"
      ? `Your application to mentor on ${escapeHtml(appName)} has been approved. You can now sign in, complete your profile, and start accepting bookings.`
      : decision === "rejected"
        ? `Thank you for applying to mentor on ${escapeHtml(appName)}. After review, we're unable to move forward with your application at this time.`
        : `Thanks for applying! Before we can approve your application, we need some additional information.`;

  const cta =
    decision === "approved"
      ? `<tr><td align="center" style="padding:8px 24px 0;">
           <a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">Sign in</a>
         </td></tr>`
      : decision === "changes_requested"
        ? `<tr><td align="center" style="padding:8px 24px 0;">
             <a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">Open Dashboard</a>
           </td></tr>`
        : "";

  const notesBlock = safeNotes
    ? `<tr><td style="padding:16px 24px 0;">
         <div style="background:#f8fafc;border-radius:8px;padding:14px 16px;font-size:14px;color:#334155;">
           <strong style="color:#0f172a;">Reviewer notes:</strong><br/>${safeNotes}
         </div>
       </td></tr>` : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${heading}</title></head>
  <body style="margin:0;padding:0;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;padding:32px 16px;">
      <tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
          <tr><td style="padding:28px 24px 8px;">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;">${heading}</h1>
            <p style="margin:0;font-size:14px;line-height:1.5;color:#475569;">${intro}</p>
          </td></tr>
          ${notesBlock}
          ${cta}
          <tr><td style="background:#f8fafc;padding:16px 24px;text-align:center;font-size:11px;color:#94a3b8;margin-top:24px;">
            Sent by ${escapeHtml(appName)}.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const BREVO = Deno.env.get("BREVO_API_KEY");
    if (!BREVO) {
      return new Response(JSON.stringify({ error: "BREVO_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const application_id: string | undefined = body?.application_id;
    const decision: Decision | undefined = body?.decision;
    const notes: string = String(body?.notes ?? "");
    if (!application_id || !["approved", "rejected", "changes_requested"].includes(decision ?? "")) {
      return new Response(JSON.stringify({ error: "application_id and valid decision required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: app } = await admin
      .from("mentor_applications")
      .select("id, email, full_name")
      .eq("id", application_id).maybeSingle();
    if (!app) {
      return new Response(JSON.stringify({ error: "Application not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: branding } = await admin
      .from("branding").select("*").limit(1).maybeSingle();
    const appName = branding?.app_name || "Mentorship Platform";

    const appUrl = getAppUrl(req, branding);
    const loginUrl = new URL("/login", appUrl).toString();

    const html = buildHtml(appName, app.full_name, decision!, notes, loginUrl);
    const subject =
      decision === "approved" ? `You're approved to mentor on ${appName}`
      : decision === "rejected" ? `Update on your ${appName} application`
      : `Action needed on your ${appName} application`;

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": BREVO.trim(), accept: "application/json" },
      body: JSON.stringify({
        sender: { email: "noreply@mentorle.in", name: appName },
        to: [{ email: app.email, name: app.full_name }],
        subject,
        htmlContent: html,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return new Response(JSON.stringify({ error: `Brevo ${res.status}: ${text}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.from("audit_logs").insert({
      user_id: u.user.id,
      action: "mentor_application_decision_email",
      entity_type: "mentor_applications",
      entity_id: application_id,
      details: { decision, email: app.email },
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
