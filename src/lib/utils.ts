import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Only http(s) links may be rendered as clickable hrefs. Anything else (e.g. a
// javascript: URL a mentor typed) yields undefined, so the link is not clickable.
export function safeHttpUrl(url: string | null | undefined): string | undefined {
  const trimmed = (url ?? "").trim();
  return /^https?:\/\/\S+$/i.test(trimmed) ? trimmed : undefined;
}

export function ensureAbsoluteUrl(url: string | null | undefined): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }
  return `https://${trimmed}`;
}
