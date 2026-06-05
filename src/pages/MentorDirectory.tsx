import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
              const headline = m.headline ?? profile?.bio ?? "";
              return (
                <Card
                  key={m.id}
                  className="group overflow-hidden hover:shadow-xl transition-all duration-300 border-0 relative"
                  style={{ borderRadius: '20px', width: '260px', aspectRatio: '3/4', background: '#1a1a2e' }}
                >
                  {/* Full-bleed background image */}
                  {m.avatar_url ? (
                    <img
                      src={m.avatar_url}
                      alt={m.full_name}
                      className="absolute inset-0 w-full h-full object-cover object-top"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-start justify-center pt-6">
                      <div
                        className="rounded-full flex items-center justify-center"
                        style={{ width: 160, height: 160, background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontSize: 48, fontWeight: 500 }}
                      >
                        {initials}
                      </div>
                    </div>
                  )}

                  {/* Share button */}
                  {/* <button
                    className="absolute top-3 right-3 z-10 flex items-center justify-center rounded-full"
                    style={{ width: 34, height: 34, background: 'rgba(255,255,255,0.18)', border: '0.5px solid rgba(255,255,255,0.25)' }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                  </button> */}

                  {/* Compact bottom overlay */}
                  <div
                    className="absolute bottom-0 left-0 right-0 z-10 px-3.5 pb-3.5"
                    style={{ paddingTop: 48, background: 'linear-gradient(to top, rgba(0,0,0,0.88) 55%, transparent 100%)' }}
                  >
                    <h3 className="font-bold pb-2 text-white mb-0.5" style={{ fontSize: 17, lineHeight: 1.2 }}>
                      {m.full_name}
                    </h3>

                    {/* {headline && (
                      <p className="mb-2.5" style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
                        {headline}
                      </p>
                    )} */}

                    <div className="flex items-center gap-2.5">
                      {profile?.years_experience && (
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{profile.years_experience}</span> Yrs Exp.
                        </div>
                      )}
                      <Button
                        className="flex-1 font-bold"
                        style={{ background: '#fff', color: '#111', borderRadius: 8, padding: '8px 0', border: 'none', fontSize: 12, height: 'auto' }}
                        onClick={() => navigate(`/book/${m.id}`)}
                      >
                        Book Now
                      </Button>
                    </div>
                  </div>
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
