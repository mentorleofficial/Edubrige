import { useState } from "react";
import { openStoredFile } from "@/lib/storedFile";
import { handleError } from "@/lib/handleError";
import { useStoredFileUrl } from "@/hooks/useStoredFileUrl";
import { cn } from "@/lib/utils";

interface Props {
  bucket: string;
  value: string;
  downloadName?: string;
  className?: string;
  title?: string;
  children: React.ReactNode;
}

// A link to a file in private storage via a short-lived signed URL. Renders a
// real link once the URL is ready; until then a click resolves it on demand.
export default function StoredFileLink({ bucket, value, downloadName, className, title, children }: Props) {
  const href = useStoredFileUrl(bucket, value, downloadName);
  const [opening, setOpening] = useState(false);

  if (href) {
    return (
      <a
        href={href}
        title={title}
        className={cn("text-left", className)}
        {...(downloadName ? {} : { target: "_blank", rel: "noopener noreferrer" })}
      >
        {children}
      </a>
    );
  }

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
