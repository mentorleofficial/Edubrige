import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, CheckCircle, Globe, Info } from "lucide-react";
import { format, addDays, startOfWeek, setHours, setMinutes, parseISO, isSameDay } from "date-fns";

interface Slot { id: string; day_of_week: number; start_time: string; end_time: string; }
interface Override { id: string; date: string; is_unavailable: boolean; start_time: string | null; end_time: string | null; }
interface BookableSlot { key: string; date: Date; start_time: string; end_time: string; source: "weekly" | "override"; }

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const BookSession = () => {
  const { mentorId } = useParams<{ mentorId: string }>();
  const [params] = useSearchParams();
  const rescheduleId = params.get("reschedule");
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mentor, setMentor] = useState<any>(null);
  const [timezone, setTimezone] = useState<string>("UTC");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [bookedTimes, setBookedTimes] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<BookableSlot | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    if (!mentorId) return;
    Promise.all([
      supabase.from("users").select("id, full_name, avatar_url").eq("id", mentorId).single(),
      supabase.from("mentor_availability").select("*").eq("mentor_id", mentorId).order("day_of_week"),
      supabase.from("mentor_profiles").select("is_active, timezone").eq("user_id", mentorId).maybeSingle(),
      supabase.from("mentor_availability_overrides").select("*").eq("mentor_id", mentorId)
        .gte("date", new Date().toISOString().slice(0, 10)).order("date"),
      supabase.from("sessions").select("scheduled_at, duration_minutes")
        .eq("mentor_id", mentorId).eq("status", "booked")
        .gte("scheduled_at", new Date().toISOString()),
    ]).then(([mentorRes, slotsRes, mpRes, ovRes, bookedRes]) => {
      if (!mpRes.data?.is_active) {
        toast({ variant: "destructive", title: "Mentor unavailable", description: "This mentor is not currently accepting bookings." });
        navigate("/mentors");
        return;
      }
      setMentor(mentorRes.data);
      setSlots((slotsRes.data || []) as Slot[]);
      setTimezone((mpRes.data?.timezone as string) ?? "UTC");
      setOverrides((ovRes.data || []) as Override[]);
      const taken = new Set<string>();
      (bookedRes.data || []).forEach((s: any) => taken.add(new Date(s.scheduled_at).toISOString()));
      setBookedTimes(taken);
    });
  }, [mentorId, navigate, toast]);

  const bookable = useMemo<BookableSlot[]>(() => {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 0 });
    const result: BookableSlot[] = [];
    for (let week = 0; week < 4; week++) {
      for (const slot of slots) {
        const date = addDays(start, slot.day_of_week + week * 7);
        if (date <= now) continue;
        const ov = overrides.find((o) => isSameDay(parseISO(o.date), date));
        if (ov?.is_unavailable) continue;
        if (ov && !ov.is_unavailable) continue;
        result.push({ key: `${slot.id}-${date.toISOString()}`, date, start_time: slot.start_time.slice(0, 5), end_time: slot.end_time.slice(0, 5), source: "weekly" });
      }
    }
    for (const ov of overrides) {
      if (ov.is_unavailable || !ov.start_time || !ov.end_time) continue;
      const date = parseISO(ov.date);
      if (date <= now) continue;
      result.push({ key: `ov-${ov.id}`, date, start_time: ov.start_time.slice(0, 5), end_time: ov.end_time.slice(0, 5), source: "override" });
    }
    return result.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [slots, overrides]);

  const isSlotTaken = (slot: BookableSlot) => {
    const [h, m] = slot.start_time.split(":").map(Number);
    const dt = setMinutes(setHours(slot.date, h), m).toISOString();
    return bookedTimes.has(dt);
  };

  const handleBook = async () => {
    if (!selected || !user || !mentorId) return;
    setBooking(true);
    const [hours, minutes] = selected.start_time.split(":").map(Number);
    const scheduledAt = setMinutes(setHours(selected.date, hours), minutes);
    const [endH, endM] = selected.end_time.split(":").map(Number);
    const duration = endH * 60 + endM - (hours * 60 + minutes);

    const { data: inserted, error } = await supabase.from("sessions").insert({
      mentor_id: mentorId,
      mentee_id: user.id,
      scheduled_at: scheduledAt.toISOString(),
      duration_minutes: duration,
      mentee_notes: notes,
    }).select("id").single();

    if (error) {
      const friendly = error.message.includes("overlap") || error.code === "23P01" || error.code === "23505"
        ? "That slot was just taken — please pick another."
        : error.message;
      toast({ variant: "destructive", title: "Booking failed", description: friendly });
      setBooking(false);
      setConfirmOpen(false);
      return;
    }

    // If rescheduling, cancel the old session
    if (rescheduleId && inserted) {
      await supabase.from("sessions").update({
        status: "cancelled",
        cancelled_by: user.id,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: "Rescheduled",
      }).eq("id", rescheduleId);
    }

    toast({ title: rescheduleId ? "Session rescheduled" : "Session booked!", description: `Scheduled for ${format(scheduledAt, "PPP 'at' p")}` });
    navigate("/mentee/sessions");
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
            <h1 className="text-3xl font-bold">{rescheduleId ? "Reschedule" : "Book"} with {mentor.full_name}</h1>
            <p className="text-muted-foreground">Select an available time slot.</p>
          </div>
        </div>

        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Globe className="h-3 w-3" /> Times shown in mentor's timezone:{" "}
          <span className="font-medium">{timezone}</span>
        </p>

        {bookable.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">This mentor has no available slots.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {bookable.map((slot) => {
              const taken = isSlotTaken(slot);
              const isSelected = selected?.key === slot.key;
              return (
                <Card
                  key={slot.key}
                  className={`transition-all ${taken ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${isSelected ? "ring-2 ring-primary" : !taken && "hover:shadow-md"}`}
                  onClick={() => !taken && setSelected(slot)}
                >
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">{DAYS[slot.date.getDay()]}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(slot.date, "MMMM d, yyyy")}
                          {slot.source === "override" && <span className="ml-2 text-primary">(special hours)</span>}
                          {taken && <span className="ml-2 text-destructive">(taken)</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{slot.start_time} – {slot.end_time}</span>
                      {isSelected && <CheckCircle className="h-5 w-5 text-primary" />}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {selected && (
          <Card>
            <CardContent className="py-4 space-y-3">
              <Label htmlFor="notes" className="flex items-center gap-2">
                <Info className="h-4 w-4" /> What would you like to discuss? (optional)
              </Label>
              <Textarea
                id="notes" rows={3}
                placeholder="Share your goals, questions, or topics so your mentor can prepare…"
                value={notes} onChange={(e) => setNotes(e.target.value)}
              />
              <Button className="w-full" size="lg" onClick={() => setConfirmOpen(true)} disabled={booking}>
                {rescheduleId ? "Reschedule to this slot" : "Confirm Booking"}
              </Button>
            </CardContent>
          </Card>
        )}

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm booking</AlertDialogTitle>
              <AlertDialogDescription>
                {selected && (
                  <>Book a session with <strong>{mentor.full_name}</strong> on{" "}
                  <strong>{format(selected.date, "PPP")} at {selected.start_time}</strong>?</>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={booking}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleBook} disabled={booking}>
                {booking ? "Booking…" : "Confirm"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};

export default BookSession;
