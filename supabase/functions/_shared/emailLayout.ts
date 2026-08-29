// Shared branded email shell for every transactional email.
//
// Branding (name, logo, colours) is read from the `branding` table at send
// time, so changing it in Admin -> Settings updates emails without a redeploy.
// Colours are stored as "H S% L%" triplets for CSS variables; email clients
// need literal hex, hence the conversion below.

export const SENDER_EMAIL = "noreply@mentorle.in";

const FALLBACK = {
  appName: "EduBridge MentorConnect",
  primary: "#1e3a8a",
  heading: "#0d0d0d",
  body: "#475569",
};

export const escapeHtml = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function hslToHex(hsl: string | null | undefined, fallback: string): string {
  if (typeof hsl !== "string") return fallback;
  const m = hsl.trim().match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!m) return fallback;
  const h = parseFloat(m[1]) / 360;
  const s = parseFloat(m[2]) / 100;
  const l = parseFloat(m[3]) / 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export interface EmailBranding {
  appName: string;
  logoUrl: string | null;
  primary: string;
  heading: string;
  body: string;
}

/** Pass `row` when the caller has already fetched branding, to avoid a second query. */
// deno-lint-ignore no-explicit-any
export async function getEmailBranding(admin: any, row?: any): Promise<EmailBranding> {
  const data = row ?? (await admin.from("branding").select("*").limit(1).maybeSingle()).data;
  return {
    appName: data?.app_name || FALLBACK.appName,
    logoUrl: data?.logo_url || null,
    primary: hslToHex(data?.primary_color, FALLBACK.primary),
    // Columns added later than the rest of the table; tolerate their absence.
    heading: hslToHex(data?.heading_text_color, FALLBACK.heading),
    body: hslToHex(data?.body_text_color, FALLBACK.body),
  };
}

export interface EmailCta {
  label: string;
  url: string;
}

export interface RenderEmailArgs {
  branding: EmailBranding;
  /** Bold line at the top of the card. */
  heading: string;
  /** Lead paragraph. Pre-escaped HTML — callers escape their own values. */
  intro: string;
  /** Optional extra markup between intro and CTA (detail tables, lists). */
  bodyHtml?: string;
  cta?: EmailCta;
  /** Small print under the CTA, above the footer. */
  note?: string;
}

/**
 * Table-based layout — email clients (Outlook especially) do not lay out
 * flexbox or grid reliably, and strip <style> blocks, so everything is inline.
 */
export function renderEmail({ branding, heading, intro, bodyHtml, cta, note }: RenderEmailArgs): string {
  const { appName, logoUrl, primary, heading: headingColor, body: bodyColor } = branding;
  const safeName = escapeHtml(appName);

  const logoBlock = logoUrl
    ? `<tr><td align="center" style="padding:28px 24px 0;">
         <img src="${escapeHtml(logoUrl)}" alt="${safeName}" height="40"
              style="height:40px;width:auto;max-width:200px;display:block;border:0;outline:none;text-decoration:none;" />
       </td></tr>`
    : `<tr><td align="center" style="padding:28px 24px 0;">
         <span style="font-size:18px;font-weight:700;color:${headingColor};">${safeName}</span>
       </td></tr>`;

  const ctaBlock = cta
    ? `<tr><td align="center" style="padding:24px 24px 4px;">
         <a href="${escapeHtml(cta.url)}"
            style="display:inline-block;background:${primary};color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:600;font-size:14px;">${escapeHtml(cta.label)}</a>
       </td></tr>
       <tr><td align="center" style="padding:0 24px 8px;">
         <span style="font-size:11px;color:${bodyColor};word-break:break-all;">Or paste this link: ${escapeHtml(cta.url)}</span>
       </td></tr>`
    : "";

  const noteBlock = note
    ? `<tr><td style="padding:4px 24px 8px;">
         <p style="margin:0;font-size:12px;line-height:1.5;color:${bodyColor};">${note}</p>
       </td></tr>`
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" role="presentation"
             style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        ${logoBlock}
        <tr><td style="padding:20px 24px 8px;">
          <h1 style="margin:0 0 12px;font-size:21px;font-weight:700;line-height:1.3;color:${headingColor};">${escapeHtml(heading)}</h1>
          <p style="margin:0;font-size:14px;line-height:1.6;color:${bodyColor};">${intro}</p>
        </td></tr>
        ${bodyHtml ? `<tr><td style="padding:8px 24px 0;">${bodyHtml}</td></tr>` : ""}
        ${ctaBlock}
        ${noteBlock}
        <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 24px;text-align:center;">
          <span style="font-size:11px;color:${bodyColor};">Sent by ${safeName}.</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** Bordered key/value block used by booking, reminder and feedback emails. */
export function detailRows(branding: EmailBranding, rows: [string, string][]): string {
  const cells = rows
    .map(
      ([k, v]) =>
        `<tr>
           <td style="padding:6px 0;font-size:13px;color:${branding.body};white-space:nowrap;">${escapeHtml(k)}</td>
           <td style="padding:6px 0 6px 16px;font-size:13px;font-weight:600;color:${branding.heading};">${escapeHtml(v)}</td>
         </tr>`,
    )
    .join("");
  return `<table cellpadding="0" cellspacing="0" role="presentation"
                 style="width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;">
            ${cells}
          </table>`;
}
