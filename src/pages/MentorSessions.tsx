import { formatISTDateTime } from "@/lib/datetime";
import {
import { useMemo, useState, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, X, UserX, Link2, FileEdit, Video, Star, ListTodo } from "lucide-react";
import AddToCalendarMenu from "@/components/AddToCalendarMenu";
import SessionActionItemsPanel from "@/components/sessions/SessionActionItemsPanel";
import ProgramBadge from "@/components/programs/ProgramBadge";
import {
  useMentorSessions,
  useMentorRatedSessions,
  useUpdateSessionStatus,
  useUpdateSessionDetails,
  type MentorSessionRow,
  type SessionStatus,
} from "@/features/mentor-sessions/useMentorSessions";
import {
  useMentorMentees,
  selectMenteeProgramMap,
} from "@/features/mentor-mentees/useMentorMentees";

const MentorSessions = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: sessions = [], isLoading } = useMentorSessions(user?.id);
  const sessionIds = useMemo(() => sessions.map((s) => s.id), [sessions]);
  const { data: ratedSessionIds } = useMentorRatedSessions(user?.id, sessionIds);
  const { data: menteeRows = [] } = useMentorMentees(user?.id);
  const menteePrograms = useMemo(() => selectMenteeProgramMap(menteeRows), [menteeRows]);

  const updateStatus = useUpdateSessionStatus(user?.id);
  const updateDetails = useUpdateSessionDetails(user?.id);

  const [editing, setEditing] = useState<MentorSessionRow | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editMeetingUrl, setEditMeetingUrl] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editTopic, setEditTopic] = useState("");
  const [actionItemsTarget, setActionItemsTarget] = useState<MentorSessionRow | null>(null);

  const openEdit = (s: MentorSessionRow) => {
    setEditing(s);
    setEditNotes(s.notes || "");
    setEditMeetingUrl(s.meeting_url || "");
    setEditTitle(s.title || "");
    setEditTopic(s.topic || "");
  };

  const saveEdit = () => {
    if (!editing) return;
    updateDetails.mutate(
      {
        id: editing.id,
        notes: editNotes,
        meeting_url: editMeetingUrl,
        title: editTitle,
        topic: editTopic,
      },
      { onSuccess: () => setEditing(null) }
    );
  };

  const statusColor = (s: SessionStatus) =>
    s === "booked" ? "default" : s === "completed" ? "secondary" : "destructive";

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up: MentorSessionRow[] = [];
    const ps: MentorSessionRow[] = [];
    for (const s of sessions) {
      if (s.status === "booked" && new Date(s.scheduled_at).getTime() >= now) up.push(s);
      else ps.push(s);
    }
    return { upcoming: up, past: ps };
  }, [sessions]);

  const renderRows = (rows: MentorSessionRow[], isUpcoming: boolean) => {
    if (isLoading) return <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>;
    if (rows.length === 0) return <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No sessions</TableCell></TableRow>;
    return rows.map((s) => {
      const progs = menteePrograms[s.mentee_id] || [];
      const hasDetails = !!(s.mentee_notes || s.notes || s.meeting_url || s.cancellation_reason || s.topic);
      return (
        <Fragment key={s.id}>
          <TableRow>
            <TableCell className="font-medium">{s.mentee?.full_name || "Unknown"}</TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-medium text-sm">{s.title || <span className="text-muted-foreground italic">Untitled</span>}</span>
                {s.topic && <span className="text-xs text-muted-foreground truncate max-w-[18rem]">{s.topic}</span>}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {progs.length === 0 ? <span className="text-xs text-muted-foreground">—</span>
                  : progs.map((p) => <ProgramBadge key={p.slug} name={p.name} color={p.color} to={`/mentor/programs/${p.slug}`} />)}
              </div>
            </TableCell>
            <TableCell>{formatISTDateTime(s.scheduled_at)}</TableCell>
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
                        title: `Mentorship session with ${s.mentee?.full_name || "your mentee"}`,
                        description: [
                          s.meeting_url ? `Meeting link: ${s.meeting_url}` : "",
                          s.mentee_notes ? `Mentee asked: ${s.mentee_notes}` : "",
                          s.notes ? `Your notes: ${s.notes}` : "",
                        ].filter(Boolean).join("\n"),
                        location: s.meeting_url || undefined,
                        startISO: s.scheduled_at,
                        durationMinutes: s.duration_minutes,
                      }}
                      filename={`session-${s.id}.ics`}
                    />
                    <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate({ id: s.id, status: "completed" })}>
                      <CheckCircle2 className="mr-1 h-3 w-3" />Complete
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate({ id: s.id, status: "no_show" })}>
                      <UserX className="mr-1 h-3 w-3" />No-show
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate({ id: s.id, status: "cancelled" })}>
                      <X className="mr-1 h-3 w-3" />Cancel
                    </Button>
                  </>
                )}
                {s.status === "completed" && (
                  ratedSessionIds?.has(s.id) ? (
                    <Badge variant="secondary" className="text-xs"><Star className="mr-1 h-3 w-3" />Rated</Badge>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/session/${s.id}/feedback`)}>
                      <Star className="mr-1 h-3 w-3" />Rate mentee
                    </Button>
                  )
                )}
                <Button variant="ghost" size="sm" onClick={() => setActionItemsTarget(s)}>
                  <ListTodo className="mr-1 h-3 w-3" />Action items
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                  <FileEdit className="mr-1 h-3 w-3" />Edit
                </Button>
              </div>
            </TableCell>
          </TableRow>
          {hasDetails && (
            <TableRow className="bg-muted/30">
              <TableCell colSpan={7} className="py-3 space-y-2 text-sm">
                {s.topic && <div><span className="font-medium">Topic:</span> {s.topic}</div>}
                {s.meeting_url && (
                  <div className="flex items-center gap-2">
                    <Link2 className="h-3 w-3 text-primary" />
                    <a href={s.meeting_url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate max-w-md">{s.meeting_url}</a>
                  </div>
                )}
                {s.mentee_notes && <div><span className="font-medium">Mentee asked:</span> {s.mentee_notes}</div>}
                {s.notes && <div><span className="font-medium">Your notes:</span> {s.notes}</div>}
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
                        <TableHead>Mentee</TableHead>
                        <TableHead>Title</TableHead>
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

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Session details</DialogTitle>
            <DialogDescription>Update the session title, topic, meeting link, and your private notes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Session title" />
            </div>
            <div className="space-y-2">
              <Label>Topic</Label>
              <Input value={editTopic} onChange={(e) => setEditTopic(e.target.value)} placeholder="Topic / focus area" />
            </div>
            <div className="space-y-2">
              <Label>Meeting link</Label>
              <Input value={editMeetingUrl} onChange={(e) => setEditMeetingUrl(e.target.value)} placeholder="https://meet…" />
            </div>
            <div className="space-y-2">
              <Label>Mentor notes (private)</Label>
              <Textarea rows={4} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={updateDetails.isPending}>Cancel</Button>
            <Button onClick={saveEdit} disabled={updateDetails.isPending}>{updateDetails.isPending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!actionItemsTarget} onOpenChange={(o) => !o && setActionItemsTarget(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {actionItemsTarget?.title || "Action items"}
              {actionItemsTarget?.mentee?.full_name ? ` · ${actionItemsTarget.mentee.full_name}` : ""}
            </DialogTitle>
            <DialogDescription>
              Assign follow-up tasks to your mentee. They'll see them on their dashboard.
            </DialogDescription>
          </DialogHeader>
          {actionItemsTarget && user && (
            <SessionActionItemsPanel
              sessionId={actionItemsTarget.id}
              mentorId={user.id}
              menteeId={actionItemsTarget.mentee_id}
              currentUserId={user.id}
              role="mentor"
            />
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default MentorSessions;
