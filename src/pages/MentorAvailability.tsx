import { useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, Globe } from "lucide-react";
import type { WeeklySlot, DateOverride } from "@/features/availability/api/availability";
import { DAYS_FULL, TIMEZONES, normalizeHHMM, detectTimezone } from "@/features/availability/timeUtils";
import { Button } from "@/components/ui/button";
import { DayRow } from "@/features/availability/components/DayRow";
import { OverrideList } from "@/features/availability/components/OverrideList";
import { AvailabilityPreview } from "@/features/availability/components/AvailabilityPreview";
import {
  useMentorAvailability,
  useAvailabilityMutations,
} from "@/features/mentor-availability/useMentorAvailability";

const MentorAvailability = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data, isLoading, isFetching } = useMentorAvailability(user?.id);
  const slots = data?.slots ?? [];
  const overrides = data?.overrides ?? [];
  const timezone = data?.timezone ?? "UTC";

  const m = useAvailabilityMutations(user?.id);
  const autoDetectedRef = useRef(false);

  const anyPending =
    m.addSlot.isPending ||
    m.updateSlot.isPending ||
    m.deleteSlot.isPending ||
    m.deleteSlotsForDay.isPending ||
    m.copySlotsToDays.isPending ||
    m.updateTimezone.isPending ||
    m.addOverride.isPending ||
    m.deleteOverride.isPending;

  const showSaving = anyPending || (isFetching && !isLoading);
  const showSaved = !anyPending && !isFetching && !isLoading;

  const handleError = (e: unknown) => {
    const message = e instanceof Error ? e.message : "Something went wrong";
    toast({ variant: "destructive", title: "Save failed", description: message });
  };

  const slotsByDay = useMemo(() => {
    const map: Record<number, WeeklySlot[]> = {};
    for (let i = 0; i < 7; i++) map[i] = [];
    for (const s of slots) map[s.day_of_week].push(s);
    for (const k of Object.keys(map)) {
      map[Number(k)].sort((a, b) =>
        normalizeHHMM(a.start_time).localeCompare(normalizeHHMM(b.start_time))
      );
    }
    return map;
  }, [slots]);

  const onTimezoneChange = (tz: string) =>
    m.updateTimezone.mutate(tz, { onError: handleError });

  // Auto-detect mentor's timezone on first load if it's still the default UTC.
  useEffect(() => {
    if (isLoading || !user || autoDetectedRef.current) return;
    if (timezone === "UTC") {
      const detected = detectTimezone();
      if (detected && detected !== "UTC") {
        autoDetectedRef.current = true;
        onTimezoneChange(detected);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, timezone, user]);

  const onAdd = (day: number, start: string, end: string) =>
    m.addSlot.mutate(
      { day_of_week: day, start_time: start, end_time: end },
      { onError: handleError }
    );

  const onUpdate = (id: string, patch: { start_time?: string; end_time?: string }) =>
    m.updateSlot.mutate({ id, patch }, { onError: handleError });

  const onRemove = (id: string) => m.deleteSlot.mutate(id, { onError: handleError });

  const onToggleDay = (day: number, enabled: boolean) => {
    if (enabled) {
      m.addSlot.mutate(
        { day_of_week: day, start_time: "09:00", end_time: "17:00" },
        { onError: handleError }
      );
    } else {
      m.deleteSlotsForDay.mutate(day, { onError: handleError });
    }
  };

  const onCopy = (sourceDay: number, targetDays: number[]) => {
    const source = slotsByDay[sourceDay].map((s) => ({
      start_time: normalizeHHMM(s.start_time),
      end_time: normalizeHHMM(s.end_time),
    }));
    if (source.length === 0) return;
    m.copySlotsToDays.mutate({ sourceSlots: source, targetDays }, { onError: handleError });
  };

  const onAddOverride = (input: Omit<DateOverride, "id" | "mentor_id">) =>
    m.addOverride.mutate(input, { onError: handleError });

  const onRemoveOverride = (id: string) => m.deleteOverride.mutate(id, { onError: handleError });

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Availability</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Set the hours mentees can book sessions with you, just like Calendly.
            </p>
          </div>
          <div className="h-6 flex items-center text-xs text-muted-foreground">
            {showSaving && (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving…
              </span>
            )}
            {!showSaving && showSaved && slots.length + overrides.length > 0 && (
              <span className="flex items-center gap-1 text-primary">
                <CheckCircle2 className="h-3 w-3" /> Saved
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6 min-w-0">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Timezone</CardTitle>
                </div>
                <CardDescription>
                  Times below are shown in this timezone. Mentees see your slots converted to theirs.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Label className="sr-only">Timezone</Label>
                <div className="flex items-center gap-2 max-w-md">
                  <Select value={timezone} onValueChange={onTimezoneChange}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onTimezoneChange(detectTimezone())}
                  >
                    Detect
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Weekly hours</CardTitle>
                <CardDescription>
                  Set when you're regularly available for sessions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm py-6">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : (
                  <div className="divide-y">
                    {DAYS_FULL.map((_, day) => (
                      <DayRow
                        key={day}
                        dayOfWeek={day}
                        slots={slotsByDay[day]}
                        onAdd={(s, e) => onAdd(day, s, e)}
                        onUpdate={onUpdate}
                        onRemove={onRemove}
                        onToggleDay={(enabled) => onToggleDay(day, enabled)}
                        onCopy={(targets) => onCopy(day, targets)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Date overrides</CardTitle>
                <CardDescription>
                  Add exceptions for specific dates — block a holiday or open custom hours.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <OverrideList
                  overrides={overrides}
                  onAdd={onAddOverride}
                  onRemove={onRemoveOverride}
                />
              </CardContent>
            </Card>
          </div>

          <div>
            <AvailabilityPreview slots={slots} overrides={overrides} timezone={timezone} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default MentorAvailability;
