import { formatISTDate } from "@/lib/datetime";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeFn } from "@/lib/functionError";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import ApplicationDetailDialog from "@/components/ApplicationDetailDialog";
import { CheckCircle2, XCircle, Loader2, Search } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
type Application = Database["public"]["Tables"]["mentor_applications"]["Row"];
type Status = "pending" | "approved" | "rejected" | "changes_requested" | "all";

const AdminApplications = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Status>("pending");
  const [selected, setSelected] = useState<Application | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState<"approve" | "reject" | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState("");

  const fetchApps = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("mentor_applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      // Surface the failure instead of rendering an empty "No applications" table.
      toast({ variant: "destructive", title: "Couldn't load applications", description: error.message });
    }
    setApps(data || []);
    setLoading(false);
    setPicked(new Set());
  };

  useEffect(() => { fetchApps(); }, []);

  // Get only the latest application for each email
  const latestApps = useMemo(() => {
    const map = new Map<string, Application>();
    // Since apps are ordered by created_at DESC, the first occurrence of an email is the latest one
    for (const app of apps) {
      const emailLower = app.email.toLowerCase();
      if (!map.has(emailLower)) {
        map.set(emailLower, app);
      }
    }
    return Array.from(map.values());
  }, [apps]);

  const filtered = useMemo(() => {
    let list = tab === "all" ? latestApps : latestApps.filter((a) => a.status === tab);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.full_name.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          a.expertise.some((e) => e.toLowerCase().includes(q))
      );
    }
    return list;
  }, [latestApps, tab, query]);

  const counts = useMemo(
    () => ({
      pending: latestApps.filter((a) => a.status === "pending").length,
      approved: latestApps.filter((a) => a.status === "approved").length,
      changes_requested: latestApps.filter((a) => a.status === "changes_requested").length,
      rejected: latestApps.filter((a) => a.status === "rejected").length,
      all: latestApps.length,
    }),
    [latestApps]
  );

  const variant = (s: string) => {
    if (s === "pending") return "secondary";
    if (s === "approved") return "default";
    if (s === "rejected") return "destructive";
    return "outline";
  };

  const allOnPage = filtered.length > 0 && filtered.every((a) => picked.has(a.id));
  const togglePick = (id: string) => {
    const next = new Set(picked);
    next.has(id) ? next.delete(id) : next.add(id);
    setPicked(next);
  };
  const toggleAll = () => {
    setPicked(allOnPage ? new Set() : new Set(filtered.map((a) => a.id)));
  };

  // Both pending and changes-requested applications are actionable, so selecting
  // only "changes requested" no longer makes the buttons do nothing silently.
  const eligibleIds = () =>
    Array.from(picked).filter((id) => {
      const a = apps.find((x) => x.id === id);
      return a && (a.status === "pending" || a.status === "changes_requested");
    });

  const bulkApprove = async () => {
    const ids = eligibleIds();
    if (!ids.length) {
      toast({ variant: "destructive", title: "Nothing to approve", description: "None of the selected applications are awaiting review." });
      return;
    }
    setBulkBusy("approve");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined;
      let ok = 0;
      const errors: string[] = [];
      for (const id of ids) {
        try {
          await invokeFn("approve-mentor-application", { body: { application_id: id, admin_notes: null }, headers });
          ok++;
        } catch (e) {
          const name = apps.find((x) => x.id === id)?.full_name ?? "Applicant";
          errors.push(`${name}: ${(e as Error).message}`);
        }
      }
      toast({
        title: `Approved ${ok} application${ok === 1 ? "" : "s"}`,
        description: errors.length ? `${errors.length} failed — ${errors[0]}${errors.length > 1 ? " (…)" : ""}` : undefined,
        variant: errors.length ? "destructive" : "default",
      });
      await fetchApps();
    } finally { setBulkBusy(null); }
  };

  const bulkReject = async () => {
    const ids = eligibleIds();
    if (!ids.length || !user) {
      toast({ variant: "destructive", title: "Nothing to reject", description: "None of the selected applications are awaiting review." });
      return;
    }
    const reason = bulkRejectReason.trim();
    if (!reason) {
      toast({ variant: "destructive", title: "Reason required", description: "Enter a reason — it is emailed to each applicant." });
      return;
    }
    setBulkBusy("reject");
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase
      .from("mentor_applications")
      .update({ status: "rejected", rejection_reason: reason, admin_notes: reason, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .in("id", ids);
    if (!error) {
      await Promise.allSettled(ids.map((id) =>
        supabase.functions.invoke("mentor-application-decision-email", {
          body: { application_id: id, decision: "rejected", notes: reason },
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
        })
      ));
    }
    setBulkBusy(null);
    setRejectOpen(false);
    setBulkRejectReason("");
    if (error) toast({ variant: "destructive", title: "Bulk reject failed", description: error.message });
    else { toast({ title: `Rejected ${ids.length} application${ids.length === 1 ? "" : "s"}` }); await fetchApps(); }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Mentor Applications</h1>
          <p className="text-muted-foreground mt-1">Review, approve and triage incoming mentor applications.</p>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
          <Tabs value={tab} onValueChange={(v) => { setTab(v as Status); setPicked(new Set()); }}>
            <TabsList className="overflow-x-auto w-full sm:w-auto flex [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <TabsTrigger value="pending" className="shrink-0">
                Pending <Badge variant="secondary" className="ml-2">{counts.pending}</Badge>
              </TabsTrigger>
              <TabsTrigger value="approved" className="shrink-0">
                Approved <Badge variant="secondary" className="ml-2">{counts.approved}</Badge>
              </TabsTrigger>
              <TabsTrigger value="changes_requested" className="shrink-0">
                Changes Req. <Badge variant="secondary" className="ml-2">{counts.changes_requested}</Badge>
              </TabsTrigger>
              <TabsTrigger value="rejected" className="shrink-0">
                Rejected <Badge variant="secondary" className="ml-2">{counts.rejected}</Badge>
              </TabsTrigger>
              <TabsTrigger value="all" className="shrink-0">
                All <Badge variant="secondary" className="ml-2">{counts.all}</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative sm:ml-auto w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, email, skill…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {picked.size > 0 && (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="flex flex-wrap items-center gap-3 py-3">
              <span className="text-sm font-medium">{picked.size} selected</span>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setPicked(new Set())}>Clear</Button>
                <Button size="sm" variant="destructive" disabled={!!bulkBusy} onClick={() => {
                  if (!eligibleIds().length) {
                    toast({ variant: "destructive", title: "Nothing to reject", description: "None of the selected applications are awaiting review." });
                    return;
                  }
                  setRejectOpen(true);
                }}>
                  {bulkBusy === "reject" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                  Reject pending
                </Button>
                <Button size="sm" disabled={!!bulkBusy} onClick={bulkApprove}>
                  {bulkBusy === "approve" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Approve pending
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allOnPage} onCheckedChange={toggleAll} aria-label="Select all" />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Expertise</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No applications</TableCell></TableRow>
                ) : (
                  filtered.map((a) => (
                    <TableRow key={a.id} className="cursor-pointer">
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={picked.has(a.id)} onCheckedChange={() => togglePick(a.id)} />
                      </TableCell>
                      <TableCell className="font-medium" onClick={() => { setSelected(a); setOpen(true); }}>{a.full_name}</TableCell>
                      <TableCell onClick={() => { setSelected(a); setOpen(true); }}>{a.email}</TableCell>
                      <TableCell onClick={() => { setSelected(a); setOpen(true); }}>
                        <div className="flex flex-wrap gap-1">
                          {a.expertise.slice(0, 3).map((e) => <Badge key={e} variant="outline" className="text-xs">{e}</Badge>)}
                          {a.expertise.length > 3 && <span className="text-xs text-muted-foreground">+{a.expertise.length - 3}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground" onClick={() => { setSelected(a); setOpen(true); }}>{formatISTDate(a.created_at)}</TableCell>
                      <TableCell onClick={() => { setSelected(a); setOpen(true); }}>
                        <Badge
                          variant={variant(a.status)}
                          className={
                            a.status === "changes_requested"
                              ? "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100/85 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900"
                              : ""
                          }
                        >
                          {a.status === "changes_requested" ? "changes requested" : a.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <ApplicationDetailDialog application={selected} open={open} onOpenChange={setOpen} onUpdated={fetchApps} />

      <AlertDialog open={rejectOpen} onOpenChange={(o) => { if (!o) { setRejectOpen(false); setBulkRejectReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject {eligibleIds().length} application{eligibleIds().length === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This reason is emailed to each applicant. It is required.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            rows={3}
            value={bulkRejectReason}
            onChange={(e) => setBulkRejectReason(e.target.value)}
            placeholder="Provide a clear reason for rejection…"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy === "reject"}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={bulkReject} disabled={bulkBusy === "reject" || !bulkRejectReason.trim()}>
              {bulkBusy === "reject" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Reject applications
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default AdminApplications;
