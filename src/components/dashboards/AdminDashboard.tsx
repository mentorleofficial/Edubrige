import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, BookOpen, Star, Activity, Clock, CalendarDays, ArrowRight } from "lucide-react";

interface RecentSession {
  id: string;
  scheduled_at: string;
  status: string;
  mentor: { full_name: string } | null;
  mentee: { full_name: string } | null;
}

const AdminDashboard = () => {
  const [stats, setStats] = useState({ users: 0, sessions: 0, feedback: 0, mentors: 0, upcoming: 0, week: 0 });
  const [recent, setRecent] = useState<RecentSession[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const nowIso = new Date().toISOString();
      const weekIso = new Date(Date.now() + 7 * 86400000).toISOString();
      const [usersRes, sessionsRes, feedbackRes, mentorsRes, upcomingRes, weekRes, recentRes] = await Promise.all([
        supabase.from("users").select("id", { count: "exact", head: true }),
        supabase.from("sessions").select("id", { count: "exact", head: true }),
        supabase.from("feedback").select("id", { count: "exact", head: true }),
        supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "mentor"),
        supabase.from("sessions").select("id", { count: "exact", head: true }).eq("status", "booked").gte("scheduled_at", nowIso),
        supabase.from("sessions").select("id", { count: "exact", head: true }).gte("scheduled_at", nowIso).lte("scheduled_at", weekIso),
        supabase.from("sessions")
          .select("id, scheduled_at, status, mentor:users!sessions_mentor_id_fkey(full_name), mentee:users!sessions_mentee_id_fkey(full_name)")
          .order("scheduled_at", { ascending: false })
          .limit(5),
      ]);
      setStats({
        users: usersRes.count || 0,
        sessions: sessionsRes.count || 0,
        feedback: feedbackRes.count || 0,
        mentors: mentorsRes.count || 0,
        upcoming: upcomingRes.count || 0,
        week: weekRes.count || 0,
      });
      setRecent((recentRes.data as any) || []);
    };
    fetchData();
  }, []);

  const cards = [
    { title: "Total Users", value: stats.users, icon: Users, link: "/admin/users" },
    { title: "Active Mentors", value: stats.mentors, icon: Activity, link: "/admin/users" },
    { title: "Sessions", value: stats.sessions, icon: BookOpen, link: "/admin/sessions" },
    { title: "Upcoming", value: stats.upcoming, icon: Clock, link: "/admin/sessions" },
    { title: "Next 7 days", value: stats.week, icon: CalendarDays, link: "/admin/sessions" },
    { title: "Feedback", value: stats.feedback, icon: Star, link: "/admin/sessions" },
  ];

  const statusVariant = (s: string): "default" | "secondary" | "destructive" =>
    s === "booked" ? "default" : s === "completed" ? "secondary" : "destructive";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => (
          <Link key={card.title} to={card.link} className="block">
            <Card className="hover:shadow-md transition-shadow h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                <card.icon className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{card.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Recent sessions</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/sessions">View all <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions yet.</p>
          ) : (
            <div className="divide-y">
              {recent.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-3 text-sm">
                  <div className="flex-1">
                    <p className="font-medium">{s.mentor?.full_name || "—"} → {s.mentee?.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{new Date(s.scheduled_at).toLocaleString()}</p>
                  </div>
                  <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
