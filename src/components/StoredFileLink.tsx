import { useState } from "react";
import { openStoredFile } from "@/lib/storedFile";
import { handleError } from "@/lib/handleError";
import { cn } from "@/lib/utils";

interface Props {
  bucket: string;
  value: string;
  downloadName?: string;
  className?: string;
  title?: string;
  children: React.ReactNode;
}

// A link-looking button for files in private storage: resolves a signed URL on
// click instead of exposing a permanent public link.
export default function StoredFileLink({ bucket, value, downloadName, className, title, children }: Props) {
  const [opening, setOpening] = useState(false);
  return (
    <button
      type="button"
      title={title}
      disabled={opening}
      className={cn("text-left disabled:opacity-60", className)}
      onClick={async () => {
        setOpening(true);
        try {
          await openStoredFile(bucket, value, downloadName);
        } catch (e) {
          handleError(e, "Couldn't open this file");
        } finally {
          setOpening(false);
        }
      }}
    >
      {children}
    </button>
  );
}
