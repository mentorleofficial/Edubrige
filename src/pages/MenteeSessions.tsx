import { Fragment, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { MessageSquare, X, RefreshCw, ExternalLink, Copy, Video, Star, ListTodo } from "lucide-react";
import AddToCalendarMenu from "@/components/AddToCalendarMenu";
import ProgramBadge from "@/components/programs/ProgramBadge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SessionActionItemsPanel from "@/components/sessions/SessionActionItemsPanel";
import { useMyPrograms } from "@/features/programs/hooks/useMyPrograms";
import {
  useMenteeSessions,
  useMenteeRatedSessions,
  useMenteeMentorPrograms,
  useCancelMenteeSession,
  type MenteeSessionRow,
} from "@/features/mentee-sessions/useMenteeSessions";

const MenteeSessions = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: sessions = [], isLoading } = useMenteeSessions(user?.id);
  const sessionIds = useMemo(() => sessions.map((s) => s.id), [sessions]);
  const { data: ratedSessionIds = new Set<string>() } = useMenteeRatedSessions(user?.id, sessionIds);
  const { data: myPrograms = [] } = useMyPrograms();

  const mentorIds = useMemo(
    () => Array.from(new Set(sessions.map((s) => s.mentor_id))),
    [sessions]
  );
  const programIds = useMemo(() => myPrograms.map((p) => p.id), [myPrograms]);
  const { data: mentorProgramRows = [] } = useMenteeMentorPrograms(programIds, mentorIds);

  const mentorPrograms = useMemo(() => {
    const byMentor: Record<string, { name: string; color: string; slug: string }[]> = {};
    const programMap = new Map(myPrograms.map((p) => [p.id, p]));
    mentorProgramRows.forEach((row) => {
      const p = programMap.get(row.program_id);
      if (!p) return;
      (byMentor[row.mentor_id] ||= []).push({ name: p.name, color: p.color, slug: p.slug });
    });
    return byMentor;
  }, [myPrograms, mentorProgramRows]);

  const cancelMutation = useCancelMenteeSession(user?.id);
  const [cancelTarget, setCancelTarget] = useState<MenteeSessionRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const now = new Date();
  const upcoming = sessions.filter((s) => s.status === "booked" && new Date(s.scheduled_at) >= now);
  const past = sessions.filter((s) => !(s.status === "booked" && new Date(s.scheduled_at) >= now));

  const statusColor = (s: MenteeSessionRow["status"]) =>
    s === "booked" ? "default" : s === "completed" ? "secondary" : "destructive";

  const handleCancel = () => {
    if (!cancelTarget) return;
    cancelMutation.mutate(
      { id: cancelTarget.id, reason: cancelReason },
      {
        onSuccess: () => {
          toast({ title: "Session cancelled" });
          setCancelTarget(null);
          setCancelReason("");
        },
      }
    );
  };

  const renderRows = (rows: MenteeSessionRow[], isUpcoming: boolean) => {
    if (isLoading) return <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>;
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
                {isUpcoming && s.meeting_url && (
                  <Button asChild size="sm">
                    <a href={s.meeting_url} target="_blank" rel="noreferrer">
                      <Video className="mr-1 h-3 w-3" />Join now
                    </a>
                  </Button>
                )}
                {isUpcoming && (
                  <>
                    <AddToCalendarMenu
                      event={{
                        title: `Mentorship session with ${s.mentor?.full_name || "your mentor"}`,
                        description: [
                          s.meeting_url ? `Meeting link: ${s.meeting_url}` : "",
                          s.mentee_notes ? `Notes: ${s.mentee_notes}` : "",
                        ].filter(Boolean).join("\n"),
                        location: s.meeting_url || undefined,
                        startISO: s.scheduled_at,
                        durationMinutes: s.duration_minutes,
                      }}
                      filename={`session-${s.id}.ics`}
                    />
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/book/${s.mentor_id}?reschedule=${s.id}`)}>
                      <RefreshCw className="mr-1 h-3 w-3" />Reschedule
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setCancelTarget(s)}>
                      <X className="mr-1 h-3 w-3" />Cancel
                    </Button>
                  </>
                )}
                {s.status === "completed" && (
                  ratedSessionIds.has(s.id) ? (
                    <Badge variant="secondary" className="text-xs"><Star className="mr-1 h-3 w-3" />Rated</Badge>
                  ) : (
                    <Button variant="default" size="sm" onClick={() => navigate(`/session/${s.id}/feedback`)}>
                      <MessageSquare className="mr-1 h-3 w-3" />Rate session
                    </Button>
                  )
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
            <AlertDialogCancel disabled={cancelMutation.isPending}>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={cancelMutation.isPending}>
              {cancelMutation.isPending ? "Cancelling…" : "Cancel session"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default MenteeSessions;
