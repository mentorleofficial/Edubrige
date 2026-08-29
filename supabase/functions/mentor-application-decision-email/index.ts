// Sends mentor application decision emails (approved/rejected/changes_requested) via Brevo.
import { SENDER_EMAIL, escapeHtml, getEmailBranding, renderEmail, type EmailBranding } from "../_shared/emailLayout.ts";
// Called from the admin flow after a decision is recorded.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Decision = "approved" | "rejected" | "changes_requested";


const notesBlock = (branding: EmailBranding, notes: string) =>
  notes
    ? `<div style="margin-top:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;font-size:13px;color:${branding.body};">
         <strong style="color:${branding.heading};">Reviewer notes:</strong><br/>${escapeHtml(notes)}
       </div>`
    : "";

const buildApprovedHtml = (branding: EmailBranding, recipientName: string, notes: string, loginUrl: string) => {
  const appName = escapeHtml(branding.appName);
  return renderEmail({
    branding,
    heading: `Welcome to the ${appName} Mentorship Program`,
    intro:
      `Dear ${escapeHtml(recipientName)},<br/><br/><strong>Congratulations!</strong> Your application to become a mentor with ${appName} has been approved. ` +
      `We are excited to welcome you to the programme, where your knowledge, experience, and guidance can help learners build confidence and move closer to their goals.`,
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:${branding.body};">
        As an approved mentor, you may be invited to support learners through mentoring conversations, career guidance, industry insights, portfolio or interview preparation, and other activities based on your expertise.
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;font-size:14px;color:${branding.body};">
        <strong style="color:${branding.heading};display:block;margin-bottom:8px;">Next steps</strong>
        <ul style="margin:0;padding-left:18px;line-height:1.8;">
          <li>Our team will connect with you to complete the mentor onboarding process.</li>
          <li>You may be asked to confirm your availability, mentoring areas, and preferred mode of engagement.</li>
          <li>Once onboarding is complete, suitable mentoring opportunities will be shared with you.</li>
        </ul>
      </div>
      ${notesBlock(branding, notes)}
      <p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:${branding.body};">
        We look forward to working with you.<br/><br/>Warm regards,<br/><strong>Team ${appName}</strong>
      </p>`,
    cta: { label: "Sign in", url: loginUrl },
  });
};

const buildHtml = (branding: EmailBranding, recipientName: string, decision: Decision, notes: string, loginUrl: string) => {
  if (decision === "approved") return buildApprovedHtml(branding, recipientName, notes, loginUrl);
  const appName = escapeHtml(branding.appName);
  return renderEmail({
    branding,
    heading:
      decision === "rejected"
        ? `Update on your ${appName} mentor application`
        : `We need a few more details on your ${appName} application`,
    intro:
      decision === "rejected"
        ? `Hi ${escapeHtml(recipientName)}, thank you for applying to mentor on ${appName}. After review, we are unable to move forward with your application at this time.`
        : `Hi ${escapeHtml(recipientName)}, thanks for applying. Before we can approve your application we need some additional information.`,
    bodyHtml: notesBlock(branding, notes),
    cta: decision === "changes_requested" ? { label: "Open dashboard", url: loginUrl } : undefined,
  });
};

// deno-lint-ignore no-explicit-any
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
    const emailBranding = await getEmailBranding(admin, branding);
    const appName = emailBranding.appName;

    const appUrl = getAppUrl(req, branding);
    const loginUrl = new URL("/login", appUrl).toString();

    const html = buildHtml(emailBranding, app.full_name, decision!, notes, loginUrl);
    const subject =
      decision === "approved" ? `Welcome to ${appName} Mentorship Program`
      : decision === "rejected" ? `Update on your ${appName} application`
      : `Action needed on your ${appName} application`;

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": BREVO.trim(), accept: "application/json" },
      body: JSON.stringify({
        sender: { email: SENDER_EMAIL, name: appName },
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
