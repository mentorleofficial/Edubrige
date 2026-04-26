import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Globe, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { WeeklySlot, DateOverride } from "../api/availability";
import {
  getMonthMatrix,
  getRangesForDate,
  getOverrideKind,
  sliceIntoSlots,
  formatSlotLabel,
  hasAnyAvailability,
  isSameDay,
} from "../previewUtils";

interface Props {
  slots: WeeklySlot[];
  overrides: DateOverride[];
  timezone: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function AvailabilityPreview({ slots, overrides, timezone }: Props) {
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date | null>(null);

  const matrix = useMemo(
    () => getMonthMatrix(cursor.getFullYear(), cursor.getMonth()),
    [cursor]
  );

  const ranges = selected ? getRangesForDate(selected, slots, overrides) : [];
  const slotList = sliceIntoSlots(ranges, 30);

  const goPrev = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const goNext = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));

  return (
    <Card className="lg:sticky lg:top-4">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Preview</CardTitle>
        </div>
        <CardDescription className="flex items-center gap-1.5 text-xs">
          <Globe className="h-3 w-3" />
          How mentees see your calendar · {timezone}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Month nav */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goPrev} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-medium">
            {MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goNext} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-wide text-muted-foreground text-center">
          {DOW_LABELS.map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-1">
          {matrix.flat().map((date, i) => {
            const inMonth = date.getMonth() === cursor.getMonth();
            const isPast = date < today;
            const available = !isPast && hasAnyAvailability(date, slots, overrides);
            const isSelected = selected && isSameDay(date, selected);
            const isToday = isSameDay(date, today);

            return (
              <button
                key={i}
                type="button"
                disabled={!available}
                onClick={() => available && setSelected(date)}
                className={cn(
                  "aspect-square rounded-full text-xs flex items-center justify-center transition-colors",
                  !inMonth && "text-muted-foreground/40",
                  inMonth && !available && "text-muted-foreground/60 cursor-not-allowed",
                  available && !isSelected && "bg-primary/10 text-primary font-medium hover:bg-primary/20",
                  isSelected && "bg-primary text-primary-foreground font-semibold",
                  isToday && !isSelected && "ring-1 ring-primary/40"
                )}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>

        {/* Slot list */}
        <div className="border-t pt-3">
          {!selected && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Select a highlighted date to see available times.
            </p>
          )}
          {selected && slotList.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              No availability on this day.
            </p>
          )}
          {selected && slotList.length > 0 && (
            <>
              <div className="text-xs font-medium mb-2">
                {selected.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </div>
              <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-1">
                {slotList.map((s) => (
                  <div
                    key={s}
                    className="text-xs text-center py-1.5 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                  >
                    {formatSlotLabel(s)}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
