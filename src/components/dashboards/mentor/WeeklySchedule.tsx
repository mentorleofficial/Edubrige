import { formatISTDate, formatISTDateTime } from "@/lib/datetime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarRange } from "lucide-react";
import type { MentorDashSession } from "@/features/mentor-dashboard/useMentorDashboardData";
const dayLabel = (d: Date) =>
  formatISTDate(d);

const WeeklySchedule = ({ sessions }: { sessions: MentorDashSession[] }) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  const sessionsByDay = days.map((d) => {
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    return sessions
      .filter((s) => s.status === "booked")
      .filter((s) => {
        const t = new Date(s.scheduled_at).getTime();
        return t >= d.getTime() && t < next.getTime();
      })
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  });

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <CalendarRange className="h-5 w-5 text-primary" />
        <CardTitle className="text-lg">Next 7 Days</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2">
          {days.map((d, i) => {
            const items = sessionsByDay[i];
            const isToday = i === 0;
            return (
              <div
                key={i}
                className={
                  "rounded-md border p-2 text-center " +
                  (isToday ? "border-primary/50 bg-primary/5" : "bg-card/50")
                }
              >
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {dayLabel(d)}
                </div>
                <div className="text-lg font-semibold">{d.getDate()}</div>
                <div className="mt-1 text-xs font-medium text-primary">
                  {items.length > 0 ? `${items.length} session${items.length > 1 ? "s" : ""}` : "—"}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 space-y-2">
          {sessionsByDay.flat().slice(0, 5).map((s) => {
            const start = new Date(s.scheduled_at);
            return (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-md border bg-card/40 px-3 py-2 text-sm"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{s.mentee?.full_name || "Mentee"}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatISTDateTime(start)}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{s.duration_minutes}m</span>
              </div>
            );
          })}
          {sessionsByDay.flat().length === 0 && (
            <p className="text-sm text-muted-foreground">No sessions booked this week.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklySchedule;
