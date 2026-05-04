import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Fragment } from "react";
import { MessageSquare, X, RefreshCw, ExternalLink, Copy } from "lucide-react";
import ProgramBadge from "@/components/programs/ProgramBadge";
import { useMyPrograms } from "@/features/programs/hooks/useMyPrograms";
import type { Database } from "@/integrations/supabase/types";

type SessionStatus = Database["public"]["Enums"]["session_status"];

interface SessionRow {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: SessionStatus;
  mentor_id: string;
  mentee_notes: string;
  notes: string | null;
  meeting_url: string;
  cancellation_reason: string;
  mentor: { full_name: string } | null;
}

const MenteeSessions = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mentorPrograms, setMentorPrograms] = useState<Record<string, { name: string; color: string; slug: string }[]>>({});
  const { data: myPrograms = [] } = useMyPrograms();
  const [cancelTarget, setCancelTarget] = useState<SessionRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const fetchSessions = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("sessions")
      .select("id, scheduled_at, duration_minutes, status, mentor_id, mentee_notes, notes, meeting_url, cancellation_reason, mentor:users!sessions_mentor_id_fkey(full_name)")
      .eq("mentee_id", user.id)
      .order("scheduled_at", { ascending: false });
    setSessions((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchSessions(); }, [user]);

  useEffect(() => {
    if (myPrograms.length === 0 || sessions.length === 0) return;
    (async () => {
      const mentorIds = Array.from(new Set(sessions.map((s) => s.mentor_id)));
      const programIds = myPrograms.map((p) => p.id);
      const { data } = await supabase
        .from("program_mentors")
        .select("program_id, mentor_id")
        .in("program_id", programIds)
        .in("mentor_id", mentorIds);
      const byMentor: Record<string, { name: string; color: string; slug: string }[]> = {};
      const programMap = new Map(myPrograms.map((p) => [p.id, p]));
      (data || []).forEach((row: any) => {
        const p = programMap.get(row.program_id);
        if (!p) return;
        (byMentor[row.mentor_id] ||= []).push({ name: p.name, color: p.color, slug: p.slug });
      });
      setMentorPrograms(byMentor);
    })();
  }, [myPrograms, sessions]);

  const statusColor = (s: SessionStatus) =>
    s === "booked" ? "default" : s === "completed" ? "secondary" : "destructive";

  const now = new Date();
  const upcoming = sessions.filter((s) => s.status === "booked" && new Date(s.scheduled_at) >= now);
  const past = sessions.filter((s) => !(s.status === "booked" && new Date(s.scheduled_at) >= now));

  const handleCancel = async () => {
    if (!cancelTarget || !user) return;
    setCancelling(true);
    const { error } = await supabase.from("sessions").update({
      status: "cancelled",
      cancelled_by: user.id,
      cancelled_at: new Date().toISOString(),
      cancellation_reason: cancelReason || "Cancelled by mentee",
    } as any).eq("id", cancelTarget.id);
    setCancelling(false);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Session cancelled" });
      setCancelTarget(null);
      setCancelReason("");
      fetchSessions();
    }
  };

  const renderRows = (rows: SessionRow[], isUpcoming: boolean) => {
    if (loading) return <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>;
    if (rows.length === 0) return <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No sessions</TableCell></TableRow>;
    return rows.map((s) => {
      const progs = mentorPrograms[s.mentor_id] || [];
      const hasDetails = !!(s.mentee_notes || s.notes || s.meeting_url || s.cancellation_reason);
      return (
        <Fragment key={s.id}>
          <TableRow>
            <TableCell className="font-medium">{s.mentor?.full_name || "Unknown"}</TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {progs.length === 0 ? <span className="text-xs text-muted-foreground">—</span>
                  : progs.map((p) => <ProgramBadge key={p.slug} name={p.name} color={p.color} to={`/mentee/programs/${p.slug}`} />)}
              </div>
            </TableCell>
            <TableCell>{new Date(s.scheduled_at).toLocaleString()}</TableCell>
            <TableCell>{s.duration_minutes} min</TableCell>
            <TableCell><Badge variant={statusColor(s.status)}>{s.status}</Badge></TableCell>
            <TableCell>
              <div className="flex items-center gap-1 flex-wrap">
                {isUpcoming && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/book/${s.mentor_id}?reschedule=${s.id}`)}>
                      <RefreshCw className="mr-1 h-3 w-3" />Reschedule
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setCancelTarget(s)}>
                      <X className="mr-1 h-3 w-3" />Cancel
                    </Button>
                  </>
                )}
                {s.status === "completed" && (
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/session/${s.id}/feedback`)}>
                    <MessageSquare className="mr-1 h-3 w-3" />Feedback
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
          {hasDetails && (
            <TableRow className="bg-muted/30">
              <TableCell colSpan={6} className="py-3 space-y-2 text-sm">
                {s.meeting_url && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Meeting link:</span>
                    <a href={s.meeting_url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">
                      {s.meeting_url} <ExternalLink className="h-3 w-3" />
                    </a>
                    <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(s.meeting_url); toast({ title: "Copied" }); }}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {s.mentee_notes && <div><span className="font-medium">Your notes:</span> {s.mentee_notes}</div>}
                {s.notes && <div><span className="font-medium">Mentor notes:</span> {s.notes}</div>}
                {s.cancellation_reason && <div className="text-destructive"><span className="font-medium">Cancellation:</span> {s.cancellation_reason}</div>}
              </TableCell>
            </TableRow>
          )}
        </Fragment>
      );
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">My Sessions</h1>
        <Tabs defaultValue="upcoming">
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
          </TabsList>
          {(["upcoming", "past"] as const).map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-4">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mentor</TableHead>
                        <TableHead>Program</TableHead>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>{renderRows(tab === "upcoming" ? upcoming : past, tab === "upcoming")}</TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will free the slot for someone else. You can rebook later if you change your mind.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Textarea rows={2} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Let your mentor know why…" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={cancelling}>
              {cancelling ? "Cancelling…" : "Cancel session"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default MenteeSessions;
