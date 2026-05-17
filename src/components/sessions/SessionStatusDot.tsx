import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SessionStatus } from "@/features/mentor-sessions/useMentorSessions";

const STATUS_META: Record<
  SessionStatus,
  { label: string; dot: string; tone: string }
> = {
  booked: {
    label: "Booked",
    dot: "bg-primary",
    tone: "border-primary/30 bg-primary/5 text-primary",
  },
  completed: {
    label: "Completed",
    dot: "bg-emerald-500",
    tone: "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400",
  },
  cancelled: {
    label: "Cancelled",
    dot: "bg-destructive",
    tone: "border-destructive/30 bg-destructive/5 text-destructive",
  },
  no_show: {
    label: "No-show",
    dot: "bg-amber-500",
    tone: "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400",
  },
};

interface Props {
  status: SessionStatus;
  className?: string;
}

export default function SessionStatusDot({ status, className }: Props) {
  const meta = STATUS_META[status] ?? STATUS_META.booked;
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        meta.tone,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} aria-hidden />
      {meta.label}
    </Badge>
  );
}
