import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, X, Upload, Loader2 } from "lucide-react";

const urlOrEmpty = z.string().trim().url("Must be a valid URL").or(z.literal(""));

const schema = z.object({
  full_name: z.string().trim().min(2, "Required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  linkedin_url: urlOrEmpty.refine((v) => !v || v.includes("linkedin"), "Must be a LinkedIn URL"),
  portfolio_url: urlOrEmpty,
  twitter_url: urlOrEmpty,
  github_url: urlOrEmpty,
  bio: z.string().trim().min(50, "Bio must be at least 50 characters").max(2000),
  years_experience: z.coerce.number().int().min(0).max(80),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const MentorApplicationDialog = ({ open, onOpenChange }: Props) => {
  const { toast } = useToast();
  const [expertise, setExpertise] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [resume, setResume] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: "", email: "", phone: "",
      linkedin_url: "", portfolio_url: "", twitter_url: "", github_url: "",
      bio: "", years_experience: 0,
    },
  });

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !expertise.includes(t) && expertise.length < 10) {
      setExpertise([...expertise, t]);
      setTagInput("");
    }
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
    if (resume.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "Resume must be under 5MB" });
      return;
    }
    const okType = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!okType.includes(resume.type)) {
      toast({ variant: "destructive", title: "Resume must be PDF or DOC/DOCX" });
      return;
    }

    setSubmitting(true);
    try {
      const ext = resume.name.split(".").pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("mentor-resumes").upload(path, resume, {
        contentType: resume.type,
      });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("mentor_applications").insert({
        full_name: values.full_name,
        email: values.email,
        phone: values.phone || null,
        linkedin_url: values.linkedin_url || null,
        portfolio_url: values.portfolio_url || null,
        social_links: {
          twitter: values.twitter_url || null,
          github: values.github_url || null,
        },
        bio: values.bio,
        expertise,
        years_experience: values.years_experience,
        resume_url: path,
      });
      if (insErr) throw insErr;
      setSubmitted(true);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Submission failed", description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setSubmitted(false);
      form.reset();
      setExpertise([]);
      setResume(null);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {submitted ? (
          <div className="py-8 text-center space-y-4">
            <CheckCircle2 className="mx-auto h-16 w-16 text-primary" />
            <DialogTitle className="text-2xl">Application Submitted</DialogTitle>
            <DialogDescription className="text-base">
              Thanks for applying! Our team will review your application and reach out via email.
            </DialogDescription>
            <Button onClick={() => handleClose(false)}>Close</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Apply to become a Mentor</DialogTitle>
              <DialogDescription>Share your background. Your application will be reviewed by our team.</DialogDescription>
            </DialogHeader>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-2">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Personal</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Full name *</Label>
                    <Input {...form.register("full_name")} />
                    {form.formState.errors.full_name && <p className="text-xs text-destructive">{form.formState.errors.full_name.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email *</Label>
                    <Input type="email" {...form.register("email")} />
                    {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Phone</Label>
                    <Input {...form.register("phone")} />
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Professional</h3>
                <div className="space-y-1.5">
                  <Label>Bio * <span className="text-xs font-normal text-muted-foreground">(min 50 chars)</span></Label>
                  <Textarea rows={4} {...form.register("bio")} />
                  {form.formState.errors.bio && <p className="text-xs text-destructive">{form.formState.errors.bio.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Years of experience</Label>
                  <Input type="number" min={0} {...form.register("years_experience")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Expertise * <span className="text-xs font-normal text-muted-foreground">(press Enter to add)</span></Label>
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                    placeholder="e.g. Product Design"
                  />
                  {expertise.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {expertise.map((t) => (
                        <Badge key={t} variant="secondary" className="gap-1">
                          {t}
                          <button type="button" onClick={() => setExpertise(expertise.filter((x) => x !== t))}>
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
                    <Input placeholder="https://linkedin.com/in/…" {...form.register("linkedin_url")} />
                    {form.formState.errors.linkedin_url && <p className="text-xs text-destructive">{form.formState.errors.linkedin_url.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Portfolio / Website</Label>
                    <Input placeholder="https://…" {...form.register("portfolio_url")} />
                    {form.formState.errors.portfolio_url && <p className="text-xs text-destructive">{form.formState.errors.portfolio_url.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Twitter / X</Label>
                    <Input placeholder="https://twitter.com/…" {...form.register("twitter_url")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>GitHub</Label>
                    <Input placeholder="https://github.com/…" {...form.register("github_url")} />
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Resume *</h3>
                <label className="flex items-center gap-3 rounded-md border border-dashed border-input p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1 text-sm">
                    {resume ? <span className="font-medium">{resume.name}</span> : <span className="text-muted-foreground">Upload PDF or DOC (max 5MB)</span>}
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => setResume(e.target.files?.[0] ?? null)}
                  />
                </label>
              </section>

              <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</> : "Submit Application"}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MentorApplicationDialog;
