import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMenteeProfileStatus } from "@/features/mentee-onboarding/hooks/useMenteeProfileStatus";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, GraduationCap, Clock, Sparkles, FolderKanban } from "lucide-react";
import { useMyPrograms } from "@/features/programs/hooks/useMyPrograms";
import ProgramBadge from "@/components/programs/ProgramBadge";
import { Link } from "react-router-dom";

const MenteeDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isComplete, loading } = useMenteeProfileStatus(user?.id);
  const [upcoming, setUpcoming] = useState(0);
  const [total, setTotal] = useState(0);

  const { data: programs = [] } = useMyPrograms();

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [upRes, totalRes] = await Promise.all([
        supabase.from("sessions").select("id", { count: "exact", head: true })
          .eq("mentee_id", user.id).eq("status", "booked"),
        supabase.from("sessions").select("id", { count: "exact", head: true })
          .eq("mentee_id", user.id),
      ]);
      setUpcoming(upRes.count || 0);
      setTotal(totalRes.count || 0);
    };
    fetchData();
  }, [user]);

  if (!loading && !isComplete) {
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

  return (
    <div className="space-y-6">
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sessions</CardTitle>
            <BookOpen className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{total}</div></CardContent>
        </Card>
        <Card className="flex flex-col items-center justify-center p-6">
          <GraduationCap className="h-8 w-8 text-accent mb-2" />
          <Button onClick={() => navigate("/mentors")}>Find a Mentor</Button>
        </Card>
      </div>

      {programs.length > 0 && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">My Programs ({programs.length})</CardTitle>
            </div>
            <Button variant="ghost" size="sm" asChild><Link to="/mentee/programs">View all</Link></Button>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {programs.slice(0, 6).map((p) => (
              <ProgramBadge key={p.id} name={p.name} color={p.color} to={`/mentee/programs/${p.slug}`} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MenteeDashboard;
