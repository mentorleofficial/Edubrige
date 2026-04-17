import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Clock, Star } from "lucide-react";
import InactiveMentorBanner from "@/components/InactiveMentorBanner";

const MentorDashboard = () => {
  const { user, mentorActive } = useAuth();
  const [upcoming, setUpcoming] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [avgRating, setAvgRating] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [upRes, compRes, fbRes] = await Promise.all([
        supabase.from("sessions").select("id", { count: "exact", head: true })
          .eq("mentor_id", user.id).eq("status", "booked"),
        supabase.from("sessions").select("id", { count: "exact", head: true })
          .eq("mentor_id", user.id).eq("status", "completed"),
        supabase.from("feedback").select("rating, session_id")
          .in("session_id", 
            (await supabase.from("sessions").select("id").eq("mentor_id", user.id)).data?.map(s => s.id) || []
          ),
      ]);
      setUpcoming(upRes.count || 0);
      setCompleted(compRes.count || 0);
      if (fbRes.data && fbRes.data.length > 0) {
        setAvgRating(fbRes.data.reduce((sum, f) => sum + f.rating, 0) / fbRes.data.length);
      }
    };
    fetchData();
  }, [user]);

  return (
    <div className="space-y-4">
      {!mentorActive && <InactiveMentorBanner />}
      <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Upcoming Sessions</CardTitle>
          <Clock className="h-5 w-5 text-primary" />
        </CardHeader>
        <CardContent><div className="text-3xl font-bold">{upcoming}</div></CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          <BookOpen className="h-5 w-5 text-primary" />
        </CardHeader>
        <CardContent><div className="text-3xl font-bold">{completed}</div></CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Avg Rating</CardTitle>
          <Star className="h-5 w-5 text-accent" />
        </CardHeader>
        <CardContent><div className="text-3xl font-bold">{avgRating ? avgRating.toFixed(1) : "—"}</div></CardContent>
      </Card>
      </div>
    </div>
  );
};

export default MentorDashboard;
