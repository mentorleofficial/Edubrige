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

type Row = {
  id: string;
  program: { id: string; name: string; status: string; slug: string };
  mentee: { id: string; full_name: string; email: string };
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
      const { data } = await supabase
        .from("mentor_mentee_assignments")
        .select("id, programs:program_id(id,name,status,slug), mentee:mentee_id(id,full_name,email)")
        .eq("mentor_id", user.id);
      setRows(((data || []) as any).map((r: any) => ({ id: r.id, program: r.programs, mentee: r.mentee })).filter((r: Row) => r.program && r.mentee));
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
            <p className="text-muted-foreground mt-1">Mentees assigned to you across all programs.</p>
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
            <Card><CardContent className="py-12 text-center text-muted-foreground">No mentees assigned{programFilter !== "all" ? " in this program" : ""} yet.</CardContent></Card>
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
                      <div key={r.id} className="flex items-center gap-3 rounded-md border p-3">
                        <Avatar className="h-9 w-9"><AvatarFallback>{initials(r.mentee.full_name)}</AvatarFallback></Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{r.mentee.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{r.mentee.email}</p>
                        </div>
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
