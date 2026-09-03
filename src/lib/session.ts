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

// getSession() reads localStorage and never calls the server, so it cannot tell
// that a session was revoked remotely — only that one is missing entirely. That
// case is still worth catching: supabase-js silently falls back to the anon key
// when there is no session, which reaches the server as a baffling JWT error
// instead of a recognisable 401.
export async function assertLocalSession(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw await endDeadSession();
}
