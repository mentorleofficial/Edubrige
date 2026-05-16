import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, CheckCircle, Globe, Info, Video, Copy } from "lucide-react";
import AddToCalendarMenu from "@/components/AddToCalendarMenu";
import { format } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { APP_TZ, formatISTDateTime, formatIST } from "@/lib/datetime";
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
import {
  useBookSessionStatic,
  useBookedTimes,
  useBookSession,
} from "@/features/mentee-booking/useBookSessionData";

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

  const { data: staticData } = useBookSessionStatic(mentorId);
  const { data: bookedTimes = new Set<string>() } = useBookedTimes(mentorId);
  const bookMutation = useBookSession();

  const mentor = staticData?.mentor ?? null;
  const slots = staticData?.slots ?? [];
  const overrides = staticData?.overrides ?? [];
  const timezone = staticData?.mentorProfile?.timezone ?? "UTC";

  // Guard inactive mentor.
  useEffect(() => {
    if (staticData && staticData.mentorProfile && !staticData.mentorProfile.is_active) {
      toast({ variant: "destructive", title: "Mentor unavailable", description: "This mentor is not currently accepting bookings." });
      navigate("/mentors");
    }
  }, [staticData, toast, navigate]);

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
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [bookedSession, setBookedSession] = useState<{ scheduledAt: Date; meetingUrl: string } | null>(null);

  const matrix = useMemo(
    () => getMonthMatrix(cursor.getFullYear(), cursor.getMonth()),
    [cursor]
  );

  // Interpret the picked date/time as an IST wall-clock time, regardless of browser tz.
  const toISTDate = (date: Date, hhmm: string): Date => {
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const local = `${y}-${mo}-${d}T${hhmm}:00`;
    return fromZonedTime(local, APP_TZ);
  };

  const isoForSlot = (date: Date, hhmm: string) => toISTDate(date, hhmm).toISOString();

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

  // Memo expensive day-level computations so typing in notes textarea does not
  // recompute the slot list / availability lookups.
  const dayRanges = useMemo(
    () => (selectedDate ? getRangesForDate(selectedDate, slots, overrides) : []),
    [selectedDate, slots, overrides]
  );
  const daySlotList = useMemo(() => sliceIntoSlots(dayRanges, 30), [dayRanges]);
  const selectedKind = useMemo(
    () => (selectedDate ? getOverrideKind(selectedDate, overrides) : null),
    [selectedDate, overrides]
  );

  const slotEndForSelected = useMemo(() => {
    if (!selectedDate || !selectedTime) return null;
    const [h, m] = selectedTime.split(":").map(Number);
    const total = h * 60 + m + 30;
    const eh = Math.floor(total / 60);
    const em = total % 60;
    return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
  }, [selectedDate, selectedTime]);

  const booking = bookMutation.isPending;

  const handleBook = async () => {
    if (!selectedDate || !selectedTime || !user || !mentorId) return;
    const scheduledAt = toISTDate(selectedDate, selectedTime);

    try {
      const { meetingUrl } = await bookMutation.mutateAsync({
        mentorId,
        menteeId: user.id,
        scheduledAt,
        durationMinutes: 30,
        notes,
        title: title.trim() || `Session with ${mentor?.full_name ?? "mentor"}`,
        topic: topic.trim(),
        rescheduleId,
      });

      // Fire-and-forget booking confirmation email
      if (mentor?.email && user.email) {
        supabase.functions.invoke("send-booking-email", {
          body: {
            mentorEmail: mentor.email,
            mentorName: mentor.full_name || "your mentor",
            menteeEmail: user.email,
            menteeName: (user.user_metadata as Record<string, unknown>)?.full_name || user.email,
            scheduledAtISO: scheduledAt.toISOString(),
            durationMinutes: 30,
            meetingUrl,
            menteeNotes: notes || undefined,
          },
        }).then(({ data, error }) => {
          const dErr = (data as { error?: unknown; errors?: unknown[] } | null);
          if (error || dErr?.error || (Array.isArray(dErr?.errors) && dErr.errors.length)) {
            console.error("send-booking-email failed:", error || data);
            toast({ variant: "destructive", title: "Booking saved, email not sent", description: "We couldn't send the confirmation email. Use the meeting link on this page." });
          }
        });
      }

      toast({ title: rescheduleId ? "Session rescheduled" : "Session booked!", description: `Scheduled for ${formatISTDateTime(scheduledAt)}` });
      setConfirmOpen(false);
      if (rescheduleId) {
        navigate("/mentee/sessions");
      } else {
        setBookedSession({ scheduledAt, meetingUrl });
      }
    } catch (e) {
      const err = e as { message?: string; code?: string };
      const friendly = err?.message?.includes("overlap") || err?.code === "23P01" || err?.code === "23505"
        ? "That slot was just taken — please pick another."
        : err?.message ?? "Booking failed";
      toast({ variant: "destructive", title: "Booking failed", description: friendly });
      setConfirmOpen(false);
    }
  };

  if (!mentor) return <AppLayout><p className="text-muted-foreground">Loading…</p></AppLayout>;

  if (bookedSession) {
    const { scheduledAt, meetingUrl } = bookedSession;
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto py-8">
          <Card>
            <CardHeader className="text-center pb-3">
              <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">Session booked!</CardTitle>
              <p className="text-muted-foreground text-sm pt-1">
                with <strong>{mentor.full_name}</strong> on{" "}
                {formatISTDateTime(scheduledAt)}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <a href={meetingUrl} target="_blank" rel="noopener noreferrer" className="block">
                <Button size="lg" className="w-full">
                  <Video className="mr-2 h-4 w-4" />
                  Join meeting
                </Button>
              </a>

              <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
                <span className="truncate flex-1 font-mono text-muted-foreground">{meetingUrl}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => {
                    navigator.clipboard.writeText(meetingUrl);
                    toast({ title: "Link copied" });
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="flex justify-center">
                <AddToCalendarMenu
                  event={{
                    title: `Mentorship session with ${mentor.full_name}`,
                    description: `Meeting link: ${meetingUrl}`,
                    location: meetingUrl,
                    startISO: scheduledAt.toISOString(),
                    durationMinutes: 30,
                  }}
                  filename={`mentorle-session-${formatIST(scheduledAt, "yyyy-MM-dd-HHmm")}.ics`}
                />
              </div>

              <p className="text-xs text-muted-foreground text-center pt-2">
                A confirmation email has been sent to you and your mentor.
              </p>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => navigate("/mentee/sessions")}>
                  View my sessions
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => {
                    setBookedSession(null);
                    setSelectedDate(null);
                    setSelectedTime(null);
                    setNotes("");
                    navigate("/mentors");
                  }}
                >
                  Book another
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

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
                        <Label htmlFor="session-title" className="text-sm">
                          Session title <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="session-title"
                          className="mt-2"
                          placeholder="e.g. Resume review · 30 min"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          maxLength={120}
                        />
                      </div>
                      <div>
                        <Label htmlFor="session-topic" className="text-sm">
                          Topic (optional)
                        </Label>
                        <Input
                          id="session-topic"
                          className="mt-2"
                          placeholder="e.g. Career change to product"
                          value={topic}
                          onChange={(e) => setTopic(e.target.value)}
                          maxLength={120}
                        />
                      </div>
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
                      <Button
                        className="w-full"
                        size="lg"
                        onClick={() => setConfirmOpen(true)}
                        disabled={booking || !title.trim()}
                      >
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
