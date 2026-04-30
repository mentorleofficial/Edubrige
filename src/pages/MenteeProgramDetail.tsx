import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, Users, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchMenteeProgramOverview } from "@/features/programs/api";

const initials = (n: string) =>
  n.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";

const MenteeProgramDetail = () => {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["mentee-program-overview", slug, user?.id],
    queryFn: () => fetchMenteeProgramOverview(slug, user!.id),
    enabled: !!user?.id && !!slug,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (isError) {
    return (
      <AppLayout>
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-muted-foreground">We couldn't load this program.</p>
            <Button variant="outline" onClick={() => refetch()}>Try again</Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  if (!data) {
    return (
      <AppLayout>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Program not found.
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const { program, mentors, tags, assignedMentor } = data;
  const hsl = program.color || "221 83% 53%";
  // De-dupe assigned mentor from the full list (we'll badge them instead)
  const otherMentors = assignedMentor
    ? mentors.filter((m) => m.id !== assignedMentor.id)
    : mentors;

  return (
    <AppLayout>
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/mentee/programs")}
          className="-ml-2"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to programs
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
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {mentors.length} {mentors.length === 1 ? "mentor" : "mentors"}
              </span>
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
                {tags.map((t) => (
                  <Badge key={t.id} variant="outline">{t.label}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {assignedMentor ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your assigned mentor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>{initials(assignedMentor.full_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{assignedMentor.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{assignedMentor.email}</p>
                </div>
                <Button asChild size="sm">
                  <Link to={`/book/${assignedMentor.id}`}>Book session</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your assigned mentor</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              You haven't been assigned a mentor yet. You can browse all mentors in this
              program below.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg">
              {assignedMentor ? "Other mentors in this program" : "Mentors in this program"}
              {" "}({otherMentors.length})
            </CardTitle>
            {mentors.length > 0 && (
              <Button asChild size="sm" variant="outline">
                <Link to={`/mentors?program=${program.slug}`}>
                  <Search className="mr-1 h-3.5 w-3.5" />
                  Browse all
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {otherMentors.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {mentors.length === 0
                  ? "No mentors in this program yet."
                  : "Your assigned mentor is the only mentor in this program."}
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {otherMentors.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 rounded-md border p-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback>{initials(m.full_name)}</AvatarFallback>
                    </Avatar>
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
