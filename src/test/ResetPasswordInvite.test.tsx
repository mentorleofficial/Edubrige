import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";
import ResetPassword from "@/pages/ResetPassword";

const navigate = vi.fn();
const verifyOtp = vi.fn();
const setSession = vi.fn();
const exchangeCodeForSession = vi.fn();
const updateUser = vi.fn();
const signOut = vi.fn();

// Mirrors GoTrue closely enough to matter here: a successful redemption is what
// puts a session in the store, and getSession reads that store back.
let session: { access_token: string } | null = null;
const SESSION = { access_token: "at" };

vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/contexts/BrandingContext", () => ({
  useBranding: () => ({ app_name: "Edubridge", logo_url: null, login_bg_url: null }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session } }),
      verifyOtp: (...a: unknown[]) => verifyOtp(...a),
      setSession: (...a: unknown[]) => setSession(...a),
      exchangeCodeForSession: (...a: unknown[]) => exchangeCodeForSession(...a),
      updateUser: (...a: unknown[]) => updateUser(...a),
      signOut: (...a: unknown[]) => signOut(...a),
    },
  },
}));

const setUrl = (search: string, hash = "") => {
  window.history.replaceState({}, "", `/reset-password${search}${hash}`);
};

const redeemsSuccessfully = () => {
  session = null;
  const ok = async () => {
    session = SESSION;
    return { error: null };
  };
  verifyOtp.mockImplementation(ok);
  setSession.mockImplementation(ok);
  exchangeCodeForSession.mockImplementation(ok);
};

const submitPassword = () => {
  fireEvent.change(screen.getByLabelText("New Password"), { target: { value: "hunter2hunter2" } });
  fireEvent.change(screen.getByLabelText("Confirm Password"), { target: { value: "hunter2hunter2" } });
  fireEvent.click(screen.getByRole("button", { name: /set password/i }));
};

const expectsForm = () => waitFor(() => expect(screen.getByText("Set Password")).toBeInTheDocument());
const expectsErrorScreen = () =>
  waitFor(() => expect(screen.getByText("Link no longer valid")).toBeInTheDocument());

describe("ResetPassword invite handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session = null;
    signOut.mockResolvedValue({ error: null });
    updateUser.mockResolvedValue({ error: null });
    redeemsSuccessfully();
  });

  it("redeems a token_hash from the emailed link and shows the password form", async () => {
    setUrl("?token_hash=abc123&type=invite");

    render(<ResetPassword />);

    await expectsForm();
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "abc123", type: "invite" });
    expect(navigate).not.toHaveBeenCalled();
  });

  it("redeems the token even when a stale session is already stored", async () => {
    setUrl("?token_hash=abc123&type=invite");
    session = { access_token: "stale" };

    render(<ResetPassword />);

    await expectsForm();
    // The emailed token, not leftover browser state, decides whose password this sets.
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "abc123", type: "invite" });
  });

  it("shows a recoverable error screen when the token was already used", async () => {
    setUrl("?token_hash=spent&type=invite");
    verifyOtp.mockResolvedValue({ error: { code: "otp_expired", message: "Token has expired" } });

    render(<ResetPassword />);

    await expectsErrorScreen();
    expect(screen.getByText(/already been used or has expired/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /request a new link/i })).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("clears a stale session when the token cannot be redeemed", async () => {
    setUrl("?token_hash=spent&type=invite");
    session = { access_token: "stale" };
    verifyOtp.mockResolvedValue({ error: { code: "otp_expired", message: "expired" } });

    render(<ResetPassword />);

    await expectsErrorScreen();
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("shows the error screen when redemption reports success but sets no session", async () => {
    setUrl("?token_hash=abc123&type=invite");
    verifyOtp.mockResolvedValue({ error: null }); // resolves without populating the store

    render(<ResetPassword />);

    // Never render a form that updateUser would reject with "Auth session missing!".
    await expectsErrorScreen();
    expect(screen.queryByLabelText("New Password")).not.toBeInTheDocument();
  });

  it("reads GoTrue's error redirect params instead of bouncing to login", async () => {
    setUrl("?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid");

    render(<ResetPassword />);

    await expectsErrorScreen();
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("never leaks raw URL debug output into the UI", async () => {
    setUrl("?error_code=otp_expired");

    render(<ResetPassword />);

    await expectsErrorScreen();
    expect(screen.queryByText(/Hash:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Search:/)).not.toBeInTheDocument();
  });

  it("falls back to a stored session when the link carries no token", async () => {
    setUrl("");
    session = SESSION;

    render(<ResetPassword />);

    await expectsForm();
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("still supports the legacy implicit-flow hash tokens", async () => {
    setUrl("", "#access_token=at&refresh_token=rt&type=invite");

    render(<ResetPassword />);

    await expectsForm();
    expect(setSession).toHaveBeenCalledWith({ access_token: "at", refresh_token: "rt" });
  });

  it("still supports the legacy PKCE code exchange", async () => {
    setUrl("?code=xyz");

    render(<ResetPassword />);

    await expectsForm();
    expect(exchangeCodeForSession).toHaveBeenCalledWith("xyz");
  });

  it("shows the error screen when the link carries nothing usable", async () => {
    setUrl("");

    render(<ResetPassword />);

    await expectsErrorScreen();
  });

  it("recovers instead of dead-ending when the JWT sub claim no longer exists", async () => {
    setUrl("?token_hash=abc123&type=invite");
    updateUser.mockResolvedValue({
      error: { code: "user_not_found", message: "User from sub claim in JWT does not exist" },
    });

    render(<ResetPassword />);
    await expectsForm();
    submitPassword();

    await expectsErrorScreen();
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("recovers when updateUser reports a missing auth session", async () => {
    setUrl("?token_hash=abc123&type=invite");
    updateUser.mockResolvedValue({
      error: { name: "AuthSessionMissingError", message: "Auth session missing!" },
    });

    render(<ResetPassword />);
    await expectsForm();
    submitPassword();

    await expectsErrorScreen();
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("sets the password and routes onward on the happy path", async () => {
    setUrl("?token_hash=abc123&type=invite");

    render(<ResetPassword />);
    await expectsForm();
    submitPassword();

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: "hunter2hunter2" }));
    expect(screen.queryByText("Link no longer valid")).not.toBeInTheDocument();
  });
});
