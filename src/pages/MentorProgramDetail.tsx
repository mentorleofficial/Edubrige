import { formatISTDate } from "@/lib/datetime";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Calendar, Users, UserCheck } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

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
  const [searchTerm, setSearchTerm] = useState("");

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

  const filteredAllMentees = allMentees.filter((m) =>
    m.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20">
          <p className="text-muted-foreground">Loading program...</p>
        </div>
      </AppLayout>
    );
  }

  if (!program) {
    return (
      <AppLayout>
        <Card className="max-w-md mx-auto mt-12">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Program not found.</p>
            <Button onClick={() => navigate("/mentor/programs")} className="mt-6">
              Back to Programs
            </Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const hsl = program.color || "221 83% 53%";
  const totalMentors = coMentors.length + 1;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/mentor/programs")}
          className="-ml-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Programs
        </Button>

        {/* Program Header - Compact & Professional */}
        <Card className="overflow-hidden">
          <div className="h-2 w-full" style={{ backgroundColor: `hsl(${hsl})` }} />
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="capitalize">
                    {program.status}
                  </Badge>
                </div>
                <CardTitle className="text-3xl">{program.name}</CardTitle>
                {program.description && (
                  <p className="text-muted-foreground text-[15px] max-w-2xl">
                    {program.description}
                  </p>
                )}
              </div>

              <div className="flex flex-col items-end gap-2 text-sm text-muted-foreground">
                {program.starts_on && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {formatISTDate(program.starts_on)}
                      {program.ends_on && ` — ${formatISTDate(program.ends_on)}`}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-5 mt-2">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    <span>{totalMentors} Mentors</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="h-4 w-4" />
                    <span>{allMentees.length} Mentees</span>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>

          {tags.length > 0 && (
            <>
              <Separator />
              <CardContent className="pt-4">
                <div className="flex flex-wrap gap-2">
                  {tags.map((t) => (
                    <Badge key={t.id} variant="outline">
                      {t.label}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </>
          )}
        </Card>

        {/* Tabs Section */}
        <Tabs defaultValue="my-mentees" className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="my-mentees">My Mentees</TabsTrigger>
            <TabsTrigger value="all-mentees">All Mentees</TabsTrigger>
            <TabsTrigger value="co-mentors">Co-Mentors</TabsTrigger>
          </TabsList>

          {/* My Mentees */}
          <TabsContent value="my-mentees" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">My Mentees ({myMentees.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {myMentees.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    No mentees assigned to you yet.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {myMentees.map((mentee) => (
                      <div
                        key={mentee.id}
                        className="flex items-center gap-4 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                      >
                        <Avatar className="h-11 w-11">
                          <AvatarFallback>{initials(mentee.full_name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{mentee.full_name}</p>
                          <p className="text-sm text-muted-foreground truncate">{mentee.email}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs">Assigned</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* All Mentees */}
          <TabsContent value="all-mentees" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <CardTitle className="text-lg">All Mentees ({allMentees.length})</CardTitle>
                  <div className="relative w-full sm:w-80">
                    <Input
                      placeholder="Search by name or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredAllMentees.length === 0 ? (
                  <p className="text-center py-12 text-muted-foreground">
                    No matching mentees found.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredAllMentees.map((mentee) => {
                      const isMine = myMentees.some((x) => x.id === mentee.id);
                      return (
                        <div
                          key={mentee.id}
                          className="flex items-center gap-4 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                        >
                          <Avatar className="h-11 w-11">
                            <AvatarFallback>{initials(mentee.full_name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{mentee.full_name}</p>
                            <p className="text-sm text-muted-foreground truncate">{mentee.email}</p>
                          </div>
                          {isMine && <Badge variant="secondary" className="text-xs">Yours</Badge>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Co-Mentors */}
          <TabsContent value="co-mentors" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Co-Mentors ({coMentors.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {coMentors.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    You are the only mentor in this program.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {coMentors.map((mentor) => (
                      <div
                        key={mentor.id}
                        className="flex items-center gap-4 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                      >
                        <Avatar className="h-11 w-11">
                          <AvatarFallback>{initials(mentor.full_name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{mentor.full_name}</p>
                          <p className="text-sm text-muted-foreground truncate">{mentor.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default MentorProgramDetail;