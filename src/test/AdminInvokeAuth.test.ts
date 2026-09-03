import { describe, it, expect, vi, beforeEach } from "vitest";
import { FunctionsHttpError } from "@supabase/supabase-js";

const invoke = vi.fn();
const signOut = vi.fn();
const assign = vi.fn();

let session: { access_token: string } | null = null;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session } }),
      signOut: (...a: unknown[]) => signOut(...a),
    },
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
  },
}));

const { bulkInvite } = await import("@/features/admin/api/users");

const httpError = (status: number, body: unknown) =>
  new FunctionsHttpError(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );

const rows = [{ email: "a@b.com", full_name: "A", role: "mentee" as const }];

beforeEach(() => {
  vi.clearAllMocks();
  session = { access_token: "at" };
  signOut.mockResolvedValue({ error: null });
  vi.stubGlobal("location", { pathname: "/admin/users", search: "", assign });
});

describe("invokeAdmin auth handling", () => {
  it("signs out locally and redirects to login when the token is rejected", async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(401, { error: "Unauthorized: Auth session missing!" }) });

    await expect(bulkInvite(rows)).rejects.toThrow(/session has expired/i);

    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(assign).toHaveBeenCalledWith(
      "/login?expired=1&redirect=" + encodeURIComponent("/admin/users"),
    );
  });

  it("surfaces a 403 without signing the user out", async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(403, { error: "Forbidden: caller is not an admin" }) });

    await expect(bulkInvite(rows)).rejects.toThrow("Forbidden: caller is not an admin");

    expect(signOut).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  // Real status codes hide the response body behind FunctionsHttpError, so the
  // message has to be read back out or every failure reads "non-2xx status code".
  it("keeps the server's message on a 400", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: httpError(400, { error: "A single upload is limited to 20 invites" }),
    });

    await expect(bulkInvite(rows)).rejects.toThrow("A single upload is limited to 20 invites");
  });

  it("redirects instead of invoking when no session is stored", async () => {
    session = null;

    await expect(bulkInvite(rows)).rejects.toThrow(/session has expired/i);

    expect(invoke).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalled();
  });

  it("returns the payload on success", async () => {
    invoke.mockResolvedValue({ data: { ok: true, sent: 1 }, error: null });

    await expect(bulkInvite(rows)).resolves.toEqual({ ok: true, sent: 1 });
    expect(assign).not.toHaveBeenCalled();
  });
});
