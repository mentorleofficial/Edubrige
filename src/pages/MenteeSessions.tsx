import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
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
  mentor: { full_name: string } | null;
}

const MenteeSessions = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mentorPrograms, setMentorPrograms] = useState<Record<string, { name: string; color: string; slug: string }[]>>({});
  const { data: myPrograms = [] } = useMyPrograms();

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

  useEffect(() => {
    if (!user) return;
    supabase
      .from("sessions")
      .select("id, scheduled_at, duration_minutes, status, mentor_id, mentor:users!sessions_mentor_id_fkey(full_name)")
      .eq("mentee_id", user.id)
      .order("scheduled_at", { ascending: false })
      .then(({ data }) => {
        setSessions((data as any) || []);
        setLoading(false);
      });
  }, [user]);

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
                  <TableHead>Mentor</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Feedback</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : sessions.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No sessions yet</TableCell></TableRow>
                ) : (
                  sessions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{(s.mentor as any)?.full_name || "Unknown"}</TableCell>
                      <TableCell>{new Date(s.scheduled_at).toLocaleString()}</TableCell>
                      <TableCell>{s.duration_minutes} min</TableCell>
                      <TableCell><Badge variant={statusColor(s.status)}>{s.status}</Badge></TableCell>
                      <TableCell>
                        {s.status === "completed" && (
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/session/${s.id}/feedback`)}>
                            <MessageSquare className="mr-1 h-4 w-4" />Feedback
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default MenteeSessions;
