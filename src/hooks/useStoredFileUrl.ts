import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { storagePath } from "@/lib/storedFile";

const EXPIRES_IN = 60 * 60;

// Resolved ahead of the click so the file can be a real <a target="_blank">:
// a tab opened after an await is treated as a pop-up and may be blocked or
// replaced by a same-tab navigation. Refreshed well before the link expires.
export function useStoredFileUrl(bucket: string, value: string | null | undefined, downloadName?: string) {
  const path = value ? storagePath(bucket, value) : null;
  const { data } = useQuery({
    queryKey: ["signed-url", bucket, path, downloadName ?? null],
    enabled: !!path,
    staleTime: (EXPIRES_IN - 10 * 60) * 1000,
    refetchInterval: (EXPIRES_IN - 10 * 60) * 1000,
    retry: false,
    meta: { silent: true },
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path!, EXPIRES_IN, downloadName ? { download: downloadName } : undefined);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  return data ?? null;
}
