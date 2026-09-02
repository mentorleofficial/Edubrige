import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { EmailOtpType } from "@supabase/supabase-js";
import { useBranding } from "@/contexts/BrandingContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MailWarning } from "lucide-react";

const LINK_EXPIRED_MESSAGE =
  "This link has already been used or has expired. Invitation and reset links work only once.";

// A JWT left in localStorage can outlive the auth user it points at — the account
// was deleted and recreated, or the browser still holds a session from another
// Supabase project. GoTrue rejects the write rather than the read, so this only
// surfaces on submit.
const isStaleSessionError = (error: { code?: string; name?: string; message?: string }) =>
  error?.code === "user_not_found" ||
  error?.name === "AuthSessionMissingError" ||
  /sub claim|user from sub claim|user not found|auth session missing/i.test(error?.message ?? "");

const describeLinkError = (code: string, description?: string | null) => {
  const normalized = code.toLowerCase();
  if (
    normalized.includes("otp_expired") ||
    normalized.includes("expired") ||
    normalized.includes("access_denied") ||
    normalized.includes("invalid")
  ) {
    return LINK_EXPIRED_MESSAGE;
  }
  return description?.replace(/\+/g, " ") || LINK_EXPIRED_MESSAGE;
};

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);
  const branding = useBranding();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let isSubscribed = true;

    const finish = () => {
      if (isSubscribed) setIsCheckingSession(false);
    };
    // Rendering the form without a live session would let the user type a password
    // only to have updateUser reject it with "Auth session missing!", so every
    // redemption path confirms the session landed before showing the form.
    const finishIfSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) finish();
      else fail(LINK_EXPIRED_MESSAGE);
    };
    const fail = (message: string) => {
      if (isSubscribed) {
        setLinkError(message);
        setIsCheckingSession(false);
      }
    };

    const initializeSession = async () => {
      const search = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const param = (key: string) => search.get(key) ?? hash.get(key);

      // GoTrue reports a spent or malformed link by redirecting here with error
      // params rather than a session, so this has to be read before anything else.
      const errorCode = param("error_code") ?? param("error");
      if (errorCode) {
        fail(describeLinkError(errorCode, param("error_description")));
        return;
      }

      // The token identifies who this link is for, so it is redeemed before any
      // stored session is consulted. Trusting localStorage first would set the
      // password on whoever was last signed in on this browser — and if that
      // account has since been deleted, updateUser fails on a dead sub claim.
      const tokenHash = param("token_hash");
      const otpType = param("type");
      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: (otpType || "invite") as EmailOtpType,
        });
        if (error) {
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
          fail(describeLinkError(error.code ?? "", error.message));
          return;
        }
        await finishIfSession();
        return;
      }

      const { data: { session: existingSession } } = await supabase.auth.getSession();
      if (existingSession) {
        finish();
        return;
      }

      const access_token = hash.get("access_token");
      const refresh_token = hash.get("refresh_token");
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) {
          fail(describeLinkError(error.code ?? "", error.message));
          return;
        }
        await finishIfSession();
        return;
      }

      const code = search.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          fail(describeLinkError(error.code ?? "", error.message));
          return;
        }
        await finishIfSession();
        return;
      }

      await finishIfSession();
    };

    initializeSession();

    return () => {
      isSubscribed = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({
        variant: "destructive",
        title: "Validation error",
        description: "Password must be at least 8 characters long.",
      });
      return;
    }
    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Validation error",
        description: "Passwords do not match.",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast({
        title: "Password set successfully",
        description: "Your password has been saved. Redirecting to your dashboard…",
      });

      // Brief delay to allow profile trigger to finish
      setTimeout(() => {
        navigate("/dashboard");
      }, 1500);
    } catch (error: any) {
      if (isStaleSessionError(error)) {
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        setLinkError(
          "Your sign-in session is no longer valid. Open the most recent link from your email, or ask your administrator to resend your invitation."
        );
        return;
      }
      toast({
        variant: "destructive",
        title: "Error setting password",
        description: error.message || "Something went wrong. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const pageBackground = branding.login_bg_url
    ? { backgroundImage: `url(${branding.login_bg_url})`, backgroundSize: "cover", backgroundPosition: "center" }
    : undefined;

  const brandMark = branding.logo_url ? (
    <img src={branding.logo_url} alt={branding.app_name} className="h-12 w-12 mx-auto rounded-lg" />
  ) : (
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xl">
      M
    </div>
  );

  if (linkError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4" style={pageBackground}>
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="text-center space-y-3 pb-2">
            {brandMark}
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <MailWarning className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Link no longer valid</CardTitle>
            <CardDescription>{linkError}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              If you already set a password, sign in instead. Otherwise request a new link, or
              ask your administrator to resend your invitation.
            </p>
            <Button className="w-full" onClick={() => navigate("/forgot-password")}>
              Request a new link
            </Button>
            <Button variant="outline" className="w-full" onClick={() => navigate("/login")}>
              Back to sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4" style={pageBackground}>
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center space-y-3 pb-2">
          {brandMark}
          <CardTitle className="text-2xl">Set Password</CardTitle>
          <CardDescription>
            Enter a secure password for your new account on {branding.app_name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            {/* Fake fields to prevent browser autofill */}
            <input type="text" name="email" style={{ display: "none" }} />
            <input type="password" name="password" style={{ display: "none" }} />

            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Set Password & Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
