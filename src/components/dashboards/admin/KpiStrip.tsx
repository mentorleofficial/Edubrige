import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, GraduationCap, UserCog, BookOpen, Hourglass, Star } from "lucide-react";

interface Props {
  users: number;
  mentors: number;
  mentees: number;
  sessions: number;
  hours: number;
  avgRating: number | null;
}

const Kpi = ({
  title,
  value,
  Icon,
  to,
}: {
  title: string;
  value: string;
  Icon: typeof Users;
  to: string;
}) => (
  <Link to={to} className="block">
    <Card className="h-full transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-5 w-5 text-primary" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  </Link>
);

const KpiStrip = ({ users, mentors, mentees, sessions, hours, avgRating }: Props) => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
    <Kpi title="Total Users" value={String(users)} Icon={Users} to="/admin/users" />
    <Kpi title="Mentors" value={String(mentors)} Icon={UserCog} to="/admin/users" />
    <Kpi title="Mentees" value={String(mentees)} Icon={GraduationCap} to="/admin/users" />
    <Kpi title="Sessions" value={String(sessions)} Icon={BookOpen} to="/admin/sessions" />
    <Kpi title="Hours" value={hours.toFixed(0)} Icon={Hourglass} to="/admin/sessions" />
    <Kpi
      title="Avg Rating"
      value={avgRating === null ? "—" : `${avgRating.toFixed(1)} ★`}
      Icon={Star}
      to="/admin/feedback"
    />
  </div>
);

export default KpiStrip;
