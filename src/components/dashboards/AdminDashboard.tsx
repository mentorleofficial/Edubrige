import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookOpen, Star, Activity } from "lucide-react";

const AdminDashboard = () => {
  const [stats, setStats] = useState({ users: 0, sessions: 0, feedback: 0, mentors: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const [usersRes, sessionsRes, feedbackRes, mentorsRes] = await Promise.all([
        supabase.from("users").select("id", { count: "exact", head: true }),
        supabase.from("sessions").select("id", { count: "exact", head: true }),
        supabase.from("feedback").select("id", { count: "exact", head: true }),
        supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "mentor"),
      ]);
      setStats({
        users: usersRes.count || 0,
        sessions: sessionsRes.count || 0,
        feedback: feedbackRes.count || 0,
        mentors: mentorsRes.count || 0,
      });
    };
    fetchStats();
  }, []);

  const cards = [
    { title: "Total Users", value: stats.users, icon: Users, color: "text-primary" },
    { title: "Active Mentors", value: stats.mentors, icon: Activity, color: "text-accent" },
    { title: "Sessions", value: stats.sessions, icon: BookOpen, color: "text-primary" },
    { title: "Feedback", value: stats.feedback, icon: Star, color: "text-accent" },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
            <card.icon className={`h-5 w-5 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default AdminDashboard;
