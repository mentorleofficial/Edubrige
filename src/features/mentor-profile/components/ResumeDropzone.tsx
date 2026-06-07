import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Upload, X, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getResumeSignedUrl } from "../api/mentorProfile";

interface Props {
  /** existing storage path (not URL) */
  currentPath: string;
  /** new file selected this session, not yet uploaded */
  pendingFile: File | null;
  onFileChange: (f: File | null) => void;
  onRemoveCurrent: () => void;
}

const MAX = 5 * 1024 * 1024;
const ACCEPT = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const fmt = (n: number) => (n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

const ResumeDropzone = ({ currentPath, pendingFile, onFileChange, onRemoveCurrent }: Props) => {
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const accept = (f: File | null | undefined) => {
    if (!f) return;
    if (f.size > MAX) return setError("Resume must be under 5MB");
    if (!ACCEPT.includes(f.type)) return setError("Must be PDF or DOC/DOCX");
    setError(null);
    onFileChange(f);
  };

  const [resumeUrl, setResumeUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchUrl = async () => {
      if (!currentPath) {
        setResumeUrl(null);
        return;
      }
      setOpening(true);
      try {
        const url = await getResumeSignedUrl(currentPath);
        if (active && url) {
          setResumeUrl(url);
        }
      } catch (err) {
        console.error("Error signing resume URL:", err);
      } finally {
        if (active) setOpening(false);
      }
    };
    fetchUrl();
    return () => {
      active = false;
    };
  }, [currentPath]);

  const hasCurrent = !!currentPath && !pendingFile;

  if (pendingFile) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{pendingFile.name}</p>
            <p className="text-xs text-muted-foreground">{fmt(pendingFile.size)} · will upload on save</p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={() => onFileChange(null)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (hasCurrent) {
    const name = currentPath.split("/").pop() ?? "Resume";
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{name}</p>
            <p className="text-xs text-muted-foreground">Uploaded</p>
          </div>
        </div>
        <div className="flex gap-1">
          {resumeUrl ? (
            <Button variant="ghost" size="icon" asChild>
              <a href={resumeUrl} target="_blank" rel="noopener noreferrer" title="View resume">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="icon" disabled>
              <Loader2 className="h-4 w-4 animate-spin" />
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => ref.current?.click()}>
            Replace
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={onRemoveCurrent}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <input
          ref={ref}
          type="file"
          accept=".pdf,.doc,.docx"
          className="hidden"
          onChange={(e) => accept(e.target.files?.[0])}
        />
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          accept(e.dataTransfer.files?.[0]);
        }}
        onClick={() => ref.current?.click()}
        className={cn(
          "cursor-pointer rounded-lg border-2 border-dashed border-border bg-muted/20 p-6 text-center transition-colors",
          drag && "border-primary bg-primary/5"
        )}
      >
        <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">Drop your resume here, or click to browse</p>
        <p className="text-xs text-muted-foreground">PDF, DOC, DOCX · max 5MB</p>
        <input
          ref={ref}
          type="file"
          accept=".pdf,.doc,.docx"
          className="hidden"
          onChange={(e) => accept(e.target.files?.[0])}
        />
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
};

export default ResumeDropzone;
