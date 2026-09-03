import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { SENDER_EMAIL, escapeHtml, getEmailBranding, renderEmail, type EmailBranding } from "../_shared/emailLayout.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};


interface Recipient {
  email: string;
  name?: string;
}


const getSiteUrl = (branding: any): string => {
  if (branding?.site_url) {
    const url = branding.site_url.trim();
    if (url) return url.startsWith("http") ? url : `https://${url}`;
  }
  return "https://mentorle.vercel.app/";
};

const buildEmailHtml = (opts: {
  branding: EmailBranding;
  recipientName: string;
  otherPartyName: string;
  sessionTitle: string;
  feedbackUrl: string;
  role: "mentor" | "mentee";
}) => {
  const { branding, recipientName, otherPartyName, sessionTitle, feedbackUrl, role } = opts;
  const topic = escapeHtml(sessionTitle || "your topic");
  return renderEmail({
    branding,
    heading:
      role === "mentee"
        ? `How was your session with ${escapeHtml(otherPartyName)}?`
        : `How did your session with ${escapeHtml(otherPartyName)} go?`,
    intro:
      role === "mentee"
        ? `Hi ${escapeHtml(recipientName)}, we hope you had a great mentorship session on "${topic}" with ${escapeHtml(otherPartyName)}.`
        : `Hi ${escapeHtml(recipientName)}, we hope your mentorship session on "${topic}" with ${escapeHtml(otherPartyName)} went well.`,
    bodyHtml: `<p style="margin:0;font-size:14px;line-height:1.6;color:${branding.body};">${
      role === "mentee"
        ? "Please take 60 seconds to rate your experience. Your feedback helps your mentor grow and helps other mentees find outstanding guidance."
        : "Please take 60 seconds to rate your experience and share notes on the mentee's engagement. Your rating is private to admins."
    }</p>`,
    cta: { label: role === "mentee" ? "Share your feedback" : "Rate your mentee", url: feedbackUrl },
  });
};

const sendBrevo = async (apiKey: string, senderName: string, args: {
  to: Recipient;
  subject: string;
  html: string;
}) => {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: SENDER_EMAIL, name: senderName },
      to: [{ email: args.to.email, name: args.to.name || args.to.email }],
      subject: args.subject,
      htmlContent: args.html,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo ${res.status}: ${text}`);
  }
  return res.json();
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const BREVO = Deno.env.get("BREVO_API_KEY");

    if (!BREVO) {
      return new Response(JSON.stringify({ error: "BREVO_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { session_id } = body;
    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Fetch session and user details
    const { data: session, error: fetchErr } = await admin
      .from("sessions")
      .select(`
        id,
        title,
        status,
        mentor:users!sessions_mentor_id_fkey(email, full_name),
        mentee:users!sessions_mentee_id_fkey(email, full_name)
      `)
      .eq("id", session_id)
      .single();

    if (fetchErr || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch platform branding details
    const { data: branding } = await admin
      .from("branding")
      .select("*")
      .limit(1)
      .maybeSingle();

    const emailBranding = await getEmailBranding(admin, branding);
    const appName = emailBranding.appName;
    const siteUrl = getSiteUrl(branding);

    const { mentee, mentor } = session;
    if (!mentee || !mentor) {
      return new Response(JSON.stringify({ error: "Mentee or Mentor details not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build URL pointing to: https://<site-url>/session/<id>/feedback
    const feedbackUrl = `${siteUrl.replace(/\/$/, "")}/session/${session_id}/feedback`;

    const menteeHtml = buildEmailHtml({
      branding: emailBranding,
      recipientName: mentee.full_name,
      otherPartyName: mentor.full_name,
      sessionTitle: session.title,
      feedbackUrl,
      role: "mentee",
    });

    const mentorHtml = buildEmailHtml({
      branding: emailBranding,
      recipientName: mentor.full_name,
      otherPartyName: mentee.full_name,
      sessionTitle: session.title,
      feedbackUrl,
      role: "mentor",
    });

    // Send emails via Brevo to both mentee and mentor
    const results = await Promise.allSettled([
      sendBrevo(BREVO.trim(), appName, {
        to: { email: mentee.email, name: mentee.full_name },
        subject: `How was your session with ${mentor.full_name}?`,
        html: menteeHtml,
      }),
      sendBrevo(BREVO.trim(), appName, {
        to: { email: mentor.email, name: mentor.full_name },
        subject: `How did your session with ${mentee.full_name} go?`,
        html: mentorHtml,
      }),
    ]);

    const errors = results.flatMap((r, i) =>
      r.status === "rejected" ? [{ to: i === 0 ? "mentee" : "mentor", error: String(r.reason) }] : []
    );
    if (errors.length) console.error("Brevo feedback request send errors:", errors);

    return new Response(JSON.stringify({ success: errors.length === 0, errors }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-feedback-request error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
