import { formatISTDate } from "@/lib/datetime";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, Users, Search, UserCheck } from "lucide-react";
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
        <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <Skeleton className="lg:col-span-5 h-80" />
            <Skeleton className="lg:col-span-7 h-96" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (isError || !data) {
    return (
      <AppLayout>
        <div className="max-w-5xl mx-auto px-6 py-10">
          <Card>
            <CardContent className="py-16 text-center space-y-4">
              <p className="text-muted-foreground">We couldn't load this program.</p>
              <Button variant="outline" onClick={() => refetch()}>Try again</Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const { program, mentors, tags, assignedMentor } = data;
  const hsl = program.color || "221 83% 53%";

  const otherMentors = assignedMentor
    ? mentors.filter((m) => m.id !== assignedMentor.id)
    : mentors;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/mentee/programs")}
          className="-ml-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Programs
        </Button>

        {/* Program Header */}
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="h-3 w-full" style={{ backgroundColor: `hsl(${hsl})` }} />
          <CardHeader className="pt-8 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-3">
                <CardTitle className="text-3xl font-bold">{program.name}</CardTitle>
                {program.description && (
                  <p className="text-lg text-muted-foreground max-w-2xl">{program.description}</p>
                )}
              </div>
              <Badge variant="secondary" className="capitalize text-sm px-4 py-1.5">
                {program.status}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pb-8">
            <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <span>{mentors.length} Mentor{mentors.length !== 1 && "s"}</span>
              </div>
              {program.starts_on && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  <span>
                    {formatISTDate(program.starts_on)}
                    {program.ends_on && ` — ${formatISTDate(program.ends_on)}`}
                  </span>
                </div>
              )}
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <Badge key={t.id} variant="outline" className="font-normal">
                    {t.label}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Assigned Mentor */}
          <div className="lg:col-span-5">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-xl">
                  <UserCheck className="h-5 w-5 text-green-600" />
                  Your Assigned Mentor
                </CardTitle>
              </CardHeader>
              <CardContent>
                {assignedMentor ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16 ring-2 ring-offset-2 ring-green-100">
                        <AvatarFallback className="text-2xl">
                          {initials(assignedMentor.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-xl font-semibold truncate">{assignedMentor.full_name}</p>
                        <p className="text-muted-foreground">{assignedMentor.email}</p>
                      </div>
                    </div>

                    <Button asChild size="lg" className="w-full">
                      <Link to={`/book/${assignedMentor.id}?programId=${program.id}`}>
                        Book a Session
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    You haven't been assigned a mentor yet.
                    <p className="mt-2 text-sm">Browse available mentors below.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Other Mentors */}
          <div className="lg:col-span-7">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl">
                    {assignedMentor ? "Other Mentors" : "Available Mentors"}
                  </CardTitle>
                  <CardDescription>
                    {otherMentors.length} mentor{otherMentors.length !== 1 && "s"} in this program
                  </CardDescription>
                </div>
                {mentors.length > 0 && (
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/mentors?program=${program.slug}`}>
                      <Search className="mr-2 h-4 w-4" />
                      Browse All
                    </Link>
                  </Button>
                )}
              </CardHeader>

              <CardContent>
                {otherMentors.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    No other mentors available in this program yet.
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {otherMentors.map((mentor) => (
                      <Card key={mentor.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-5">
                          <div className="flex items-start gap-4">
                            <Avatar className="h-12 w-12">
                              <AvatarFallback>{initials(mentor.full_name)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0 pt-1">
                              <p className="font-medium truncate">{mentor.full_name}</p>
                              <p className="text-sm text-muted-foreground truncate">{mentor.email}</p>
                            </div>
                          </div>

                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="w-full mt-5"
                          >
                            <Link to={`/book/${mentor.id}?programId=${program.id}`}>
                              Book Session
                            </Link>
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default MenteeProgramDetail;