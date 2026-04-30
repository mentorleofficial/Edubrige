import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMyPrograms } from "@/features/programs/hooks/useMyPrograms";

type ProgramLite = { id: string; name: string; status: string; slug: string };
type Mentee = { id: string; full_name: string; email: string };
type Row = {
  key: string;
  program: ProgramLite;
  mentee: Mentee;
  assigned: boolean; // true if explicit 1:1 assignment exists
};

const initials = (n: string) => n.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

const MentorMentees = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const { data: myPrograms = [] } = useMyPrograms();

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);

      // 1) Programs the mentor belongs to
      const { data: mp } = await supabase
        .from("program_mentors")
        .select("program_id")
        .eq("mentor_id", user.id);
      const programIds = Array.from(new Set((mp || []).map((r) => r.program_id).filter(Boolean)));

      if (programIds.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      // 2) Programs metadata
      const { data: progs } = await supabase
        .from("programs")
        .select("id,name,status,slug")
        .in("id", programIds);
      const progById: Record<string, ProgramLite> = {};
      (progs || []).forEach((p) => (progById[p.id] = p as ProgramLite));

      // 3) All mentees enrolled in those programs
      const { data: enrollments } = await supabase
        .from("program_mentees")
        .select("program_id, mentee_id")
        .in("program_id", programIds);

      // 4) Explicit 1:1 assignments for this mentor
      const { data: assigns } = await supabase
        .from("mentor_mentee_assignments")
        .select("program_id, mentee_id")
        .eq("mentor_id", user.id);
      const assignedSet = new Set(
        (assigns || []).map((a) => `${a.program_id}:${a.mentee_id}`),
      );

      // 5) Mentee user records
      const menteeIds = Array.from(new Set((enrollments || []).map((e) => e.mentee_id).filter(Boolean)));
      const userById: Record<string, Mentee> = {};
      if (menteeIds.length > 0) {
        const { data: us } = await supabase
          .from("users")
          .select("id, full_name, email")
          .in("id", menteeIds);
        (us || []).forEach((u) => (userById[u.id] = u as Mentee));
      }

      const built: Row[] = (enrollments || [])
        .map((e) => {
          const program = progById[e.program_id];
          const mentee = userById[e.mentee_id];
          if (!program || !mentee) return null;
          return {
            key: `${e.program_id}:${e.mentee_id}`,
            program,
            mentee,
            assigned: assignedSet.has(`${e.program_id}:${e.mentee_id}`),
          } as Row;
        })
        .filter(Boolean) as Row[];

      setRows(built);
      setLoading(false);
    })();
  }, [user]);

  const programFilter = params.get("program") || "all";

  const filteredRows = useMemo(() => {
    if (programFilter === "all") return rows;
    return rows.filter((r) => r.program.slug === programFilter);
  }, [rows, programFilter]);

  const byProgram = filteredRows.reduce<Record<string, Row[]>>((acc, r) => {
    (acc[r.program.id] ||= []).push(r); return acc;
  }, {});

  const setFilter = (val: string) => {
    const next = new URLSearchParams(params);
    if (val === "all") next.delete("program");
    else next.set("program", val);
    setParams(next, { replace: true });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">My Mentees</h1>
            <p className="text-muted-foreground mt-1">All mentees enrolled in your programs. Direct 1:1 assignments are tagged.</p>
          </div>
          {myPrograms.length > 0 && (
            <Select value={programFilter} onValueChange={setFilter}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Filter by program" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All programs</SelectItem>
                {myPrograms.map((p) => (
                  <SelectItem key={p.id} value={p.slug}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {loading ? <p className="text-muted-foreground text-sm">Loading…</p> :
          filteredRows.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No mentees enrolled{programFilter !== "all" ? " in this program" : ""} yet.</CardContent></Card>
          ) : (
            <div className="space-y-4">
              {Object.values(byProgram).map((group) => (
                <Card key={group[0].program.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-lg">{group[0].program.name}</CardTitle>
                      <Badge variant="secondary" className="capitalize">{group[0].program.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-2 sm:grid-cols-2">
                    {group.map((r) => (
                      <div key={r.key} className="flex items-center gap-3 rounded-md border p-3">
                        <Avatar className="h-9 w-9"><AvatarFallback>{initials(r.mentee.full_name)}</AvatarFallback></Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{r.mentee.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{r.mentee.email}</p>
                        </div>
                        {r.assigned && <Badge variant="secondary" className="text-xs">Assigned</Badge>}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        }
      </div>
    </AppLayout>
  );
};

export default MentorMentees;
