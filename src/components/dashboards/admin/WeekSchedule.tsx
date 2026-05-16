import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarRange } from "lucide-react";
import type { AdminSessionRow } from "@/features/admin-dashboard/useAdminDashboardData";

const dayLabel = (d: Date) => d.toLocaleDateString([], { weekday: "short" });

const WeekSchedule = ({ sessions }: { sessions: AdminSessionRow[] }) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  const buckets = days.map((d) => {
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    const list = sessions.filter((s) => {
      if (s.status !== "booked") return false;
      const t = new Date(s.scheduled_at).getTime();
      return t >= d.getTime() && t < next.getTime();
    });
    const mentors = new Set(list.map((s) => s.mentor_id)).size;
    return { count: list.length, mentors };
  });

  const totalWeek = buckets.reduce((a, b) => a + b.count, 0);
  const todayCount = buckets[0].count;

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Schedule · next 7 days</CardTitle>
        </div>
        <div className="text-xs text-muted-foreground">
          Today <span className="font-semibold text-foreground">{todayCount}</span> · Week{" "}
          <span className="font-semibold text-foreground">{totalWeek}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2">
          {days.map((d, i) => {
            const b = buckets[i];
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
                  {b.count > 0 ? `${b.count}` : "—"}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {b.mentors > 0 ? `${b.mentors} mentor${b.mentors > 1 ? "s" : ""}` : "·"}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default WeekSchedule;
