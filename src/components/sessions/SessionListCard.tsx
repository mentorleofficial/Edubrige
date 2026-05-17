import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Link2,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  formatIST,
  formatISTDateTime,
  formatISTTime,
} from "@/lib/datetime";
import { relativeIST } from "@/lib/relativeTime";
import SessionStatusDot from "./SessionStatusDot";
import ProgramBadge from "@/components/programs/ProgramBadge";
import type { SessionStatus } from "@/features/mentor-sessions/useMentorSessions";

export interface ProgramTag {
  name: string;
  color: string;
  slug: string;
}

export interface SessionCardData {
  id: string;
  counterpartyName: string;
  counterpartyAvatar: string | null;
  title: string;
  topic: string;
  scheduledAt: string;
  durationMinutes: number;
  status: SessionStatus;
  programs: ProgramTag[];
  programLinkBase: string;
  meetingUrl: string;
  notes: string | null;
  menteeNotes: string;
  cancellationReason: string;
}

export interface OverflowAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface Props {
  data: SessionCardData;
  isUpcoming: boolean;
  primaryActions?: ReactNode;
  overflowActions?: OverflowAction[];
  /** Optional banner shown above actions, e.g. "Add meeting link" for mentors. */
  alert?: ReactNode;
  /** Optional extra block in the expanded detail area. */
  extraDetails?: ReactNode;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export default function SessionListCard({
  data,
  isUpcoming,
  primaryActions,
  overflowActions = [],
  alert,
  extraDetails,
}: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const hasDetails =
    !!data.topic ||
    !!data.meetingUrl ||
    !!data.notes ||
    !!data.menteeNotes ||
    !!data.cancellationReason ||
    !!extraDetails;

  const rel = isUpcoming ? relativeIST(data.scheduledAt) : null;

  const copyLink = async () => {
    if (!data.meetingUrl) return;
    await navigator.clipboard.writeText(data.meetingUrl);
    toast({ title: "Meeting link copied" });
  };

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 transition-colors",
        data.status === "cancelled" && "opacity-75"
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <Avatar className="h-10 w-10 shrink-0">
          {data.counterpartyAvatar && (
            <AvatarImage src={data.counterpartyAvatar} alt={data.counterpartyName} />
          )}
          <AvatarFallback>{initials(data.counterpartyName)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm truncate">{data.counterpartyName}</span>
            <SessionStatusDot status={data.status} />
            {data.programs.map((p) => (
              <ProgramBadge
                key={p.slug}
                name={p.name}
                color={p.color}
                to={`${data.programLinkBase}/${p.slug}`}
              />
            ))}
          </div>

          <div className="text-sm">
            <span className="font-medium">
              {data.title || <span className="italic text-muted-foreground">Untitled session</span>}
            </span>
            {data.topic && (
              <span className="text-muted-foreground"> · {data.topic}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{formatIST(data.scheduledAt, "EEE, d MMM")}</span>
            <span>·</span>
            <span>{formatISTTime(data.scheduledAt)}</span>
            <span>·</span>
            <span>{data.durationMinutes} min</span>
            {rel && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground/80">
                {rel}
              </span>
            )}
          </div>

          {alert && <div className="pt-1">{alert}</div>}
        </div>

        <div className="flex flex-wrap items-center gap-1 sm:justify-end">
          {primaryActions}
          {overflowActions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {overflowActions.map((a, i) => (
                  <DropdownMenuItem
                    key={i}
                    onClick={a.onClick}
                    disabled={a.disabled}
                    className={cn(a.destructive && "text-destructive focus:text-destructive")}
                  >
                    {a.icon && <span className="mr-2 inline-flex">{a.icon}</span>}
                    {a.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {hasDetails && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-muted-foreground"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
            >
              {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              <span className="ml-1">{open ? "Hide" : "Details"}</span>
            </Button>
          )}
        </div>
      </div>

      {open && hasDetails && (
        <div className="mt-3 space-y-2 rounded-md bg-muted/40 p-3 text-sm">
          {data.meetingUrl && (
            <div className="flex items-center gap-2">
              <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
              <a
                href={data.meetingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline truncate min-w-0"
              >
                <span className="truncate">{data.meetingUrl}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={copyLink}
                aria-label="Copy link"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          )}
          {data.menteeNotes && (
            <div>
              <span className="font-medium">Mentee notes:</span>{" "}
              <span className="text-muted-foreground">{data.menteeNotes}</span>
            </div>
          )}
          {data.notes && (
            <div>
              <span className="font-medium">Mentor notes:</span>{" "}
              <span className="text-muted-foreground">{data.notes}</span>
            </div>
          )}
          {data.cancellationReason && (
            <div className="text-destructive">
              <span className="font-medium">Cancellation:</span> {data.cancellationReason}
            </div>
          )}
          {extraDetails}
          <div className="pt-1 text-[11px] text-muted-foreground">
            Scheduled for {formatISTDateTime(data.scheduledAt)}
          </div>
        </div>
      )}
    </div>
  );
}

export { Link };
