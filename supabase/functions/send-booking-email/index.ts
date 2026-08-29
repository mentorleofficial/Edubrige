// Send booking confirmation emails via Brevo (transactional email API).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { SENDER_EMAIL, escapeHtml, getEmailBranding, renderEmail, detailRows, type EmailBranding } from "../_shared/emailLayout.ts";
// Triggered from BookSession.tsx after a successful booking.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};


interface Recipient {
  email: string;
  name?: string;
}

interface Payload {
  mentorEmail: string;
  mentorName: string;
  menteeEmail: string;
  menteeName: string;
  scheduledAtISO: string;
  durationMinutes: number;
  meetingUrl: string;
  menteeNotes?: string;
}


const toCalDate = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
};

const buildGoogleCalendarUrl = (p: {
  title: string;
  details: string;
  location: string;
  startISO: string;
  durationMinutes: number;
}) => {
  const end = new Date(new Date(p.startISO).getTime() + p.durationMinutes * 60_000).toISOString();
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: p.title,
    dates: `${toCalDate(p.startISO)}/${toCalDate(end)}`,
    details: p.details,
    location: p.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

// All emails show times in IST (Asia/Kolkata) regardless of recipient locale.
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
  audience: "mentor" | "mentee";
  recipientName: string;
  otherPartyName: string;
  whenLabel: string;
  durationMinutes: number;
  meetingUrl: string;
  calendarUrl: string;
  menteeNotes?: string;
}) => {
  const { branding, audience, recipientName, otherPartyName, whenLabel, durationMinutes, meetingUrl, calendarUrl, menteeNotes } = opts;

  const notes =
    audience === "mentor" && menteeNotes
      ? `<div style="margin-top:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;font-size:13px;color:${branding.body};">
           <strong style="color:${branding.heading};">What they'd like to discuss:</strong><br/>${escapeHtml(menteeNotes)}
         </div>`
      : "";

  const calendar = calendarUrl
    ? `<p style="margin:12px 0 0;font-size:13px;"><a href="${escapeHtml(calendarUrl)}" style="color:${branding.primary};">Add to Google Calendar</a></p>`
    : "";

  return renderEmail({
    branding,
    heading:
      audience === "mentee"
        ? `Your session with ${escapeHtml(otherPartyName)} is confirmed`
        : `New session booked with ${escapeHtml(otherPartyName)}`,
    intro:
      audience === "mentee"
        ? `Hi ${escapeHtml(recipientName)}, your mentorship session is booked. Details are below — add it to your calendar so you don't forget.`
        : `Hi ${escapeHtml(recipientName)}, ${escapeHtml(otherPartyName)} just booked a mentorship session with you.`,
    bodyHtml:
      detailRows(branding, [
        ["When", whenLabel],
        ["Duration", `${durationMinutes} minutes`],
        [audience === "mentee" ? "Mentor" : "Mentee", otherPartyName],
      ]) + notes + calendar,
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
    const rawKey = Deno.env.get("BREVO_API_KEY");
    if (!rawKey) {
      return new Response(JSON.stringify({ error: "BREVO_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const apiKey = rawKey.trim();

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const branding = await getEmailBranding(admin);

    console.log("BREVO_API_KEY debug:", {
      length: apiKey.length,
      prefix: apiKey.slice(0, 9),
      startsWithXkeysib: apiKey.startsWith("xkeysib-"),
    });

    const body = (await req.json()) as Payload;
    const required: (keyof Payload)[] = ["mentorEmail", "mentorName", "menteeEmail", "menteeName", "scheduledAtISO", "durationMinutes", "meetingUrl"];
    for (const k of required) {
      if (body[k] === undefined || body[k] === null || body[k] === "") {
        return new Response(JSON.stringify({ error: `Missing field: ${k}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const whenLabel = formatDateTime(body.scheduledAtISO);

    const menteeCalendarUrl = buildGoogleCalendarUrl({
      title: `Mentorship session with ${body.mentorName}`,
      details: `Meeting link: ${body.meetingUrl}`,
      location: body.meetingUrl,
      startISO: body.scheduledAtISO,
      durationMinutes: body.durationMinutes,
    });

    const mentorCalendarUrl = buildGoogleCalendarUrl({
      title: `Mentorship session with ${body.menteeName}`,
      details: [
        `Meeting link: ${body.meetingUrl}`,
        body.menteeNotes ? `Mentee asked: ${body.menteeNotes}` : "",
      ].filter(Boolean).join("\n"),
      location: body.meetingUrl,
      startISO: body.scheduledAtISO,
      durationMinutes: body.durationMinutes,
    });

    const menteeHtml = buildEmailHtml({
      branding,
      audience: "mentee",
      recipientName: body.menteeName,
      otherPartyName: body.mentorName,
      whenLabel,
      durationMinutes: body.durationMinutes,
      meetingUrl: body.meetingUrl,
      calendarUrl: menteeCalendarUrl,
    });

    const mentorHtml = buildEmailHtml({
      branding,
      audience: "mentor",
      recipientName: body.mentorName,
      otherPartyName: body.menteeName,
      whenLabel,
      durationMinutes: body.durationMinutes,
      meetingUrl: body.meetingUrl,
      calendarUrl: mentorCalendarUrl,
      menteeNotes: body.menteeNotes,
    });

    const results = await Promise.allSettled([
      sendBrevo(apiKey, branding.appName, {
        to: { email: body.menteeEmail, name: body.menteeName },
        subject: `Session confirmed with ${body.mentorName} — ${whenLabel}`,
        html: menteeHtml,
      }),
      sendBrevo(apiKey, branding.appName, {
        to: { email: body.mentorEmail, name: body.mentorName },
        subject: `New session booked: ${body.menteeName} — ${whenLabel}`,
        html: mentorHtml,
      }),
    ]);

    const errors = results.flatMap((r, i) =>
      r.status === "rejected" ? [{ to: i === 0 ? "mentee" : "mentor", error: String(r.reason) }] : []
    );
    if (errors.length) console.error("Brevo send errors:", errors);

    return new Response(JSON.stringify({ ok: errors.length === 0, errors }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-booking-email error:", e);
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
