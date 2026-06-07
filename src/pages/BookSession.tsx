import { APP_TZ, formatIST, formatISTDateTime } from "@/lib/datetime";
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMyPrograms } from "@/features/programs/hooks/useMyPrograms";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, CheckCircle, Globe, Info, Video, Copy, AlertCircle } from "lucide-react";
import AddToCalendarMenu from "@/components/AddToCalendarMenu";
import { fromZonedTime } from "date-fns-tz";
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
  type BookingOffering,
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

  const { data: staticData, isPending, error: staticDataError } = useBookSessionStatic(mentorId);
  const { data: bookedTimes = [] } = useBookedTimes(mentorId, rescheduleId || undefined);
  const bookMutation = useBookSession();

  const { data: menteePrograms = [] } = useMyPrograms();
  const [mentorProgramIds, setMentorProgramIds] = useState<string[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);

  useEffect(() => {
    if (!mentorId) return;
    supabase
      .from("program_mentors")
      .select("program_id")
      .eq("mentor_id", mentorId)
      .then(({ data }) => {
        if (data) {
          setMentorProgramIds(data.map((r) => r.program_id));
        }
      });
  }, [mentorId]);

  const sharedPrograms = useMemo(() => {
    const mentorSet = new Set(mentorProgramIds);
    return menteePrograms.filter((p) => mentorSet.has(p.id));
  }, [menteePrograms, mentorProgramIds]);

  useEffect(() => {
    const urlProgramId = params.get("programId");
    if (urlProgramId && sharedPrograms.some((p) => p.id === urlProgramId)) {
      setSelectedProgramId(urlProgramId);
    } else if (sharedPrograms.length === 1) {
      setSelectedProgramId(sharedPrograms[0].id);
    } else if (sharedPrograms.length > 1 && !selectedProgramId) {
      setSelectedProgramId(sharedPrograms[0].id);
    }
  }, [sharedPrograms, params, selectedProgramId]);

  const mentor = staticData?.mentor ?? null;
  const slots = staticData?.slots ?? [];
  const overrides = staticData?.overrides ?? [];
  const isCurrentlyUnavailable = slots.length === 0 && !overrides.some((o) => !o.is_unavailable);
  const timezone = staticData?.mentorProfile?.timezone ?? "UTC";
  const [selectedOffering, setSelectedOffering] = useState<BookingOffering | null>(null);
  const activeOffering = selectedOffering ?? staticData?.offerings?.[0] ?? null;
  const mentorInitials = mentor?.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "M";

  // Sync selected offering
  useEffect(() => {
    if (staticData?.offerings && staticData.offerings.length > 0) {
      const qId = params.get("offeringId");
      const found = staticData.offerings.find((o) => o.id === qId) ?? staticData.offerings[0];
      if (found && (!selectedOffering || selectedOffering.id !== found.id)) {
        setSelectedOffering(found);
      }
    }
  }, [staticData?.offerings, params]);

  // Sync title from selected offering
  useEffect(() => {
    if (activeOffering) {
      setTitle(activeOffering.title);        // ← Only the title, no duration
    } else {
      setTitle("");
    }
  }, [activeOffering]);

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

  const getSlotTimes = (date: Date, hhmm: string) => {
    const startMs = toISTDate(date, hhmm).getTime();
    const duration = activeOffering?.duration_minutes ?? 30;
    const endMs = startMs + duration * 60 * 1000;
    const buffer = staticData?.mentorProfile?.buffer_time_minutes ?? 0;
    const blockedEndMs = endMs + buffer * 60 * 1000;
    return { startMs, endMs, blockedEndMs };
  };

  const isPastSlot = (date: Date, hhmm: string) => {
    const { startMs } = getSlotTimes(date, hhmm);
    const minNoticeHours = staticData?.mentorProfile?.minimum_notice_hours ?? 0;
    const noticeMs = Math.max(minNoticeHours * 60 * 60 * 1000, 5 * 60 * 1000);
    return startMs < Date.now() + noticeMs;
  };

  const isSlotTaken = (date: Date, hhmm: string) => {
    const { startMs, blockedEndMs } = getSlotTimes(date, hhmm);
    const buffer = staticData?.mentorProfile?.buffer_time_minutes ?? 0;

    return bookedTimes.some((booking) => {
      const bStartMs = new Date(booking.scheduled_at).getTime();
      const bBlockedEndMs = bStartMs + (booking.duration_minutes + buffer) * 60 * 1000;
      return Math.max(startMs, bStartMs) < Math.min(blockedEndMs, bBlockedEndMs);
    });
  };

  const isDayFullyBooked = (date: Date) => {
    const ranges = getRangesForDate(date, slots, overrides);
    const list = sliceIntoSlots(ranges, activeOffering?.duration_minutes ?? 30).filter((t) => !isPastSlot(date, t));
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
  const daySlotList = useMemo(
    () => sliceIntoSlots(dayRanges, activeOffering?.duration_minutes ?? 30).filter((t) => !(selectedDate && isPastSlot(selectedDate, t))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dayRanges, selectedDate, activeOffering]
  );
  const selectedKind = useMemo(
    () => (selectedDate ? getOverrideKind(selectedDate, overrides) : null),
    [selectedDate, overrides]
  );

  const slotEndForSelected = useMemo(() => {
    if (!selectedDate || !selectedTime) return null;
    const [h, m] = selectedTime.split(":").map(Number);
    const total = h * 60 + m + (activeOffering?.duration_minutes ?? 30);
    const eh = Math.floor(total / 60);
    const em = total % 60;
    return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
  }, [selectedDate, selectedTime, activeOffering]);

  const booking = bookMutation.isPending;

  const handleBook = async () => {
    if (!selectedDate || !selectedTime || !user || !mentorId) return;
    const scheduledAt = toISTDate(selectedDate, selectedTime);
    const duration = activeOffering?.duration_minutes ?? 30;

    try {
      const { meetingUrl } = await bookMutation.mutateAsync({
        mentorId,
        menteeId: user.id,
        scheduledAt,
        durationMinutes: duration,
        notes,
        title: title.trim() || `Session with ${mentor?.full_name ?? "mentor"}`,
        topic: topic.trim(),
        rescheduleId,
        offeringId: activeOffering?.id || null,
        programId: selectedProgramId,
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
            durationMinutes: duration,
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

  if (isPending) {
    return (
      <AppLayout>
        <p className="text-muted-foreground">Loading…</p>
      </AppLayout>
    );
  }

  if (!mentor || staticDataError) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto py-12 text-center">
          <Card>
            <CardHeader className="flex flex-col items-center pb-4">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="text-xl">Booking Unavailable</CardTitle>
              <CardDescription className="pt-2 text-center max-w-md">
                This mentor is not available for booking, or you do not have permission to book sessions with them.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button onClick={() => navigate("/mentors")}>Back to Mentors Directory</Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }


  if (staticData && staticData.offerings && staticData.offerings.length === 0) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto py-12 text-center">
          <Card>
            <CardHeader className="flex flex-col items-center pb-4">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="text-xl">Booking Unavailable</CardTitle>
              <CardDescription className="pt-2 text-center max-w-md">
                This mentor does not have any active offerings at the moment. Please check back later or choose another mentor.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button onClick={() => navigate("/mentors")}>Back to Mentors Directory</Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

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
                    durationMinutes: activeOffering?.duration_minutes ?? 30,
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

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl">
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border border-white/15 shadow-lg shadow-black/20">
                  <AvatarImage src={mentor.avatar_url ?? undefined} alt={mentor.full_name ?? "Mentor"} />
                  <AvatarFallback className="bg-white/10 text-white font-bold text-lg">{mentorInitials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-white/60">Booking session</p>
                  <h1 className="mt-1 text-3xl font-bold">{rescheduleId ? "Reschedule" : "Book"} with {mentor.full_name}</h1>
                  <p className="mt-2 max-w-2xl text-sm text-white/70">
                    Pick an offering, then choose a date and time that works for both of you.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm backdrop-blur-sm sm:grid-cols-3 md:min-w-[360px]">
                <div>
                  <p className="text-white/50 text-[11px] uppercase tracking-wide">Timezone</p>
                  <p className="mt-1 font-medium">IST</p>
                </div>
                <div>
                  <p className="text-white/50 text-[11px] uppercase tracking-wide">Notice</p>
                  <p className="mt-1 font-medium">{staticData?.mentorProfile?.minimum_notice_hours ?? 0}h</p>
                </div>
                <div>
                  <p className="text-white/50 text-[11px] uppercase tracking-wide">Buffer</p>
                  <p className="mt-1 font-medium">{staticData?.mentorProfile?.buffer_time_minutes ?? 0} min</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {isCurrentlyUnavailable && (
          <div className="text-sm text-amber-600 dark:text-amber-400 font-medium bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">No availability slots configured</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                This mentor has not set up their weekly schedule yet. You can check back later or view other mentors.
              </p>
            </div>
          </div>
        )}

        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Globe className="h-3 w-3" /> All times shown in <span className="font-medium">India Standard Time (IST)</span>
        </p>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Mentor profile</CardTitle>
            <CardDescription>Quick context before selecting a session type.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[auto_minmax(0,1fr)] md:items-start">
            <Avatar className="h-20 w-20">
              <AvatarImage src={mentor.avatar_url ?? undefined} alt={mentor.full_name ?? "Mentor"} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">{mentorInitials}</AvatarFallback>
            </Avatar>
            <div className="space-y-3">
              <div>
                <h2 className="text-2xl font-bold">{mentor.full_name}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="secondary">{timezone}</Badge>
                  <Badge variant="secondary">{staticData?.mentorProfile?.minimum_notice_hours ?? 0}h notice</Badge>
                  <Badge variant="secondary">{staticData?.mentorProfile?.buffer_time_minutes ?? 0} min buffer</Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground max-w-3xl">
                The session cards below show duration, price, and category. Select one card to unlock the calendar.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-xl font-bold">Choose an offering</h2>
              <p className="text-sm text-muted-foreground">Select one card to continue to the calendar.</p>
            </div>
            {activeOffering && (
              <Badge className="rounded-full px-3 py-1 text-xs">
                Selected: {activeOffering.title}
              </Badge>
            )}
          </div>

          {staticData?.offerings && staticData.offerings.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {staticData.offerings.map((offering) => {
                const isSelected = activeOffering?.id === offering.id;
                return (
                  <button
                    key={offering.id}
                    type="button"
                    onClick={() => {
                      setSelectedOffering(offering);
                      setSelectedDate(null);
                      setSelectedTime(null);
                    }}
                    className={cn(
                      "text-left rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                        : "border-border bg-card hover:border-primary/40"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold leading-tight">{offering.title}</h3>
                        <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                          {offering.category || "Mentorship"}
                        </p>
                      </div>
                      <Badge variant={isSelected ? "default" : "secondary"} className="shrink-0">
                        {offering.price === 0 ? "Free" : `₹${offering.price}`}
                      </Badge>
                    </div>

                    <p className="mt-3 min-h-[3.75rem] text-sm text-muted-foreground line-clamp-3">
                      {offering.description || "No description provided for this offering."}
                    </p>

                    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{offering.duration_minutes} minutes</span>
                      <span className={cn("font-medium", isSelected ? "text-primary" : "text-foreground/70")}>
                        {isSelected ? "Selected" : "Tap to select"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                This mentor has no active offerings right now.
              </CardContent>
            </Card>
          )}
        </div>

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
                  const clickable = !!activeOffering && inMonth && !isPast && !tooFar && hasAvail && !fullyBooked;

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
                        !activeOffering && "text-muted-foreground/40 cursor-not-allowed",
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
                  ? formatIST(selectedDate, "EEEE, MMMM d")
                  : "Select a date"}
              </CardTitle>
              {activeOffering && (
                <CardDescription>
                  {activeOffering.title} · min · {activeOffering.price === 0 ? "Free" : `₹${activeOffering.price}`}
                </CardDescription>
              )}
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
              {!activeOffering ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Select an offering card above to unlock dates and times.
                </p>
              ) : !selectedDate ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Pick a highlighted date on the calendar to see available times.
                </p>
              ) : null}

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
                      {/* <div>
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
                      </div> */}
                      {/* <div>
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
                      </div> */}
                      {sharedPrograms.length > 1 && (
                        <div className="space-y-2">
                          <Label htmlFor="program-select" className="text-sm">
                            Program <span className="text-destructive">*</span>
                          </Label>
                          <select
                            id="program-select"
                            value={selectedProgramId || ""}
                            onChange={(e) => setSelectedProgramId(e.target.value || null)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {sharedPrograms.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {sharedPrograms.length === 1 && (
                        <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                          Booking this session for program: <span className="font-semibold text-foreground">{sharedPrograms[0].name}</span>
                        </div>
                      )}

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
                    <strong>{formatIST(selectedDate, "d MMM yyyy")} at {formatSlotLabel(selectedTime)} IST</strong>
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
