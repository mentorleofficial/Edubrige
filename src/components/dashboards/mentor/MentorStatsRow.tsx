import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, CheckCircle2, Hourglass, Star, Users } from "lucide-react";

interface Props {
  upcoming: number;
  completed: number;
  hours: number;
  avgRating: number | null;
  mentees: number;
}

const Stat = ({
  label,
  value,
  Icon,
}: {
  label: string;
  value: string;
  Icon: typeof Clock;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      <Icon className="h-5 w-5 text-primary" />
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

const MentorStatsRow = ({ upcoming, completed, hours, avgRating, mentees }: Props) => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
    <Stat label="Upcoming" value={String(upcoming)} Icon={Clock} />
    <Stat label="Completed" value={String(completed)} Icon={CheckCircle2} />
    <Stat label="Hours Mentored" value={hours.toFixed(1)} Icon={Hourglass} />
    <Stat
      label="Avg Rating"
      value={avgRating === null ? "—" : `${avgRating.toFixed(1)} ★`}
      Icon={Star}
    />
    <Stat label="Mentees" value={String(mentees)} Icon={Users} />
  </div>
);

export default MentorStatsRow;
