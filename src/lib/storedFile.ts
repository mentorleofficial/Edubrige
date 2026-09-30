import { supabase } from "@/integrations/supabase/client";

// Private buckets (session attachments, mentee resumes) can't be opened by a
// plain URL. Stored values may be a full storage URL (older rows) or a bare
// object path — both resolve to the object path here.
export function storagePath(bucket: string, value: string): string {
  const marker = `/${bucket}/`;
  const i = value.indexOf(marker);
  const path = i >= 0 ? value.slice(i + marker.length) : value;
  return decodeURIComponent(path.split("?")[0]);
}

// Opens a short-lived signed link. The tab is opened synchronously (before the
// await) so pop-up blockers treat it as a direct result of the click.
export async function openStoredFile(bucket: string, value: string, downloadName?: string): Promise<void> {
  const win = window.open("", "_blank");
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath(bucket, value), 300, downloadName ? { download: downloadName } : undefined);
  if (error || !data?.signedUrl) {
    win?.close();
    throw error ?? new Error("Couldn't open this file");
  }
  if (win) {
    win.opener = null;
    win.location.href = data.signedUrl;
  } else {
    window.location.href = data.signedUrl;
  }
}
