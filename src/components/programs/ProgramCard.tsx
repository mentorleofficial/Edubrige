import { formatISTDate } from "@/lib/datetime";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Users } from "lucide-react";
import type { ProgramWithCounts } from "@/features/programs/api";
type Props = {
  program: ProgramWithCounts;
  basePath: "/mentor/programs" | "/mentee/programs";
  cta?: { label: string; to: string };
};

const ProgramCard = ({ program, basePath, cta }: Props) => {
  const hsl = program.color || "221 83% 53%";
  const detailHref = `${basePath}/${program.slug}`;
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow group">
      <div className="h-1.5 w-full" style={{ backgroundColor: `hsl(${hsl})` }} />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg">
            <Link to={detailHref} className="hover:underline">
              {program.name}
            </Link>
          </CardTitle>
          <Badge variant="secondary" className="capitalize shrink-0">
            {program.status}
          </Badge>
        </div>
        {program.description ? (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{program.description}</p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {program.mentor_count} mentors · {program.mentee_count} mentees
          </span>
          {program.starts_on ? (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatISTDate(program.starts_on)}
              {program.ends_on ? ` – ${formatISTDate(program.ends_on)}` : ""}
            </span>
          ) : null}
        </div>
        {program.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {program.tags.slice(0, 5).map((t) => (
              <Badge key={t.id} variant="outline" className="text-xs">{t.label}</Badge>
            ))}
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" asChild className="flex-1">
            <Link to={detailHref}>
              Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
          {cta && (
            <Button size="sm" asChild className="flex-1">
              <Link to={cta.to}>{cta.label}</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProgramCard;
