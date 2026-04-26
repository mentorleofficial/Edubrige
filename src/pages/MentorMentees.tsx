import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

type Row = {
  id: string;
  program: { id: string; name: string; status: string };
  mentee: { id: string; full_name: string; email: string };
};

const initials = (n: string) => n.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

const MentorMentees = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("mentor_mentee_assignments")
        .select("id, programs:program_id(id,name,status), mentee:mentee_id(id,full_name,email)")
        .eq("mentor_id", user.id);
      setRows(((data || []) as any).map((r: any) => ({ id: r.id, program: r.programs, mentee: r.mentee })).filter((r: Row) => r.program && r.mentee));
      setLoading(false);
    })();
  }, [user]);

  const byProgram = rows.reduce<Record<string, Row[]>>((acc, r) => {
    (acc[r.program.id] ||= []).push(r); return acc;
  }, {});

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">My Mentees</h1>
          <p className="text-muted-foreground mt-1">Mentees assigned to you across all programs.</p>
        </div>
        {loading ? <p className="text-muted-foreground text-sm">Loading…</p> :
          rows.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No mentees assigned yet.</CardContent></Card>
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
