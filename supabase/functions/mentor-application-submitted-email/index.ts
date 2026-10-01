// Sends a "Thank you for applying" email to a mentor applicant via Brevo.
import { SENDER_EMAIL, escapeHtml, getEmailBranding, renderEmail, type EmailBranding } from "../_shared/emailLayout.ts";
// Called client-side (fire-and-forget) after a successful application insert.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};


const buildHtml = (branding: EmailBranding, recipientName: string) => {
  const appName = escapeHtml(branding.appName);
  return renderEmail({
    branding,
    heading: "Thank you for applying",
    intro:
      `Dear ${escapeHtml(recipientName)},<br/><br/>Thank you for applying to become a mentor with ${appName}. ` +
      `We are glad to see your interest in sharing your knowledge, experience, and guidance with learners who are preparing for their academic and career journeys.`,
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:${branding.body};">
        To proceed with your application, please complete your mentor profile by adding all required details such as your experience, expertise areas, current or previous work background, education, LinkedIn profile, and any relevant portfolio or resume.
      </p>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:${branding.body};">
        A complete profile will help our team review your application accurately and match you with the right mentoring opportunities.
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;font-size:14px;color:${branding.body};">
        <strong style="color:${branding.heading};display:block;margin-bottom:6px;">What happens next?</strong>
        Our team will evaluate your application based on your profile, expertise, experience, and mentoring interests. If your profile is shortlisted, we will get in touch with you for the next step.
      </div>
      <p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:${branding.body};">
        Thank you once again for your willingness to contribute to learner growth.<br/><br/>Warm regards,<br/>${appName}
      </p>`,
  });
};

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

    // Verify the caller is a logged-in user (not necessarily admin)
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const full_name: string = String(body?.full_name ?? "").trim().slice(0, 100);
    // The confirmation always goes to the signed-in applicant's own address —
    // never to an address supplied in the request — so this can't be used to
    // send platform email to arbitrary people.
    const email: string = String(u.user.email ?? "").trim().toLowerCase();
    const requested = String(body?.email ?? "").trim().toLowerCase();
    if (requested && requested !== email) {
      return new Response(JSON.stringify({ error: "You can only send this confirmation to your own email address" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!full_name || !email) {
      return new Response(JSON.stringify({ error: "full_name and email are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: branding } = await admin.from("branding").select("*").limit(1).maybeSingle();
    const emailBranding = await getEmailBranding(admin, branding);
    const appName = emailBranding.appName;

    const html = buildHtml(emailBranding, full_name);
    const subject = `Thank You for Applying to Become a Mentor with ${appName}`;

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": BREVO.trim(), accept: "application/json" },
      body: JSON.stringify({
        sender: { email: SENDER_EMAIL, name: appName },
        to: [{ email, name: full_name }],
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

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
