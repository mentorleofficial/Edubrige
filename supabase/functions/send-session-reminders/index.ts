import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SENDER_EMAIL, escapeHtml, getEmailBranding, renderEmail, detailRows, type EmailBranding } from "../_shared/emailLayout.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};


interface Recipient {
  email: string;
  name?: string;
}


const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  const formatted = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return `${formatted} IST`;
};

const buildEmailHtml = (opts: {
  branding: EmailBranding;
  role: "mentor" | "mentee";
  recipientName: string;
  otherPartyName: string;
  sessionTitle: string;
  whenLabel: string;
  meetingUrl: string;
  durationMinutes: number;
}) => {
  const { branding, role, recipientName, otherPartyName, sessionTitle, whenLabel, meetingUrl, durationMinutes } = opts;
  return renderEmail({
    branding,
    heading: "Your session starts in 30 minutes",
    intro:
      role === "mentee"
        ? `Hi ${escapeHtml(recipientName)}, this is a reminder that your mentorship session with ${escapeHtml(otherPartyName)} starts in 30 minutes.`
        : `Hi ${escapeHtml(recipientName)}, this is a reminder that you have a mentorship session with ${escapeHtml(otherPartyName)} starting in 30 minutes.`,
    bodyHtml: detailRows(branding, [
      ["Session", sessionTitle],
      ["When", whenLabel],
      ["Duration", `${durationMinutes} minutes`],
      [role === "mentee" ? "Mentor" : "Mentee", otherPartyName],
    ]),
    cta: meetingUrl ? { label: "Join meeting", url: meetingUrl } : undefined,
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

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Query sessions starting in 30 minutes (window of 25 to 35 minutes from now)
    // that have not yet had a reminder sent.
    const now = new Date();
    const branding = await getEmailBranding(admin);

    const minTime = new Date(now.getTime() + 25 * 60 * 1000).toISOString();
    const maxTime = new Date(now.getTime() + 35 * 60 * 1000).toISOString();

    const { data: sessions, error: fetchErr } = await admin
      .from("sessions")
      .select(`
        id,
        title,
        scheduled_at,
        duration_minutes,
        meeting_url,
        mentor:users!sessions_mentor_id_fkey(email, full_name),
        mentee:users!sessions_mentee_id_fkey(email, full_name)
      `)
      .eq("status", "booked")
      .is("reminder_sent_at", null)
      .gte("scheduled_at", minTime)
      .lte("scheduled_at", maxTime);

    if (fetchErr) throw fetchErr;

    const count = sessions?.length || 0;
    console.log(`Found ${count} sessions requiring reminders.`);

    if (count === 0) {
      return new Response(JSON.stringify({ success: true, message: "No reminders due" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const errors: any[] = [];
    for (const session of sessions || []) {
      const { id, title, scheduled_at, duration_minutes, meeting_url, mentor, mentee } = session;
      const whenLabel = formatDateTime(scheduled_at);

      if (!mentor || !mentee) {
        console.warn(`Session ${id} missing mentor or mentee relation.`);
        continue;
      }

      const menteeHtml = buildEmailHtml({
        branding,
        role: "mentee",
        recipientName: mentee.full_name,
        otherPartyName: mentor.full_name,
        sessionTitle: title,
        whenLabel,
        meetingUrl: meeting_url,
        durationMinutes: duration_minutes,
      });

      const mentorHtml = buildEmailHtml({
        branding,
        role: "mentor",
        recipientName: mentor.full_name,
        otherPartyName: mentee.full_name,
        sessionTitle: title,
        whenLabel,
        meetingUrl: meeting_url,
        durationMinutes: duration_minutes,
      });

      // Send emails
      const emailResults = await Promise.allSettled([
        sendBrevo(BREVO.trim(), branding.appName, {
          to: { email: mentee.email, name: mentee.full_name },
          subject: `Reminder: Session starting in 30 minutes — ${whenLabel}`,
          html: menteeHtml,
        }),
        sendBrevo(BREVO.trim(), branding.appName, {
          to: { email: mentor.email, name: mentor.full_name },
          subject: `Reminder: Session starting in 30 minutes — ${whenLabel}`,
          html: mentorHtml,
        }),
      ]);

      const failed = emailResults.some((r) => r.status === "rejected");
      if (failed) {
        console.error(`Failed to send email reminders for session ${id}`, emailResults);
        errors.push({ session_id: id, details: emailResults });
      }

      // Mark reminder as sent regardless of individual Brevo delivery errors to prevent infinite spam loops
      const { error: updateErr } = await admin
        .from("sessions")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", id);

      if (updateErr) {
        console.error(`Failed to update reminder_sent_at for session ${id}`, updateErr);
      }
    }

    return new Response(JSON.stringify({ success: errors.length === 0, count, errors }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-session-reminders error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
