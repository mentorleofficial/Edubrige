import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
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

  const fetchSessions = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("sessions")
      .select("id, scheduled_at, duration_minutes, status, notes, mentee_id, mentee:users!sessions_mentee_id_fkey(full_name)")
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

  const updateStatus = async (id: string, status: SessionStatus) => {
    const { error } = await supabase.from("sessions").update({ status }).eq("id", id);
    if (error) toast({ variant: "destructive", title: "Error", description: error.message });
    else fetchSessions();
  };

  const statusColor = (s: SessionStatus) =>
    s === "booked" ? "default" : s === "completed" ? "secondary" : "destructive";

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">My Sessions</h1>
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
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : sessions.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No sessions</TableCell></TableRow>
                ) : (
                  sessions.map((s) => {
                    const progs = menteePrograms[s.mentee_id] || [];
                    return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{(s.mentee as any)?.full_name || "Unknown"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {progs.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            progs.map((p) => <ProgramBadge key={p.slug} name={p.name} color={p.color} to={`/mentor/programs/${p.slug}`} />)
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{new Date(s.scheduled_at).toLocaleString()}</TableCell>
                      <TableCell>{s.duration_minutes} min</TableCell>
                      <TableCell><Badge variant={statusColor(s.status)}>{s.status}</Badge></TableCell>
                      <TableCell>
                        {s.status === "booked" && (
                          <Select onValueChange={(v) => updateStatus(s.id, v as SessionStatus)}>
                            <SelectTrigger className="w-32"><SelectValue placeholder="Update" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="completed">Complete</SelectItem>
                              <SelectItem value="cancelled">Cancel</SelectItem>
                              <SelectItem value="no_show">No Show</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default MentorSessions;
