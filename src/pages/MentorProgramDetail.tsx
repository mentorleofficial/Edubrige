import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Calendar, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchProgramBySlug,
  fetchProgramMentors,
  fetchProgramMentees,
  fetchProgramTags,
  fetchMyAssignedMentees,
  type Program,
  type ProgramTag,
  type ProgramMember,
} from "@/features/programs/api";

const initials = (n: string) =>
  n.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";

const MentorProgramDetail = () => {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [program, setProgram] = useState<Program | null>(null);
  const [coMentors, setCoMentors] = useState<ProgramMember[]>([]);
  const [myMentees, setMyMentees] = useState<ProgramMember[]>([]);
  const [allMentees, setAllMentees] = useState<ProgramMember[]>([]);
  const [tags, setTags] = useState<ProgramTag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      const p = await fetchProgramBySlug(slug);
      setProgram(p);
      if (p) {
        const [m, t, mm, am] = await Promise.all([
          fetchProgramMentors(p.id),
          fetchProgramTags(p.id),
          fetchMyAssignedMentees(p.id, user.id),
          fetchProgramMentees(p.id),
        ]);
        setCoMentors(m.filter((x) => x.id !== user.id));
        setTags(t);
        setMyMentees(mm);
        setAllMentees(am);
      }
      setLoading(false);
    })();
  }, [slug, user?.id]);

  if (loading) return <AppLayout><p className="text-muted-foreground">Loading…</p></AppLayout>;
  if (!program) {
    return (
      <AppLayout>
        <Card><CardContent className="py-12 text-center text-muted-foreground">Program not found.</CardContent></Card>
      </AppLayout>
    );
  }

  const hsl = program.color || "221 83% 53%";

  return (
    <AppLayout>
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/mentor/programs")} className="-ml-2">
          <ArrowLeft className="mr-1 h-4 w-4" />Back to programs
        </Button>

        <Card className="overflow-hidden">
          <div className="h-1.5 w-full" style={{ backgroundColor: `hsl(${hsl})` }} />
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-2xl">{program.name}</CardTitle>
                {program.description && (
                  <p className="text-muted-foreground mt-2">{program.description}</p>
                )}
              </div>
              <Badge variant="secondary" className="capitalize">{program.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" />{coMentors.length + 1} mentors</span>
              {program.starts_on && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {new Date(program.starts_on).toLocaleDateString()}
                  {program.ends_on ? ` – ${new Date(program.ends_on).toLocaleDateString()}` : ""}
                </span>
              )}
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.map((t) => <Badge key={t.id} variant="outline">{t.label}</Badge>)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">My mentees in this program ({myMentees.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {myMentees.length === 0 ? (
              <p className="text-sm text-muted-foreground">No mentees assigned to you in this program yet.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {myMentees.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 rounded-md border p-3">
                    <Avatar className="h-9 w-9"><AvatarFallback>{initials(m.full_name)}</AvatarFallback></Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{m.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All mentees in this program ({allMentees.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {allMentees.length === 0 ? (
              <p className="text-sm text-muted-foreground">No mentees enrolled in this program yet.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {allMentees.map((m) => {
                  const isMine = myMentees.some((x) => x.id === m.id);
                  return (
                    <div key={m.id} className="flex items-center gap-3 rounded-md border p-3">
                      <Avatar className="h-9 w-9"><AvatarFallback>{initials(m.full_name)}</AvatarFallback></Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{m.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                      </div>
                      {isMine && <Badge variant="secondary" className="text-xs">Assigned to you</Badge>}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Co-mentors</CardTitle></CardHeader>
          <CardContent>
            {coMentors.length === 0 ? (
              <p className="text-sm text-muted-foreground">You're the only mentor in this program.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {coMentors.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 rounded-md border p-3">
                    <Avatar className="h-9 w-9"><AvatarFallback>{initials(m.full_name)}</AvatarFallback></Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{m.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default MentorProgramDetail;
