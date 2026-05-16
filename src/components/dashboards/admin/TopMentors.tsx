import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import type {
  AdminFeedbackRow,
  AdminMentorLite,
  AdminSessionRow,
} from "@/features/admin-dashboard/useAdminDashboardData";

interface Props {
  sessions: AdminSessionRow[];
  feedback: AdminFeedbackRow[];
  mentorsById: Record<string, AdminMentorLite>;
}

const TopMentors = ({ sessions, feedback, mentorsById }: Props) => {
  // map session -> mentor
  const sessionMentor: Record<string, string> = {};
  sessions.forEach((s) => {
    sessionMentor[s.id] = s.mentor_id;
  });
  const ratingsByMentor: Record<string, number[]> = {};
  feedback.forEach((f) => {
    const m = sessionMentor[f.session_id];
    if (!m) return;
    (ratingsByMentor[m] ||= []).push(f.rating);
  });

  const counts: Record<string, number> = {};
  sessions
    .filter((s) => s.status === "completed")
    .forEach((s) => {
      counts[s.mentor_id] = (counts[s.mentor_id] || 0) + 1;
    });

  const list = Object.entries(counts)
    .map(([id, count]) => {
      const ratings = ratingsByMentor[id] || [];
      const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
      return { id, count, avg, mentor: mentorsById[id] };
    })
    .filter((x) => !!x.mentor)
    .sort((a, b) => b.count - a.count || (b.avg ?? 0) - (a.avg ?? 0))
    .slice(0, 5);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <Trophy className="h-5 w-5 text-accent" />
        <CardTitle className="text-lg">Top Mentors · 30 days</CardTitle>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed sessions yet.</p>
        ) : (
          <ul className="space-y-2">
            {list.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-md border bg-card/40 p-2 text-sm"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={m.mentor.avatar_url ?? undefined} />
                  <AvatarFallback>
                    {m.mentor.full_name
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <Link to="/admin/users" className="min-w-0 flex-1 truncate font-medium hover:underline">
                  {m.mentor.full_name}
                </Link>
                <span className="text-xs text-muted-foreground">{m.count} sessions</span>
                <span className="text-xs font-semibold">
                  {m.avg === null ? "—" : `${m.avg.toFixed(1)} ★`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default TopMentors;
