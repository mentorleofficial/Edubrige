import { useEffect, useState, Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, X, UserX, Link2, FileEdit } from "lucide-react";
import AddToCalendarMenu from "@/components/AddToCalendarMenu";
import ProgramBadge from "@/components/programs/ProgramBadge";
import { useMyPrograms } from "@/features/programs/hooks/useMyPrograms";
import type { Database } from "@/integrations/supabase/types";

type SessionStatus = Database["public"]["Enums"]["session_status"];

interface SessionRow {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: SessionStatus;
  notes: string | null;
  mentee_notes: string;
  meeting_url: string;
  cancellation_reason: string;
  mentee_id: string;
  mentee: { full_name: string } | null;
}

const MentorSessions = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [menteePrograms, setMenteePrograms] = useState<Record<string, { name: string; color: string; slug: string }[]>>({});
  const { data: myPrograms = [] } = useMyPrograms();
  const [editing, setEditing] = useState<SessionRow | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editMeetingUrl, setEditMeetingUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchSessions = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("sessions")
      .select("id, scheduled_at, duration_minutes, status, notes, mentee_notes, meeting_url, cancellation_reason, mentee_id, mentee:users!sessions_mentee_id_fkey(full_name)")
      .eq("mentor_id", user.id)
      .order("scheduled_at", { ascending: false });
    setSessions((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchSessions(); }, [user]);

  useEffect(() => {
    if (myPrograms.length === 0 || sessions.length === 0) return;
    (async () => {
      const menteeIds = Array.from(new Set(sessions.map((s) => s.mentee_id)));
      const programIds = myPrograms.map((p) => p.id);
      const { data } = await supabase
        .from("program_mentees")
        .select("program_id, mentee_id")
        .in("program_id", programIds)
        .in("mentee_id", menteeIds);
      const byMentee: Record<string, { name: string; color: string; slug: string }[]> = {};
      const programMap = new Map(myPrograms.map((p) => [p.id, p]));
      (data || []).forEach((row: any) => {
        const p = programMap.get(row.program_id);
        if (!p) return;
        (byMentee[row.mentee_id] ||= []).push({ name: p.name, color: p.color, slug: p.slug });
      });
      setMenteePrograms(byMentee);
    })();
  }, [myPrograms, sessions]);

  const updateStatus = async (id: string, status: SessionStatus, reason?: string) => {
    const patch: any = { status };
    if (status === "cancelled") {
      patch.cancelled_by = user?.id;
      patch.cancelled_at = new Date().toISOString();
      patch.cancellation_reason = reason || "Cancelled by mentor";
    }
    const { error } = await supabase.from("sessions").update(patch).eq("id", id);
    if (error) toast({ variant: "destructive", title: "Error", description: error.message });
    else { toast({ title: `Session ${status}` }); fetchSessions(); }
  };

  const openEdit = (s: SessionRow) => {
    setEditing(s);
    setEditNotes(s.notes || "");
    setEditMeetingUrl(s.meeting_url || "");
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase.from("sessions").update({
      notes: editNotes,
      meeting_url: editMeetingUrl,
    } as any).eq("id", editing.id);
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Saved" });
      setEditing(null);
      fetchSessions();
    }
  };

  const statusColor = (s: SessionStatus) =>
    s === "booked" ? "default" : s === "completed" ? "secondary" : "destructive";

  const now = new Date();
  const upcoming = sessions.filter((s) => s.status === "booked" && new Date(s.scheduled_at) >= now);
  const past = sessions.filter((s) => !(s.status === "booked" && new Date(s.scheduled_at) >= now));

  const renderRows = (rows: SessionRow[], isUpcoming: boolean) => {
    if (loading) return <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>;
    if (rows.length === 0) return <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No sessions</TableCell></TableRow>;
    return rows.map((s) => {
      const progs = menteePrograms[s.mentee_id] || [];
      const hasDetails = !!(s.mentee_notes || s.notes || s.meeting_url || s.cancellation_reason);
      return (
        <Fragment key={s.id}>
          <TableRow>
            <TableCell className="font-medium">{s.mentee?.full_name || "Unknown"}</TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {progs.length === 0 ? <span className="text-xs text-muted-foreground">—</span>
                  : progs.map((p) => <ProgramBadge key={p.slug} name={p.name} color={p.color} to={`/mentor/programs/${p.slug}`} />)}
              </div>
            </TableCell>
            <TableCell>{new Date(s.scheduled_at).toLocaleString()}</TableCell>
            <TableCell>{s.duration_minutes} min</TableCell>
            <TableCell><Badge variant={statusColor(s.status)}>{s.status}</Badge></TableCell>
            <TableCell>
              <div className="flex items-center gap-1 flex-wrap">
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
                    <Button variant="ghost" size="sm" onClick={() => updateStatus(s.id, "completed")}>
                      <CheckCircle2 className="mr-1 h-3 w-3" />Complete
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => updateStatus(s.id, "no_show")}>
                      <UserX className="mr-1 h-3 w-3" />No-show
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => updateStatus(s.id, "cancelled")}>
                      <X className="mr-1 h-3 w-3" />Cancel
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                  <FileEdit className="mr-1 h-3 w-3" />Notes/Link
                </Button>
              </div>
            </TableCell>
          </TableRow>
          {hasDetails && (
            <TableRow className="bg-muted/30">
              <TableCell colSpan={6} className="py-3 space-y-2 text-sm">
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
            <DialogDescription>Add a meeting link and your private notes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default MentorSessions;
