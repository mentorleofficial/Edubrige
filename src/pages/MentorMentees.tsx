import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMyPrograms } from "@/features/programs/hooks/useMyPrograms";
import { useMentorMentees, type MentorMenteeRow } from "@/features/mentor-mentees/useMentorMentees";
import { MenteeDetailsDialog } from "@/features/mentor-mentees/components/MenteeDetailsDialog";

const initials = (n: string) => n.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

const MentorMentees = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const { data: rows = [], isLoading } = useMentorMentees(user?.id);
  const { data: myPrograms = [] } = useMyPrograms();
  const [selectedMenteeId, setSelectedMenteeId] = useState<string | null>(null);

  const programFilter = params.get("program") || "all";

  const filteredRows = useMemo(() => {
    if (programFilter === "all") return rows;
    return rows.filter((r) => r.program.slug === programFilter);
  }, [rows, programFilter]);

  const byProgram = useMemo(
    () =>
      filteredRows.reduce<Record<string, MentorMenteeRow[]>>((acc, r) => {
        (acc[r.program.id] ||= []).push(r);
        return acc;
      }, {}),
    [filteredRows]
  );

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

        {isLoading ? <p className="text-muted-foreground text-sm">Loading…</p> :
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
                        <div className="flex items-center gap-2">
                          {r.assigned && <Badge variant="secondary" className="text-xs">Assigned</Badge>}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedMenteeId(r.mentee.id)}
                            className="text-xs h-7 px-2"
                          >
                            Details
                          </Button>
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

      <MenteeDetailsDialog
        menteeId={selectedMenteeId}
        open={!!selectedMenteeId}
        onOpenChange={(open) => {
          if (!open) setSelectedMenteeId(null);
        }}
      />
    </AppLayout>
  );
};

export default MentorMentees;
