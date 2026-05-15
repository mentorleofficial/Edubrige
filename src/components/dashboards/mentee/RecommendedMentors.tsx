import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";
import { Link } from "react-router-dom";
import type { RecommendedMentor } from "@/features/mentee-dashboard/useMenteeDashboardData";

const RecommendedMentors = ({ mentors }: { mentors: RecommendedMentor[] }) => {
  if (mentors.length === 0) return null;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Compass className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Recommended for you</CardTitle>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/mentors">Browse all</Link>
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {mentors.map((m) => {
          const initials = m.full_name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
          const target = m.slug ? `/mentors/${m.slug}` : `/mentors/${m.user_id}`;
          return (
            <Link
              key={m.user_id}
              to={target}
              className="group flex flex-col rounded-lg border bg-card/50 p-4 transition hover:border-primary/40 hover:bg-card"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={m.avatar_url ?? undefined} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold group-hover:text-primary">{m.full_name}</div>
                  {m.headline && (
                    <div className="truncate text-xs text-muted-foreground">{m.headline}</div>
                  )}
                </div>
              </div>
              {m.expertise && m.expertise.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {m.expertise.slice(0, 3).map((e) => (
                    <Badge key={e} variant="secondary" className="text-xs">{e}</Badge>
                  ))}
                </div>
              )}
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default RecommendedMentors;
