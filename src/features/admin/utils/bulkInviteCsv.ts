import Papa from "papaparse";
import type { AppRole } from "../api/users";

export const MAX_PER_UPLOAD = 20;
export const MAX_PER_DAY = 100;

export type InviteRole = Extract<AppRole, "mentor" | "mentee">;

export interface ParsedInviteRow {
  line: number;
  full_name: string;
  email: string;
  role: InviteRole | null;
  error: string | null;
}

export interface ParseResult {
  rows: ParsedInviteRow[];
  fatalError: string | null;
}

export const CSV_TEMPLATE = [
  "Name,Email,Role",
  "Priya Sharma,priya@example.com,mentee",
  "Rahul Verma,rahul@example.com,mentor",
].join("\r\n");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BOM = String.fromCharCode(0xfeff);

const normalizeHeader = (h: string) =>
  h.replace(BOM, "").trim().toLowerCase();

export function parseInviteCsv(text: string): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeHeader,
  });

  const headers = parsed.meta.fields ?? [];
  for (const required of ["name", "email", "role"]) {
    if (!headers.includes(required)) {
      return { rows: [], fatalError: `Missing required column "${required}". Expected headers: Name, Email, Role.` };
    }
  }

  const seen = new Set<string>();
  const rows: ParsedInviteRow[] = [];

  parsed.data.forEach((raw, i) => {
    const full_name = (raw.name ?? "").trim();
    const email = (raw.email ?? "").trim().toLowerCase();
    const roleRaw = (raw.role ?? "").trim().toLowerCase();

    if (!full_name && !email && !roleRaw) return;

    let error: string | null = null;
    let role: InviteRole | null = null;

    if (!full_name) error = "Name is required";
    else if (!email) error = "Email is required";
    else if (!EMAIL_RE.test(email)) error = "Invalid email address";
    else if (!roleRaw) error = "Role is required";
    else if (roleRaw !== "mentor" && roleRaw !== "mentee") error = `Role must be mentee or mentor (got "${roleRaw}")`;
    else if (seen.has(email)) error = "Duplicate email in this file";
    else role = roleRaw;

    if (email && !error) seen.add(email);

    rows.push({ line: i + 2, full_name, email, role, error });
  });

  if (rows.length === 0) return { rows: [], fatalError: "The file has no data rows." };

  return { rows, fatalError: null };
}

export function downloadCsvTemplate(filename = "bulk-invite-template.csv") {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
