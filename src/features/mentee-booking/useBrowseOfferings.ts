import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BrowseOffering = {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  category: string | null;
  status: string;
  mentor_id: string;
  mentor: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    mentor_profiles: {
      current_role: string | null;
    }[] | null;
  } | null;
};

export function useBrowseOfferings() {
  return useQuery<BrowseOffering[]>({
    queryKey: ["browse-offerings"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentorship_offerings")
        .select(`
          id, title, description, duration_minutes, price, category, status, mentor_id,
          mentor:users!mentorship_offerings_mentor_id_fkey(id, full_name, avatar_url, mentor_profiles(current_role))
        `)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BrowseOffering[];
    },
  });
}
