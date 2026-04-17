import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import ApplicationDetailDialog from "@/components/ApplicationDetailDialog";
import type { Database } from "@/integrations/supabase/types";

type Application = Database["public"]["Tables"]["mentor_applications"]["Row"];
type Status = "pending" | "approved" | "rejected" | "all";

const AdminApplications = () => {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Status>("pending");
  const [selected, setSelected] = useState<Application | null>(null);
  const [open, setOpen] = useState(false);

  const fetchApps = async () => {
    setLoading(true);
    const { data } = await supabase.from("mentor_applications").select("*").order("created_at", { ascending: false });
    setApps(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchApps(); }, []);

  const filtered = tab === "all" ? apps : apps.filter((a) => a.status === tab);
  const pendingCount = apps.filter((a) => a.status === "pending").length;

  const variant = (s: string) => s === "pending" ? "secondary" : s === "approved" ? "default" : "destructive";

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Mentor Applications</h1>
          <p className="text-muted-foreground mt-1">Review and approve mentor applications.</p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Status)}>
          <TabsList>
            <TabsTrigger value="pending">
              Pending {pendingCount > 0 && <Badge variant="secondary" className="ml-2">{pendingCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Expertise</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No applications</TableCell></TableRow>
                ) : (
                  filtered.map((a) => (
                    <TableRow key={a.id} className="cursor-pointer" onClick={() => { setSelected(a); setOpen(true); }}>
                      <TableCell className="font-medium">{a.full_name}</TableCell>
                      <TableCell>{a.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {a.expertise.slice(0, 3).map((e) => <Badge key={e} variant="outline" className="text-xs">{e}</Badge>)}
                          {a.expertise.length > 3 && <span className="text-xs text-muted-foreground">+{a.expertise.length - 3}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</TableCell>
                      <TableCell><Badge variant={variant(a.status)}>{a.status}</Badge></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <ApplicationDetailDialog application={selected} open={open} onOpenChange={setOpen} onUpdated={fetchApps} />
    </AppLayout>
  );
};

export default AdminApplications;
