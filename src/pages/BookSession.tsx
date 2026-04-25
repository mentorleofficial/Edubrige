import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, CheckCircle, Globe } from "lucide-react";
import { format, addDays, startOfWeek, setHours, setMinutes, parseISO, isSameDay } from "date-fns";

interface Slot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface Override {
  id: string;
  date: string;
  is_unavailable: boolean;
  start_time: string | null;
  end_time: string | null;
}

interface BookableSlot {
  key: string;
  date: Date;
  start_time: string;
  end_time: string;
  source: "weekly" | "override";
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const BookSession = () => {
  const { mentorId } = useParams<{ mentorId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mentor, setMentor] = useState<any>(null);
  const [timezone, setTimezone] = useState<string>("UTC");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [selected, setSelected] = useState<BookableSlot | null>(null);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    if (!mentorId) return;
    Promise.all([
      supabase.from("users").select("id, full_name, avatar_url").eq("id", mentorId).single(),
      supabase.from("mentor_availability").select("*").eq("mentor_id", mentorId).order("day_of_week"),
      supabase
        .from("mentor_profiles")
        .select("is_active, timezone")
        .eq("user_id", mentorId)
        .maybeSingle(),
      supabase
        .from("mentor_availability_overrides")
        .select("*")
        .eq("mentor_id", mentorId)
        .gte("date", new Date().toISOString().slice(0, 10))
        .order("date"),
    ]).then(([mentorRes, slotsRes, mpRes, ovRes]) => {
      if (!mpRes.data?.is_active) {
        toast({
          variant: "destructive",
          title: "Mentor unavailable",
          description: "This mentor is not currently accepting bookings.",
        });
        navigate("/mentors");
        return;
      }
      setMentor(mentorRes.data);
      setSlots((slotsRes.data || []) as Slot[]);
      setTimezone((mpRes.data?.timezone as string) ?? "UTC");
      setOverrides((ovRes.data || []) as Override[]);
    });
  }, [mentorId, navigate, toast]);

  const bookable = useMemo<BookableSlot[]>(() => {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 0 });
    const result: BookableSlot[] = [];

    // Look 4 weeks ahead
    for (let week = 0; week < 4; week++) {
      for (const slot of slots) {
        const date = addDays(start, slot.day_of_week + week * 7);
        if (date <= now) continue;

        // Check for overrides on this date
        const ov = overrides.find((o) => isSameDay(parseISO(o.date), date));
        if (ov?.is_unavailable) continue;
        if (ov && !ov.is_unavailable) continue; // weekly slots replaced by override

        result.push({
          key: `${slot.id}-${date.toISOString()}`,
          date,
          start_time: slot.start_time.slice(0, 5),
          end_time: slot.end_time.slice(0, 5),
          source: "weekly",
        });
      }
    }

    // Add custom-hour overrides
    for (const ov of overrides) {
      if (ov.is_unavailable || !ov.start_time || !ov.end_time) continue;
      const date = parseISO(ov.date);
      if (date <= now) continue;
      result.push({
        key: `ov-${ov.id}`,
        date,
        start_time: ov.start_time.slice(0, 5),
        end_time: ov.end_time.slice(0, 5),
        source: "override",
      });
    }

    return result.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [slots, overrides]);

  const handleBook = async () => {
    if (!selected || !user || !mentorId) return;
    setBooking(true);
    const [hours, minutes] = selected.start_time.split(":").map(Number);
    const scheduledAt = setMinutes(setHours(selected.date, hours), minutes);
    const [endH, endM] = selected.end_time.split(":").map(Number);
    const duration = endH * 60 + endM - (hours * 60 + minutes);

    const { error } = await supabase.from("sessions").insert({
      mentor_id: mentorId,
      mentee_id: user.id,
      scheduled_at: scheduledAt.toISOString(),
      duration_minutes: duration,
    });

    if (error) {
      toast({ variant: "destructive", title: "Booking failed", description: error.message });
    } else {
      toast({
        title: "Session booked!",
        description: `Scheduled for ${format(scheduledAt, "PPP 'at' p")}`,
      });
      navigate("/mentee/sessions");
    }
    setBooking(false);
  };

  if (!mentor)
    return (
      <AppLayout>
        <p className="text-muted-foreground">Loading…</p>
      </AppLayout>
    );

  const initials = mentor.full_name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase();

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-bold">Book with {mentor.full_name}</h1>
            <p className="text-muted-foreground">Select an available time slot.</p>
          </div>
        </div>

        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Globe className="h-3 w-3" /> Times shown in mentor's timezone:{" "}
          <span className="font-medium">{timezone}</span>
        </p>

        {bookable.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              This mentor has no available slots.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {bookable.map((slot) => {
              const isSelected = selected?.key === slot.key;
              return (
                <Card
                  key={slot.key}
                  className={`cursor-pointer transition-all ${
                    isSelected ? "ring-2 ring-primary" : "hover:shadow-md"
                  }`}
                  onClick={() => setSelected(slot)}
                >
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">{DAYS[slot.date.getDay()]}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(slot.date, "MMMM d, yyyy")}
                          {slot.source === "override" && (
                            <span className="ml-2 text-primary">(special hours)</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {slot.start_time} – {slot.end_time}
                      </span>
                      {isSelected && <CheckCircle className="h-5 w-5 text-primary" />}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {selected && (
          <Button className="w-full" size="lg" onClick={handleBook} disabled={booking}>
            {booking ? "Booking…" : "Confirm Booking"}
          </Button>
        )}
      </div>
    </AppLayout>
  );
};

export default BookSession;
