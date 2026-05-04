import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, CheckCircle, Globe, Info } from "lucide-react";
import { format, setHours, setMinutes } from "date-fns";
import { cn } from "@/lib/utils";
import {
  getMonthMatrix,
  getRangesForDate,
  getOverrideKind,
  sliceIntoSlots,
  formatSlotLabel,
  hasAnyAvailability,
  isSameDay,
} from "@/features/availability/previewUtils";

interface Slot { id: string; day_of_week: number; start_time: string; end_time: string; }
interface Override { id: string; date: string; is_unavailable: boolean; start_time: string | null; end_time: string | null; }

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const MAX_DAYS_AHEAD = 90;

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

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);
  const maxDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + MAX_DAYS_AHEAD);
    return d;
  }, [today]);

  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
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

  const matrix = useMemo(
    () => getMonthMatrix(cursor.getFullYear(), cursor.getMonth()),
    [cursor]
  );

  const isoForSlot = (date: Date, hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return setMinutes(setHours(date, h), m).toISOString();
  };

  const isSlotTaken = (date: Date, hhmm: string) => bookedTimes.has(isoForSlot(date, hhmm));

  const isDayFullyBooked = (date: Date) => {
    const ranges = getRangesForDate(date, slots, overrides);
    const list = sliceIntoSlots(ranges, 30);
    if (list.length === 0) return false;
    return list.every((t) => isSlotTaken(date, t));
  };

  const goPrev = () => {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
    if (next < new Date(today.getFullYear(), today.getMonth(), 1)) return;
    setCursor(next);
  };
  const goNext = () => {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    if (next > maxDate) return;
    setCursor(next);
  };

  const dayRanges = selectedDate ? getRangesForDate(selectedDate, slots, overrides) : [];
  const daySlotList = sliceIntoSlots(dayRanges, 30);
  const selectedKind = selectedDate ? getOverrideKind(selectedDate, overrides) : null;

  const slotEndForSelected = (() => {
    if (!selectedDate || !selectedTime) return null;
    // derive end time = start + 30 minutes (matches sliceIntoSlots step)
    const [h, m] = selectedTime.split(":").map(Number);
    const total = h * 60 + m + 30;
    const eh = Math.floor(total / 60);
    const em = total % 60;
    return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
  })();

  const handleBook = async () => {
    if (!selectedDate || !selectedTime || !user || !mentorId) return;
    setBooking(true);
    const [hours, minutes] = selectedTime.split(":").map(Number);
    const scheduledAt = setMinutes(setHours(selectedDate, hours), minutes);

    const { data: inserted, error } = await supabase.from("sessions").insert({
      mentor_id: mentorId,
      mentee_id: user.id,
      scheduled_at: scheduledAt.toISOString(),
      duration_minutes: 30,
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
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-bold">{rescheduleId ? "Reschedule" : "Book"} with {mentor.full_name}</h1>
            <p className="text-muted-foreground">Pick a date, then choose an available time.</p>
          </div>
        </div>

        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Globe className="h-3 w-3" /> Times shown in mentor's timezone:{" "}
          <span className="font-medium">{timezone}</span>
        </p>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Calendar */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goPrev} aria-label="Previous month">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <CardTitle className="text-base">
                  {MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}
                </CardTitle>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goNext} aria-label="Next month">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-wide text-muted-foreground text-center">
                {DOW_LABELS.map((d, i) => (<div key={i}>{d}</div>))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {matrix.flat().map((date, i) => {
                  const inMonth = date.getMonth() === cursor.getMonth();
                  const isPast = date < today;
                  const tooFar = date > maxDate;
                  const kind = getOverrideKind(date, overrides);
                  const hasAvail = hasAnyAvailability(date, slots, overrides);
                  const fullyBooked = hasAvail && isDayFullyBooked(date);
                  const isSelected = selectedDate && isSameDay(date, selectedDate);
                  const isToday = isSameDay(date, today);
                  const isBlocked = kind === "blocked";
                  const isCustom = kind === "custom";
                  const clickable = inMonth && !isPast && !tooFar && hasAvail && !fullyBooked;

                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={!clickable}
                      onClick={() => {
                        if (!clickable) return;
                        setSelectedDate(date);
                        setSelectedTime(null);
                      }}
                      className={cn(
                        "relative aspect-square rounded-lg text-sm flex items-center justify-center transition-colors",
                        !inMonth && "text-muted-foreground/40",
                        inMonth && (isPast || tooFar) && "text-muted-foreground/40 cursor-not-allowed",
                        inMonth && !isPast && !tooFar && !hasAvail && "text-muted-foreground/60 cursor-not-allowed",
                        clickable && !isCustom && !isSelected && "bg-primary/10 text-primary font-medium hover:bg-primary/20",
                        clickable && isCustom && !isSelected && "bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium ring-2 ring-amber-500/60 hover:bg-amber-500/20",
                        fullyBooked && !isSelected && "bg-muted text-muted-foreground line-through cursor-not-allowed",
                        isBlocked && !isSelected && "text-muted-foreground line-through",
                        isSelected && "bg-primary text-primary-foreground font-semibold hover:bg-primary",
                        isToday && !isSelected && "ring-1 ring-primary/40"
                      )}
                    >
                      {date.getDate()}
                      {fullyBooked && (
                        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-muted-foreground" />
                      )}
                      {isBlocked && (
                        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-destructive" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-muted-foreground pt-2 border-t">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded bg-primary/30" /> Available
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded ring-2 ring-amber-500/60" /> Custom hours
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded bg-muted" /> Fully booked
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-destructive" /> Blocked
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Slot panel */}
          <Card className="lg:sticky lg:top-4 self-start">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {selectedDate
                  ? selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
                  : "Select a date"}
              </CardTitle>
              {selectedDate && (
                <div className="flex flex-wrap items-center gap-2">
                  {selectedKind === "blocked" && (
                    <Badge variant="destructive" className="text-[10px]">Blocked</Badge>
                  )}
                  {selectedKind === "custom" && (
                    <Badge className="text-[10px] bg-amber-500 hover:bg-amber-500 text-white">Custom hours</Badge>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedDate && (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Pick a highlighted date on the calendar to see available times.
                </p>
              )}

              {selectedDate && daySlotList.length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  {selectedKind === "blocked"
                    ? "Mentor is unavailable on this date."
                    : "No availability on this day."}
                </p>
              )}

              {selectedDate && daySlotList.length > 0 && (
                <>
                  <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                    {daySlotList.map((t) => {
                      const taken = isSlotTaken(selectedDate, t);
                      const isSel = selectedTime === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          disabled={taken}
                          onClick={() => setSelectedTime(t)}
                          className={cn(
                            "text-sm py-2 px-2 rounded-md border transition-colors flex items-center justify-center gap-1.5",
                            taken && "opacity-50 cursor-not-allowed line-through",
                            !taken && !isSel && "border-primary/30 text-primary hover:bg-primary/10",
                            isSel && "border-primary bg-primary text-primary-foreground"
                          )}
                        >
                          {formatSlotLabel(t)}
                          {isSel && <CheckCircle className="h-3.5 w-3.5" />}
                        </button>
                      );
                    })}
                  </div>

                  {selectedTime && (
                    <div className="space-y-3 border-t pt-4">
                      <div>
                        <Label htmlFor="notes" className="flex items-center gap-2 text-sm">
                          <Info className="h-3.5 w-3.5" /> What would you like to discuss? (optional)
                        </Label>
                        <Textarea
                          id="notes" rows={3} className="mt-2"
                          placeholder="Share goals, questions, or topics so your mentor can prepare…"
                          value={notes} onChange={(e) => setNotes(e.target.value)}
                        />
                      </div>
                      <Button className="w-full" size="lg" onClick={() => setConfirmOpen(true)} disabled={booking}>
                        {rescheduleId ? "Reschedule to this slot" : "Confirm Booking"}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm booking</AlertDialogTitle>
              <AlertDialogDescription>
                {selectedDate && selectedTime && (
                  <>Book a session with <strong>{mentor.full_name}</strong> on{" "}
                  <strong>{format(selectedDate, "PPP")} at {formatSlotLabel(selectedTime)}</strong>
                  {slotEndForSelected && <> – {formatSlotLabel(slotEndForSelected)}</>}?</>
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
