import { supabase } from "@/integrations/supabase/client";

export const SESSION_EXPIRED_MESSAGE = "Your session has expired. Please sign in again.";

export class SessionExpiredError extends Error {
  constructor(message = SESSION_EXPIRED_MESSAGE) {
    super(message);
    this.name = "SessionExpiredError";
  }
}

// Full page load rather than a router navigate: the dead session is mirrored in
// AuthContext state and the React Query cache, and a reload is the only way to
// be sure none of it survives the redirect.
export async function endDeadSession(): Promise<SessionExpiredError> {
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    const redirect = window.location.pathname + window.location.search;
    window.location.assign(`/login?expired=1&redirect=${encodeURIComponent(redirect)}`);
  }
  return new SessionExpiredError();
}

// The server rejects every request from a deactivated account (see the
// block_disabled_users pre-request hook) with this message, and GoTrue refuses
// banned users with "User is banned".
export function isDeactivatedError(error: unknown): boolean {
  const e = error as { message?: unknown; hint?: unknown } | null;
  const text = `${e?.message ?? ""} ${e?.hint ?? ""}`;
  return /account has been deactivated|account_deactivated|user is banned/i.test(text);
}

let endingDeactivated = false;
export async function endDeactivatedSession(): Promise<void> {
  if (endingDeactivated) return;
  endingDeactivated = true;
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  try {
    localStorage.removeItem("app:lastAuth");
  } catch {
    /* noop */
  }
  if (typeof window !== "undefined") window.location.assign("/login?error=deactivated");
}

// getSession() reads localStorage and never calls the server, so it cannot tell
// that a session was revoked remotely — only that one is missing entirely. That
// case is still worth catching: supabase-js silently falls back to the anon key
// when there is no session, which reaches the server as a baffling JWT error
// instead of a recognisable 401.
export async function assertLocalSession(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw await endDeadSession();
}
