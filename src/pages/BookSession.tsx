import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, CheckCircle } from "lucide-react";
import { format, addDays, startOfWeek, setHours, setMinutes } from "date-fns";

interface Slot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const BookSession = () => {
  const { mentorId } = useParams<{ mentorId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mentor, setMentor] = useState<any>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    if (!mentorId) return;
    Promise.all([
      supabase.from("users").select("id, full_name, avatar_url").eq("id", mentorId).single(),
      supabase.from("mentor_availability").select("*").eq("mentor_id", mentorId).order("day_of_week"),
      supabase.from("mentor_profiles").select("is_active").eq("user_id", mentorId).maybeSingle(),
    ]).then(([mentorRes, slotsRes, mpRes]) => {
      if (!mpRes.data?.is_active) {
        toast({ variant: "destructive", title: "Mentor unavailable", description: "This mentor is not currently accepting bookings." });
        navigate("/mentors");
        return;
      }
      setMentor(mentorRes.data);
      setSlots(slotsRes.data || []);
    });
  }, [mentorId, navigate, toast]);

  const getNextDateForDay = (dayOfWeek: number) => {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 0 });
    let target = addDays(start, dayOfWeek);
    if (target <= now) target = addDays(target, 7);
    return target;
  };

  const handleBook = async () => {
    if (!selectedSlot || !selectedDate || !user || !mentorId) return;
    setBooking(true);
    const [hours, minutes] = selectedSlot.start_time.split(":").map(Number);
    const scheduledAt = setMinutes(setHours(selectedDate, hours), minutes);
    const [endH, endM] = selectedSlot.end_time.split(":").map(Number);
    const duration = (endH * 60 + endM) - (hours * 60 + minutes);

    const { error } = await supabase.from("sessions").insert({
      mentor_id: mentorId,
      mentee_id: user.id,
      scheduled_at: scheduledAt.toISOString(),
      duration_minutes: duration,
    });

    if (error) {
      toast({ variant: "destructive", title: "Booking failed", description: error.message });
    } else {
      toast({ title: "Session booked!", description: `Scheduled for ${format(scheduledAt, "PPP 'at' p")}` });
      navigate("/mentee/sessions");
    }
    setBooking(false);
  };

  if (!mentor) return <AppLayout><p className="text-muted-foreground">Loading…</p></AppLayout>;

  const initials = mentor.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase();

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-bold">Book with {mentor.full_name}</h1>
            <p className="text-muted-foreground">Select an available time slot.</p>
          </div>
        </div>

        {slots.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">This mentor has no available slots.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {slots.map((slot) => {
              const nextDate = getNextDateForDay(slot.day_of_week);
              const isSelected = selectedSlot?.id === slot.id;
              return (
                <Card
                  key={slot.id}
                  className={`cursor-pointer transition-all ${isSelected ? "ring-2 ring-primary" : "hover:shadow-md"}`}
                  onClick={() => { setSelectedSlot(slot); setSelectedDate(nextDate); }}
                >
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">{DAYS[slot.day_of_week]}</p>
                        <p className="text-sm text-muted-foreground">{format(nextDate, "MMMM d, yyyy")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}</span>
                      {isSelected && <CheckCircle className="h-5 w-5 text-primary" />}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {selectedSlot && (
          <Button className="w-full" size="lg" onClick={handleBook} disabled={booking}>
            {booking ? "Booking…" : "Confirm Booking"}
          </Button>
        )}
      </div>
    </AppLayout>
  );
};

export default BookSession;
