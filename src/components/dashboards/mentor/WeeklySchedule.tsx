import { useState } from "react";
import { formatISTDate, formatISTDateTime } from "@/lib/datetime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarRange, Video } from "lucide-react";
import type { MentorDashSession } from "@/features/mentor-dashboard/useMentorDashboardData";

const dayLabel = (d: Date) => formatISTDate(d);

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

  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectedDaySessions = sessionsByDay[selectedIndex];
  const selectedDate = days[selectedIndex];

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <CalendarRange className="h-5 w-5 text-primary" />
        <CardTitle className="text-lg">Next 7 Days</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {days.map((d, i) => {
            const items = sessionsByDay[i];
            const isToday = i === 0;
            const isSelected = i === selectedIndex;

            return (
              <div
                key={i}
                onClick={() => setSelectedIndex(i)}
                className={`rounded-md border p-2 text-center cursor-pointer transition-all hover:border-primary/50 active:scale-[0.98] ${isSelected
                  ? "border-primary bg-primary/10 shadow-sm"
                  : isToday
                    ? "border-primary/50 bg-primary/5"
                    : "bg-card/50 hover:bg-card"
                  }`}
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

        {/* Selected Day Sessions */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">
              Sessions on {formatISTDate(selectedDate)}
            </h3>
            <span className="text-xs text-muted-foreground">
              {selectedDaySessions.length} session{selectedDaySessions.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="space-y-3">
            {selectedDaySessions.length > 0 ? (
              selectedDaySessions.map((s) => {
                const start = new Date(s.scheduled_at);
                const isUpcoming = start.getTime() > Date.now();

                return (
                  <div
                    key={s.id}
                    className="group rounded-xl border bg-card p-3.5 hover:border-primary/60 hover:shadow-sm transition-all duration-200"
                  >
                    <div className="flex gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Mentee + Title in one line */}
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-sm truncate">
                            {s.mentee?.full_name || "Mentee"}
                          </div>

                          {(s.title || s.topic) && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <div className="text-sm font-semibold text-primary mt-1 truncate">
                                {s.title || s.topic}
                              </div>
                            </>
                          )}
                        </div>



                        {/* Highlighted Time */}
                        <div className="mt-2.5 flex items-center gap-2">
                          <div className="font-semibold text-base tracking-tight text-foreground">
                            {formatISTDateTime(start)}
                          </div>

                        </div>
                      </div>

                      {/* Right Side */}
                      <div className="flex flex-col items-end justify-between py-0.5 gap-2">
                        {isUpcoming && s.meeting_url && (
                          <a
                            href={s.meeting_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap"
                          >
                            <Video className="h-3.5 w-3.5" />
                            Join
                          </a>
                        )}

                        <div className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">
                          {s.status}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground py-10 text-center border rounded-lg bg-card/50">
                No sessions booked on this day.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklySchedule;