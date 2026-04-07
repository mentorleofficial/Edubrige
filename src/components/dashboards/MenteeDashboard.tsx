import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, GraduationCap, Clock } from "lucide-react";

const MenteeDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [upcoming, setUpcoming] = useState(0);
  const [total, setTotal] = useState(0);

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
    </div>
  );
};

export default MenteeDashboard;
