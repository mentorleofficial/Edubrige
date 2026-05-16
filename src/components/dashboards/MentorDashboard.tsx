import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderKanban } from "lucide-react";
import { Link } from "react-router-dom";
import InactiveMentorBanner from "@/components/InactiveMentorBanner";
import { useMyPrograms } from "@/features/programs/hooks/useMyPrograms";
import ProgramBadge from "@/components/programs/ProgramBadge";
import { useMentorDashboardData } from "@/features/mentor-dashboard/useMentorDashboardData";
import NextSessionCard from "./mentor/NextSessionCard";
import MentorStatsRow from "./mentor/MentorStatsRow";
import WeeklySchedule from "./mentor/WeeklySchedule";
import MentorInsightsPanel from "./mentor/MentorInsightsPanel";
import MyMenteesPanel from "./mentor/MyMenteesPanel";
import RecentFeedbackPanel from "./mentor/RecentFeedbackPanel";
import RecentActivityFeed from "./mentor/RecentActivityFeed";

const MentorDashboard = () => {
  const { user, mentorActive } = useAuth();
  const { data, isLoading } = useMentorDashboardData(user?.id);
  const { data: programs = [] } = useMyPrograms();

  const computed = useMemo(() => {
    const sessions = data?.sessions ?? [];
    const now = Date.now();
    const upcoming = sessions.filter(
      (s) => s.status === "booked" && new Date(s.scheduled_at).getTime() >= now
    );
    const completed = sessions.filter((s) => s.status === "completed");
    const hours = completed.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / 60;
    const ratings = (data?.feedback ?? []).map((f) => f.rating);
    const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
    const next = upcoming.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0] ?? null;
    const mentees = new Set(sessions.map((s) => s.mentee_id)).size;
    return {
      upcomingCount: upcoming.length,
      completedCount: completed.length,
      hours,
      avg,
      next,
      mentees,
    };
  }, [data]);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        {!mentorActive && <InactiveMentorBanner />}
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!mentorActive && <InactiveMentorBanner />}

      <NextSessionCard session={computed.next} />

      <MentorStatsRow
        upcoming={computed.upcomingCount}
        completed={computed.completedCount}
        hours={computed.hours}
        avgRating={computed.avg}
        mentees={computed.mentees}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WeeklySchedule sessions={data.sessions} />
        </div>
        <MentorInsightsPanel
          sessions={data.sessions}
          feedback={data.feedback}
          profile={data.profile}
          availabilityCount={data.availabilityCount}
          userId={user?.id}
        />
      </div>

      <MyMenteesPanel sessions={data.sessions} />

      {programs.length > 0 && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">My Programs ({programs.length})</CardTitle>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/mentor/programs">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {programs.slice(0, 6).map((p) => (
              <ProgramBadge key={p.id} name={p.name} color={p.color} to={`/mentor/programs/${p.slug}`} />
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <RecentFeedbackPanel feedback={data.feedback} />
        <RecentActivityFeed sessions={data.sessions} />
      </div>
    </div>
  );
};

export default MentorDashboard;
