import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useBulkInvite } from "../hooks/useAdminUsers";
import type { BulkInviteResult } from "../api/users";
import {
  MAX_PER_UPLOAD,
  MAX_PER_DAY,
  downloadCsvTemplate,
  parseInviteCsv,
  type ParsedInviteRow,
} from "../utils/bulkInviteCsv";
import { AlertCircle, Download, FileUp, Loader2, Upload } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BulkInviteDialog = ({ open, onOpenChange }: Props) => {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const bulkInvite = useBulkInvite();

  const [filename, setFilename] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedInviteRow[]>([]);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkInviteResult | null>(null);

  const validRows = rows.filter((r) => !r.error);
  const invalidCount = rows.length - validRows.length;
  const overLimit = rows.length > MAX_PER_UPLOAD;
  const canSubmit = validRows.length > 0 && !overLimit && !fatalError && !bulkInvite.isPending;

  const reset = () => {
    setFilename(null);
    setRows([]);
    setFatalError(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    setResult(null);
    setFilename(file.name);
    const text = await file.text();
    const parsed = parseInviteCsv(text);
    setRows(parsed.rows);
    setFatalError(parsed.fatalError);
  };

  const handleSubmit = async () => {
    try {
      const res = await bulkInvite.mutateAsync({
        rows: validRows.map((r) => ({ email: r.email, full_name: r.full_name, role: r.role! })),
        filename: filename ?? undefined,
      });
      setResult(res);
      toast({
        title: `${res.sent} invite${res.sent === 1 ? "" : "s"} sent`,
        description: [
          res.skipped ? `${res.skipped} skipped (already registered)` : null,
          res.failed ? `${res.failed} failed` : null,
        ]
          .filter(Boolean)
          .join(" · ") || undefined,
        variant: res.failed ? "destructive" : "default",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Bulk invite failed",
        description: (err as Error).message,
      });
    }
  };

  const statusBadge = (status: string) => {
    if (status === "sent") return <Badge className="bg-emerald-500/15 text-emerald-600 border border-emerald-500/35">sent</Badge>;
    if (status === "skipped_duplicate") return <Badge variant="outline">already registered</Badge>;
    return <Badge variant="destructive">failed</Badge>;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk invite from CSV</DialogTitle>
          <DialogDescription>
            Up to {MAX_PER_UPLOAD} invites per upload, {MAX_PER_DAY} per day across the platform.
            Columns: Name, Email, Role (mentee or mentor).
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge className="bg-emerald-500/15 text-emerald-600 border border-emerald-500/35">{result.sent} sent</Badge>
              {result.skipped > 0 && <Badge variant="outline">{result.skipped} already registered</Badge>}
              {result.failed > 0 && <Badge variant="destructive">{result.failed} failed</Badge>}
              <span className="ml-auto text-muted-foreground">{result.remaining_today} remaining today</span>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.results.map((r) => (
                    <TableRow key={r.email}>
                      <TableCell className="font-medium">{r.email}</TableCell>
                      <TableCell className="text-muted-foreground">{r.role}</TableCell>
                      <TableCell>
                        {statusBadge(r.status)}
                        {r.error_message && (
                          <p className="text-xs text-muted-foreground mt-1">{r.error_message}</p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => downloadCsvTemplate()}>
                <Download className="mr-2 h-4 w-4" />
                Download template
              </Button>
              <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                <FileUp className="mr-2 h-4 w-4" />
                {filename ? "Choose another file" : "Choose CSV file"}
              </Button>
              {filename && <span className="text-sm text-muted-foreground truncate">{filename}</span>}
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </div>

            {fatalError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{fatalError}</AlertDescription>
              </Alert>
            )}

            {overLimit && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This file has {rows.length} rows. Split it into uploads of {MAX_PER_UPLOAD} or fewer.
                </AlertDescription>
              </Alert>
            )}

            {rows.length > 0 && !fatalError && (
              <>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="secondary">{validRows.length} ready</Badge>
                  {invalidCount > 0 && <Badge variant="destructive">{invalidCount} with errors</Badge>}
                  {invalidCount > 0 && (
                    <span className="text-muted-foreground">Rows with errors are skipped.</span>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">Line</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.line} className={r.error ? "bg-destructive/5" : undefined}>
                          <TableCell className="text-muted-foreground">{r.line}</TableCell>
                          <TableCell className="font-medium">{r.full_name || "—"}</TableCell>
                          <TableCell>
                            {r.email || "—"}
                            {r.error && <p className="text-xs text-destructive mt-1">{r.error}</p>}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{r.role ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!canSubmit}>
                {bulkInvite.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Send {validRows.length > 0 ? validRows.length : ""} invite{validRows.length === 1 ? "" : "s"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkInviteDialog;
