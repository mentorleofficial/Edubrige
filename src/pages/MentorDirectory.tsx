import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Calendar } from "lucide-react";
import { useMentors } from "@/features/mentors";
import { useMyPrograms } from "@/features/programs/hooks/useMyPrograms";
import { supabase } from "@/integrations/supabase/client";
import ProgramBadge from "@/components/programs/ProgramBadge";
import { cn } from "@/lib/utils";

const MentorDirectory = () => {
  const [search, setSearch] = useState("");
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: mentors = [], isLoading } = useMentors();
  const { data: myPrograms = [] } = useMyPrograms();

  // Map mentor_id -> programs they belong to (only programs the current user can see)
  const [mentorPrograms, setMentorPrograms] = useState<Record<string, { id: string; name: string; slug: string; color: string }[]>>({});

  useEffect(() => {
    if (myPrograms.length === 0) {
      setMentorPrograms({});
      return;
    }
    (async () => {
      const programIds = myPrograms.map((p) => p.id);
      const { data: pm } = await supabase
        .from("program_mentors")
        .select("program_id, mentor_id")
        .in("program_id", programIds);
      const byMentor: Record<string, { id: string; name: string; slug: string; color: string }[]> = {};
      const programMap = new Map(myPrograms.map((p) => [p.id, p]));
      (pm || []).forEach((row: any) => {
        const p = programMap.get(row.program_id);
        if (!p) return;
        (byMentor[row.mentor_id] ||= []).push({ id: p.id, name: p.name, slug: p.slug, color: p.color });
      });
      setMentorPrograms(byMentor);
    })();
  }, [myPrograms]);

  const activeProgramSlug = params.get("program");
  const activeProgram = activeProgramSlug ? myPrograms.find((p) => p.slug === activeProgramSlug) : null;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return mentors.filter((m) => {
      const matchesSearch =
        m.full_name.toLowerCase().includes(q) ||
        m.mentor_profiles?.[0]?.expertise?.some((e) => e.toLowerCase().includes(q));
      if (!matchesSearch) return false;
      if (activeProgram) {
        return (mentorPrograms[m.id] || []).some((p) => p.id === activeProgram.id);
      }
      return true;
    });
  }, [mentors, search, activeProgram, mentorPrograms]);

  const setProgramFilter = (slug: string | null) => {
    const next = new URLSearchParams(params);
    if (slug) next.set("program", slug);
    else next.delete("program");
    setParams(next, { replace: true });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Find a Mentor</h1>
          <p className="text-muted-foreground mt-1">Browse available mentors and book a session.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name or expertise…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {myPrograms.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground mr-1">Program:</span>
            <button
              onClick={() => setProgramFilter(null)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                !activeProgram ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted",
              )}
            >
              All
            </button>
            {myPrograms.map((p) => (
              <button
                key={p.id}
                onClick={() => setProgramFilter(p.slug)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  activeProgram?.id === p.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:bg-muted",
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((m) => {
              const profile = m.mentor_profiles?.[0];
              const initials = m.full_name.split(" ").map((n) => n[0]).join("").toUpperCase();
              const progs = mentorPrograms[m.id] || [];
              return (
                <Card key={m.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="flex flex-row items-start gap-4 pb-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg">{m.full_name}</CardTitle>
                      {profile?.years_experience ? (
                        <p className="text-sm text-muted-foreground">{profile.years_experience} years experience</p>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {progs.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {progs.map((p) => (
                          <ProgramBadge key={p.id} name={p.name} color={p.color} to={`/mentee/programs/${p.slug}`} />
                        ))}
                      </div>
                    )}
                    {profile?.bio && <p className="text-sm text-muted-foreground line-clamp-2">{profile.bio}</p>}
                    {profile?.expertise && profile.expertise.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {profile.expertise.slice(0, 4).map((e) => (
                          <Badge key={e} variant="secondary" className="text-xs">{e}</Badge>
                        ))}
                      </div>
                    )}
                    <Button variant="outline" className="w-full" onClick={() => navigate(`/book/${m.id}`)}>
                      <Calendar className="mr-2 h-4 w-4" />Book Session
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
            {filtered.length === 0 && <p className="text-muted-foreground col-span-full">No mentors found.</p>}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default MentorDirectory;
