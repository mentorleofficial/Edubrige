import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, FileText, Loader2, CheckCircle2, XCircle } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Application = Database["public"]["Tables"]["mentor_applications"]["Row"];

interface Props {
  application: Application | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated: () => void;
}

const ApplicationDetailDialog = ({ application, open, onOpenChange, onUpdated }: Props) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);

  const loadResume = async () => {
    if (!application?.resume_url) return;
    const { data } = await supabase.storage.from("mentor-resumes").createSignedUrl(application.resume_url, 300);
    if (data?.signedUrl) {
      setResumeUrl(data.signedUrl);
      window.open(data.signedUrl, "_blank");
    }
  };

  const handleApprove = async () => {
    if (!application) return;
    setBusy("approve");
    try {
      const { data, error } = await supabase.functions.invoke("approve-mentor-application", {
        body: { application_id: application.id, admin_notes: notes || null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Application approved", description: "Mentor account created (inactive)." });
      onUpdated();
      onOpenChange(false);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Approval failed", description: err.message });
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async () => {
    if (!application || !user) return;
    setBusy("reject");
    const { error } = await supabase
      .from("mentor_applications")
      .update({
        status: "rejected",
        admin_notes: notes || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", application.id);
    setBusy(null);
    if (error) {
      toast({ variant: "destructive", title: "Reject failed", description: error.message });
    } else {
      toast({ title: "Application rejected" });
      onUpdated();
      onOpenChange(false);
    }
  };

  if (!application) return null;
  const social = (application.social_links as any) || {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {application.full_name}
            <Badge variant={application.status === "pending" ? "secondary" : application.status === "approved" ? "default" : "destructive"}>
              {application.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div><span className="text-muted-foreground">Email:</span> {application.email}</div>
            <div><span className="text-muted-foreground">Phone:</span> {application.phone || "—"}</div>
            <div><span className="text-muted-foreground">Years:</span> {application.years_experience}</div>
            <div><span className="text-muted-foreground">Submitted:</span> {new Date(application.created_at).toLocaleDateString()}</div>
          </div>

          <div>
            <Label className="text-xs uppercase text-muted-foreground">Bio</Label>
            <p className="text-sm mt-1 whitespace-pre-wrap">{application.bio}</p>
          </div>

          {application.expertise.length > 0 && (
            <div>
              <Label className="text-xs uppercase text-muted-foreground">Expertise</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {application.expertise.map((e) => <Badge key={e} variant="secondary">{e}</Badge>)}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs uppercase text-muted-foreground">Links</Label>
            <div className="flex flex-wrap gap-3 text-sm">
              {application.linkedin_url && <a href={application.linkedin_url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">LinkedIn <ExternalLink className="h-3 w-3" /></a>}
              {application.portfolio_url && <a href={application.portfolio_url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">Portfolio <ExternalLink className="h-3 w-3" /></a>}
              {social.twitter && <a href={social.twitter} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">Twitter <ExternalLink className="h-3 w-3" /></a>}
              {social.github && <a href={social.github} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">GitHub <ExternalLink className="h-3 w-3" /></a>}
            </div>
          </div>

          {application.resume_url && (
            <Button variant="outline" size="sm" onClick={loadResume}>
              <FileText className="mr-2 h-4 w-4" />Open Resume
            </Button>
          )}

          {application.status === "pending" ? (
            <>
              <Separator />
              <div className="space-y-2">
                <Label>Admin notes (optional)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Reason or feedback…" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="destructive" onClick={handleReject} disabled={!!busy}>
                  {busy === "reject" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                  Reject
                </Button>
                <Button onClick={handleApprove} disabled={!!busy}>
                  {busy === "approve" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Approve
                </Button>
              </div>
            </>
          ) : application.admin_notes ? (
            <div>
              <Label className="text-xs uppercase text-muted-foreground">Admin notes</Label>
              <p className="text-sm mt-1 whitespace-pre-wrap">{application.admin_notes}</p>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ApplicationDetailDialog;
