import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, X, UserSearch } from "lucide-react";
import { useMentors } from "@/features/mentors";
import { useMyPrograms } from "@/features/programs/hooks/useMyPrograms";
import { supabase } from "@/integrations/supabase/client";
import ExpertiseFilter from "@/features/mentors/components/ExpertiseFilter";
import { cn } from "@/lib/utils";

const MentorDirectory = () => {
  const [search, setSearch] = useState("");
  const [selectedExpertise, setSelectedExpertise] = useState<string[]>([]);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: mentors = [], isLoading } = useMentors();
  const { data: myPrograms = [] } = useMyPrograms();

  const [mentorPrograms, setMentorPrograms] = useState<
    Record<string, { id: string; name: string; slug: string; color: string }[]>
  >({});

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

  const allExpertise = useMemo(() => {
    const set = new Set<string>();
    mentors.forEach((m) =>
      m.mentor_profiles?.[0]?.expertise?.forEach((e) => e && set.add(e))
    );
    return Array.from(set);
  }, [mentors]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return mentors.filter((m) => {
      const exp = m.mentor_profiles?.[0]?.expertise ?? [];
      const matchesSearch =
        !q ||
        m.full_name.toLowerCase().includes(q) ||
        exp.some((e) => e.toLowerCase().includes(q));
      if (!matchesSearch) return false;
      if (selectedExpertise.length > 0) {
        const has = selectedExpertise.every((tag) => exp.includes(tag));
        if (!has) return false;
      }
      if (activeProgram) {
        return (mentorPrograms[m.id] || []).some((p) => p.id === activeProgram.id);
      }
      return true;
    });
  }, [mentors, search, activeProgram, mentorPrograms, selectedExpertise]);

  const setProgramFilter = (slug: string | null) => {
    const next = new URLSearchParams(params);
    if (slug) next.set("program", slug);
    else next.delete("program");
    setParams(next, { replace: true });
  };

  const clearAll = () => {
    setSearch("");
    setSelectedExpertise([]);
    setProgramFilter(null);
  };

  const hasActiveFilters = search || selectedExpertise.length > 0 || !!activeProgram;

  return (
    <AppLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Find a Mentor</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Browse available mentors and book a session.
          </p>
        </div>

        {/* Filter bar */}
        <div className="sticky top-0 z-20 -mx-2 px-2 py-3 bg-background/80 backdrop-blur-md border-b">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 h-10"
                placeholder="Search by name or expertise…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <ExpertiseFilter
              options={allExpertise}
              selected={selectedExpertise}
              onChange={setSelectedExpertise}
            />

            {myPrograms.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setProgramFilter(null)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition-colors",
                    !activeProgram
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-muted",
                  )}
                >
                  All programs
                </button>
                {myPrograms.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setProgramFilter(p.slug)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs transition-colors",
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

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="ml-auto h-8 text-xs" onClick={clearAll}>
                Clear all
              </Button>
            )}
          </div>

          {selectedExpertise.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {selectedExpertise.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2.5 py-1"
                >
                  {tag}
                  <button
                    onClick={() =>
                      setSelectedExpertise(selectedExpertise.filter((t) => t !== tag))
                    }
                    className="hover:bg-primary/20 rounded-full p-0.5"
                    aria-label={`Remove ${tag}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="text-xs text-muted-foreground mt-2">
            {isLoading ? "Loading…" : `${filtered.length} mentor${filtered.length === 1 ? "" : "s"}`}
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] w-full rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <UserSearch className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">No mentors match your filters</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Try a different search or clear filters to see everyone.
            </p>
            <Button variant="outline" size="sm" onClick={clearAll}>
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map((m) => {
              const profile = m.mentor_profiles?.[0];
              const initials = m.full_name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase();
              const topTag = profile?.expertise?.[0];
              return (
                <Card
                  key={m.id}
                  onClick={() => navigate(`/book/${m.id}`)}
                  className="group relative overflow-hidden cursor-pointer border-0 rounded-2xl aspect-[3/4] bg-[#1a1a2e] hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
                >
                  {m.avatar_url ? (
                    <img
                      src={m.avatar_url}
                      alt={m.full_name}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="rounded-full flex items-center justify-center bg-white/10 text-white/60 text-3xl font-medium w-24 h-24">
                        {initials}
                      </div>
                    </div>
                  )}

                  {topTag && (
                    <span className="absolute top-2.5 left-2.5 z-10 rounded-full bg-black/55 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-1 max-w-[80%] truncate">
                      {topTag}
                    </span>
                  )}

                  <div
                    className="absolute bottom-0 left-0 right-0 z-10 px-3 pb-3 pt-12"
                    style={{
                      background:
                        "linear-gradient(to top, rgba(0,0,0,0.92) 50%, rgba(0,0,0,0.4) 80%, transparent 100%)",
                    }}
                  >
                    <h3 className="font-bold text-white text-[15px] leading-tight truncate">
                      {m.full_name}
                    </h3>
                    <div className="flex items-center justify-between gap-2 mt-2">
                      {profile?.years_experience ? (
                        <div className="text-[11px] text-white/75 whitespace-nowrap">
                          <span className="text-[13px] font-bold text-white">
                            {profile.years_experience}
                          </span>{" "}
                          Yrs
                        </div>
                      ) : (
                        <span />
                      )}
                      <Button
                        size="sm"
                        className="h-7 px-3 text-[11px] font-bold bg-white text-black hover:bg-white/90 rounded-md"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/book/${m.id}`);
                        }}
                      >
                        Book
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default MentorDirectory;
