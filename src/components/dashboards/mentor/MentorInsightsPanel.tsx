import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sparkles, FileText, MessageSquareWarning, CalendarOff, UserCog, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { formatISTDate } from "@/lib/datetime";
import type {
  MentorDashSession,
  MentorDashFeedback,
  MentorProfileRow,
} from "@/features/mentor-dashboard/useMentorDashboardData";

interface Props {
  sessions: MentorDashSession[];
  feedback: MentorDashFeedback[];
  profile: MentorProfileRow | null;
  availabilityCount: number;
  userId?: string;
}

import { calculateCompleteness } from "@/features/mentor-profile/utils/completeness";

const MentorInsightsPanel = ({ sessions, feedback, profile, availabilityCount, userId }: Props) => {
  const completedSessions = sessions.filter((s) => s.status === "completed");
  const cutoff = Date.now() - 14 * 24 * 3600 * 1000;
  const needsNotes = completedSessions.filter(
    (s) =>
      new Date(s.scheduled_at).getTime() > cutoff &&
      (!s.notes || s.notes.trim().length === 0)
  ).length;

  const ratedIds = new Set(
    feedback
      .filter((f) => f.submitted_by === userId && f.audience === "mentee")
      .map((f) => f.session_id)
  );
  const pendingSessions = completedSessions
    .filter((s) => !ratedIds.has(s.id))
    .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));
  const pendingMenteeFeedback = pendingSessions.length;

  const now = Date.now();
  const upcoming14 = sessions.filter(
    (s) =>
      s.status === "booked" &&
      new Date(s.scheduled_at).getTime() > now &&
      new Date(s.scheduled_at).getTime() < now + 14 * 24 * 3600 * 1000
  ).length;

  const { percentage: completion } = calculateCompleteness(profile ?? {});

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <CardTitle className="text-lg">Action Items</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-card/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <UserCog className="h-4 w-4 text-primary" />
              Profile completeness
            </div>
            <span className="text-sm font-semibold">{completion}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${completion}%` }}
            />
          </div>
          {completion < 100 && (
            <Button asChild variant="link" className="mt-1 h-auto p-0 text-xs">
              <Link to="/mentor/profile">Complete profile</Link>
            </Button>
          )}
        </div>

        {needsNotes > 0 && (
          <div className="flex items-start gap-3 rounded-md border bg-card/50 p-3">
            <FileText className="mt-0.5 h-4 w-4 text-primary" />
            <div className="flex-1">
              <div className="text-sm font-medium">
                {needsNotes} session{needsNotes > 1 ? "s need" : " needs"} notes
              </div>
              <Button asChild variant="link" className="h-auto p-0 text-xs">
                <Link to="/mentor/sessions">Add notes</Link>
              </Button>
            </div>
          </div>
        )}

        {pendingMenteeFeedback > 0 && (
          <div className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
            <MessageSquareWarning className="mt-0.5 h-4 w-4 text-amber-500" />
            <div className="flex-1">
              <div className="text-sm font-medium">
                {pendingMenteeFeedback} pending mentee feedback
              </div>
              <Button asChild variant="link" className="h-auto p-0 text-xs">
                <Link to="/mentor/sessions">Share feedback</Link>
              </Button>
            </div>
          </div>
        )}

        {(availabilityCount === 0 || upcoming14 === 0) && (
          <div className="flex items-start gap-3 rounded-md border bg-card/50 p-3">
            <CalendarOff className="mt-0.5 h-4 w-4 text-primary" />
            <div className="flex-1 text-sm">
              {availabilityCount === 0
                ? "You haven't set availability yet."
                : "Nothing booked in the next 2 weeks."}{" "}
              <Link to="/mentor/availability" className="text-primary underline">
                Update slots
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MentorInsightsPanel;
