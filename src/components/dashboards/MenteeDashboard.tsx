import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMenteeProfileStatus } from "@/features/mentee-onboarding/hooks/useMenteeProfileStatus";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";
import { useMyPrograms } from "@/features/programs/hooks/useMyPrograms";
import { useMenteeDashboardData } from "@/features/mentee-dashboard/useMenteeDashboardData";
import NextSessionCard from "./mentee/NextSessionCard";
import StatsRow from "./mentee/StatsRow";
import SessionsCalendar from "./mentee/SessionsCalendar";
import InsightsPanel from "./mentee/InsightsPanel";
import RecommendedMentors from "./mentee/RecommendedMentors";
import RecentActivity from "./mentee/RecentActivity";

const MenteeDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isComplete, loading: onbLoading } = useMenteeProfileStatus(user?.id);
  const { data, isLoading } = useMenteeDashboardData(user?.id);
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
    return { upcomingCount: upcoming.length, completedCount: completed.length, hours, avg, next };
  }, [data]);

  if (!onbLoading && !isComplete) {
    return (
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>Finish setting up your profile</CardTitle>
          </div>
          <CardDescription>
            We need a few details before mentors can match with you. It only takes 2 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="lg" onClick={() => navigate("/onboarding/mentee")}>
            Complete my profile
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const firstName = (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0]
    || user?.email?.split("@")[0]
    || "there";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-serif)" }}>
          Welcome back, {firstName}
        </h2>
        <p className="text-sm text-muted-foreground">
          Here's a snapshot of your mentorship journey.
        </p>
      </div>

      <NextSessionCard session={computed.next} />

      <StatsRow
        upcoming={computed.upcomingCount}
        completed={computed.completedCount}
        hours={computed.hours}
        avgRating={computed.avg}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SessionsCalendar sessions={data.sessions} />
        </div>
        <InsightsPanel
          sessions={data.sessions}
          feedback={data.feedback}
          programsCount={programs.length}
        />
      </div>

      <RecommendedMentors mentors={data.recommended} />

      <RecentActivity sessions={data.sessions} feedback={data.feedback} />
    </div>
  );
};

export default MenteeDashboard;
