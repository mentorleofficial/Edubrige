import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, X, Upload, Loader2, Mail, Eye, EyeOff, FileText, Plus } from "lucide-react";

const urlOrEmpty = z
  .string()
  .trim()
  .transform((v) => v.replace(/\/+$/, ""))
  .pipe(z.string().url("Must be a valid URL").or(z.literal("")));

const phoneRegex = /^[+\d][\d\s\-().]{6,19}$/;

const schema = z.object({
  full_name: z.string().trim().min(2, "Required").max(100)
    .refine((v) => !["admin", "mentor", "mentee"].includes(v.toLowerCase()), "Please enter your real name"),
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  phone: z.string().trim().regex(phoneRegex, "Enter a valid phone number").or(z.literal("")),
  linkedin_url: urlOrEmpty.refine(
    (v) => !v || /linkedin\.com\/(in|pub)\//i.test(v),
    "Must be a linkedin.com/in/… or /pub/… URL"
  ),
  portfolio_url: urlOrEmpty,
  twitter_url: urlOrEmpty,
  github_url: urlOrEmpty,
  bio: z.string().trim().min(50, "Bio must be at least 50 characters").max(2000),
  years_experience: z.coerce.number({ invalid_type_error: "Required" }).int().min(0, "Must be 0+").max(60, "Max 60"),
});

type FormValues = z.infer<typeof schema>;
type Step = "form" | "otp" | "done";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const formatBytes = (n: number) => (n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

const MentorApplicationDialog = ({ open, onOpenChange }: Props) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [expertise, setExpertise] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [resume, setResume] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [submitting, setSubmitting] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // pending data we hold until OTP is verified
  const [pending, setPending] = useState<{
    values: FormValues;
    resumePath: string;
  } | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      full_name: "", email: "", password: "", phone: "",
      linkedin_url: "", portfolio_url: "", twitter_url: "", github_url: "",
      bio: "", years_experience: undefined as unknown as number,
    },
  });

  // resend cooldown
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const resetAll = () => {
    setStep("form");
    form.reset();
    setExpertise([]);
    setTagInput("");
    setResume(null);
    setOtp("");
    setPending(null);
    setShowPassword(false);
    setResendIn(0);
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (expertise.length >= 10) {
      toast({ variant: "destructive", title: "Maximum 10 expertise tags" });
      return;
    }
    if (expertise.some((e) => e.toLowerCase() === t.toLowerCase())) {
      toast({ variant: "destructive", title: "Tag already added" });
      return;
    }
    setExpertise([...expertise, t]);
    setTagInput("");
  };

  const handleFile = (f: File | null) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "Resume must be under 5MB" });
      return;
    }
    const okType = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!okType.includes(f.type)) {
      toast({ variant: "destructive", title: "Resume must be PDF or DOC/DOCX" });
      return;
    }
    setResume(f);
  };

  const onSubmit = async (values: FormValues) => {
    if (expertise.length === 0) {
      toast({ variant: "destructive", title: "Add at least one expertise tag" });
      return;
    }
    if (!resume) {
      toast({ variant: "destructive", title: "Please upload your resume" });
      return;
    }

    setSubmitting(true);
    try {
      // 1) Upload resume
      const ext = resume.name.split(".").pop();
      const resumePath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("mentor-resumes").upload(resumePath, resume, {
        contentType: resume.type,
      });
      if (upErr) throw upErr;

      // 2) Sign up — sends OTP email
      const { error: signUpErr } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: { full_name: values.full_name, role: "mentor" },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (signUpErr) {
        const msg = signUpErr.message?.toLowerCase() ?? "";
        if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
          toast({
            variant: "destructive",
            title: "Email already registered",
            description: "An account with this email exists. Please log in instead.",
          });
          return;
        }
        throw signUpErr;
      }

      setPending({ values, resumePath });
      setStep("otp");
      setResendIn(60);
      toast({ title: "Check your email", description: `We sent a verification code to ${values.email}` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Submission failed", description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const verifyOtp = async () => {
    if (!pending || otp.length !== 8) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: pending.values.email,
        token: otp,
        type: "signup",
      });
      if (error) throw error;
      const userId = data.user?.id;
      if (!userId) throw new Error("Verification failed — no user returned");

      // Insert mentor_application
      const { error: insErr } = await supabase.from("mentor_applications").insert({
        full_name: pending.values.full_name,
        email: pending.values.email,
        phone: pending.values.phone || null,
        linkedin_url: pending.values.linkedin_url || null,
        portfolio_url: pending.values.portfolio_url || null,
        social_links: {
          twitter: pending.values.twitter_url || null,
          github: pending.values.github_url || null,
        },
        bio: pending.values.bio,
        expertise,
        years_experience: pending.values.years_experience,
        resume_url: pending.resumePath,
      });
      if (insErr) console.error("application insert failed", insErr);

      // Insert mentor_profile (inactive)
      const { error: profErr } = await supabase.from("mentor_profiles").upsert(
        {
          user_id: userId,
          bio: pending.values.bio,
          expertise,
          years_experience: pending.values.years_experience,
          linkedin_url: pending.values.linkedin_url || "",
          is_active: false,
        },
        { onConflict: "user_id" }
      );
      if (profErr) console.error("mentor_profile insert failed", profErr);

      setStep("done");
      toast({ title: "Email verified!", description: "Redirecting to your dashboard…" });
      setTimeout(() => {
        handleClose(false);
        navigate("/dashboard");
      }, 1200);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Invalid code", description: err.message });
    } finally {
      setVerifying(false);
    }
  };

  const resendOtp = async () => {
    if (!pending || resendIn > 0) return;
    const { error } = await supabase.auth.resend({ type: "signup", email: pending.values.email });
    if (error) {
      toast({ variant: "destructive", title: "Could not resend", description: error.message });
      return;
    }
    setResendIn(60);
    toast({ title: "Code resent", description: `New code sent to ${pending.values.email}` });
  };

  const handleClose = (v: boolean) => {
    if (!v) resetAll();
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {step === "done" ? (
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <DialogTitle className="text-2xl">You're in!</DialogTitle>
            <DialogDescription className="text-base">Redirecting to your dashboard…</DialogDescription>
          </div>
        ) : step === "otp" ? (
          <div className="py-4 space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-7 w-7 text-primary" />
              </div>
              <DialogTitle className="text-2xl">Verify your email</DialogTitle>
              <DialogDescription>
                Enter the verification code we sent to{" "}
                <span className="font-medium text-foreground">{pending?.values.email}</span>
              </DialogDescription>
            </div>

            <div className="flex justify-center">
              <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} className="h-11 w-11 text-lg" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            <div className="space-y-2">
              <Button onClick={verifyOtp} disabled={otp.length !== 6 || verifying} className="w-full" size="lg">
                {verifying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying…</> : "Verify & continue"}
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                Didn't receive it?{" "}
                <button
                  type="button"
                  onClick={resendOtp}
                  disabled={resendIn > 0}
                  className="text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
                >
                  {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Apply to become a Mentor</DialogTitle>
              <DialogDescription>
                Create your account and submit your application. We'll send a verification code to your email.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-2">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Account</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Full name <span className="text-destructive">*</span></Label>
                    <Input placeholder="Jane Doe" {...form.register("full_name")} />
                    {form.formState.errors.full_name && <p className="text-xs text-destructive">{form.formState.errors.full_name.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email <span className="text-destructive">*</span></Label>
                    <Input type="email" autoComplete="email" placeholder="you@example.com" {...form.register("email")} />
                    {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Password <span className="text-destructive">*</span> <span className="text-xs font-normal text-muted-foreground">(min 8 chars)</span></Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        className="pr-10"
                        {...form.register("password")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input
                      type="tel"
                      inputMode="tel"
                      placeholder="+1 555 123 4567"
                      {...form.register("phone")}
                      onInput={(e) => {
                        const el = e.currentTarget;
                        const cleaned = el.value.replace(/[^0-9+\-\s().]/g, "");
                        if (cleaned !== el.value) el.value = cleaned;
                      }}
                    />
                    {form.formState.errors.phone && <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Already have an account? <Link to="/login" className="text-primary underline">Sign in</Link>
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Professional</h3>
                <div className="space-y-1.5">
                  <Label>Bio <span className="text-destructive">*</span> <span className="text-xs font-normal text-muted-foreground">(min 50 chars)</span></Label>
                  <Textarea rows={4} placeholder="Tell mentees about your experience and what you can help with…" {...form.register("bio")} />
                  {form.formState.errors.bio && <p className="text-xs text-destructive">{form.formState.errors.bio.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Years of experience <span className="text-destructive">*</span></Label>
                  <Input type="number" min={0} max={60} placeholder="e.g. 5" {...form.register("years_experience")} />
                  {form.formState.errors.years_experience && <p className="text-xs text-destructive">{form.formState.errors.years_experience.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>
                    Expertise <span className="text-destructive">*</span>{" "}
                    <span className="text-xs font-normal text-muted-foreground">({expertise.length}/10)</span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                      placeholder="e.g. Product Design"
                      disabled={expertise.length >= 10}
                    />
                    <Button type="button" variant="outline" onClick={addTag} disabled={!tagInput.trim() || expertise.length >= 10}>
                      <Plus className="h-4 w-4 mr-1" />Add
                    </Button>
                  </div>
                  {expertise.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {expertise.map((t) => (
                        <Badge key={t} variant="secondary" className="gap-1">
                          {t}
                          <button type="button" onClick={() => setExpertise(expertise.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Links</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>LinkedIn</Label>
                    <Input type="url" placeholder="https://linkedin.com/in/…" {...form.register("linkedin_url")} />
                    {form.formState.errors.linkedin_url && <p className="text-xs text-destructive">{form.formState.errors.linkedin_url.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Portfolio / Website</Label>
                    <Input type="url" placeholder="https://…" {...form.register("portfolio_url")} />
                    {form.formState.errors.portfolio_url && <p className="text-xs text-destructive">{form.formState.errors.portfolio_url.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Twitter / X</Label>
                    <Input type="url" placeholder="https://twitter.com/…" {...form.register("twitter_url")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>GitHub</Label>
                    <Input type="url" placeholder="https://github.com/…" {...form.register("github_url")} />
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Resume <span className="text-destructive">*</span>
                </h3>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    handleFile(e.dataTransfer.files?.[0] ?? null);
                  }}
                  className={`rounded-md border-2 border-dashed p-4 transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-input"}`}
                >
                  {resume ? (
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{resume.name}</p>
                        <p className="text-xs text-muted-foreground">{formatBytes(resume.size)}</p>
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => { setResume(null); if (fileRef.current) fileRef.current.value = ""; }} aria-label="Remove file">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-3 cursor-pointer">
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1 text-sm">
                        <span className="text-foreground font-medium">Click to upload</span>
                        <span className="text-muted-foreground"> or drag and drop — PDF or DOC, max 5MB</span>
                      </div>
                      <input
                        ref={fileRef}
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  )}
                </div>
              </section>

              <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-4 bg-background border-t">
                <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                  {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account…</> : "Create Account & Send Code"}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MentorApplicationDialog;
