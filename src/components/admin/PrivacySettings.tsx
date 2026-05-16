import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useCurrentPolicy,
  useAllPolicies,
  useUpsertPolicy,
  useRetentionSettings,
  useUpdateRetention,
} from "@/features/privacy/api";
import { toast } from "@/hooks/use-toast";

const PrivacySettings = () => {
  const { data: current } = useCurrentPolicy();
  const { data: policies } = useAllPolicies();
  const upsert = useUpsertPolicy();
  const { data: retention } = useRetentionSettings();
  const updateRetention = useUpdateRetention();

  const [version, setVersion] = useState("");
  const [url, setUrl] = useState("");
  const [summary, setSummary] = useState("");
  const [makeCurrent, setMakeCurrent] = useState(true);

  const [sessionsDays, setSessionsDays] = useState(0);
  const [auditDays, setAuditDays] = useState(0);
  const [inactiveDays, setInactiveDays] = useState(0);

  useEffect(() => {
    if (retention) {
      setSessionsDays(retention.sessions_retention_days);
      setAuditDays(retention.audit_logs_retention_days);
      setInactiveDays(retention.inactive_user_retention_days);
    }
  }, [retention]);

  const savePolicy = async () => {
    if (!version.trim()) {
      toast({ title: "Version required", variant: "destructive" });
      return;
    }
    await upsert.mutateAsync({ version: version.trim(), url, summary, makeCurrent });
    setVersion("");
    setUrl("");
    setSummary("");
    toast({ title: "Policy saved" });
  };

  const saveRetention = async () => {
    if (!retention) return;
    await updateRetention.mutateAsync({
      id: retention.id,
      sessions_retention_days: sessionsDays,
      audit_logs_retention_days: auditDays,
      inactive_user_retention_days: inactiveDays,
    });
    toast({ title: "Retention updated" });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Privacy policy</CardTitle>
          <CardDescription>
            Publish a new version to trigger re-acceptance from all users.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm">
            <span className="font-medium">Current version:</span>{" "}
            {current ? <Badge variant="outline">v{current.version}</Badge> : <span className="text-muted-foreground">none</span>}
            {current?.url && (
              <a href={current.url} target="_blank" rel="noreferrer" className="ml-2 underline">
                View
              </a>
            )}
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label>Version</Label>
              <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="e.g. 2.0" />
            </div>
            <div className="sm:col-span-2">
              <Label>Policy URL</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
            </div>
          </div>
          <div>
            <Label>Summary (shown to users)</Label>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="What changed in this version…"
              rows={3}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={makeCurrent} onCheckedChange={(v) => setMakeCurrent(!!v)} />
            Make this the current policy (requires re-acceptance)
          </label>
          <Button onClick={savePolicy} disabled={upsert.isPending}>
            {upsert.isPending ? "Saving…" : "Save policy"}
          </Button>

          {!!policies?.length && (
            <div className="pt-4 border-t">
              <div className="text-sm font-medium mb-2">History</div>
              <ul className="text-sm space-y-1">
                {policies.map((p) => (
                  <li key={p.id} className="flex items-center gap-2">
                    <Badge variant={p.is_current ? "default" : "outline"}>v{p.version}</Badge>
                    <span className="text-muted-foreground text-xs">
                      {new Date(p.effective_from).toLocaleDateString()}
                    </span>
                    {p.url && (
                      <a href={p.url} target="_blank" rel="noreferrer" className="text-xs underline">
                        link
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data retention</CardTitle>
          <CardDescription>
            Windows used by the retention sweep (set up a scheduled job to enforce).
            {retention?.last_sweep_at && (
              <span className="block mt-1">
                Last sweep: {new Date(retention.last_sweep_at).toLocaleString()}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label>Sessions (days)</Label>
              <Input
                type="number"
                min={30}
                value={sessionsDays}
                onChange={(e) => setSessionsDays(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Audit logs (days)</Label>
              <Input
                type="number"
                min={30}
                value={auditDays}
                onChange={(e) => setAuditDays(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Inactive users (days)</Label>
              <Input
                type="number"
                min={30}
                value={inactiveDays}
                onChange={(e) => setInactiveDays(Number(e.target.value))}
              />
            </div>
          </div>
          <Button onClick={saveRetention} disabled={updateRetention.isPending || !retention}>
            {updateRetention.isPending ? "Saving…" : "Save retention"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PrivacySettings;
