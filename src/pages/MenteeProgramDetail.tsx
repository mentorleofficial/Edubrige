import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
  fetchProgramTags,
  fetchMyAssignedMentor,
  type Program,
  type ProgramTag,
  type ProgramMember,
} from "@/features/programs/api";

const initials = (n: string) =>
  n.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";

const MenteeProgramDetail = () => {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [program, setProgram] = useState<Program | null>(null);
  const [mentors, setMentors] = useState<ProgramMember[]>([]);
  const [tags, setTags] = useState<ProgramTag[]>([]);
  const [assigned, setAssigned] = useState<ProgramMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      const p = await fetchProgramBySlug(slug);
      setProgram(p);
      if (p) {
        const [m, t, a] = await Promise.all([
          fetchProgramMentors(p.id),
          fetchProgramTags(p.id),
          fetchMyAssignedMentor(p.id, user.id),
        ]);
        setMentors(m);
        setTags(t);
        setAssigned(a);
      }
      setLoading(false);
    })();
  }, [slug, user?.id]);

  if (loading) {
    return <AppLayout><p className="text-muted-foreground">Loading…</p></AppLayout>;
  }
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
        <Button variant="ghost" size="sm" onClick={() => navigate("/mentee/programs")} className="-ml-2">
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
              <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" />{mentors.length} mentors</span>
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

        {assigned && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Your assigned mentor</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10"><AvatarFallback>{initials(assigned.full_name)}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{assigned.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{assigned.email}</p>
                </div>
                <Button asChild size="sm"><Link to={`/book/${assigned.id}`}>Book session</Link></Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-lg">Mentors in this program</CardTitle></CardHeader>
          <CardContent>
            {mentors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No mentors in this program yet.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {mentors.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 rounded-md border p-3">
                    <Avatar className="h-9 w-9"><AvatarFallback>{initials(m.full_name)}</AvatarFallback></Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/book/${m.id}`}>Book</Link>
                    </Button>
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

export default MenteeProgramDetail;
