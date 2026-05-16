import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList } from "lucide-react";
import { Link } from "react-router-dom";
import type { AdminAuditRow } from "@/features/admin-dashboard/useAdminDashboardData";

const relTime = (ms: number) => {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ms).toLocaleDateString();
};

const RecentAudit = ({ rows }: { rows: AdminAuditRow[] }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-primary" />
        <CardTitle className="text-lg">Recent Audit Activity</CardTitle>
      </div>
      <Button variant="ghost" size="sm" asChild>
        <Link to="/admin/audit-logs">View all</Link>
      </Button>
    </CardHeader>
    <CardContent>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No audit events yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between rounded-md border bg-card/40 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium">{r.action}</span>{" "}
                <span className="text-muted-foreground">on {r.entity_type}</span>
                {r.actor_name && (
                  <span className="text-muted-foreground"> · by {r.actor_name}</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {relTime(new Date(r.created_at).getTime())}
              </span>
            </li>
          ))}
        </ul>
      )}
    </CardContent>
  </Card>
);

export default RecentAudit;
