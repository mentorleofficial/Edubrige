import { memo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Compass, Share2, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { RecommendedMentor } from "@/features/mentee-dashboard/useMenteeDashboardData";

const initials = (n: string) =>
  n.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";

const RecommendedMentors = ({ mentors }: { mentors: RecommendedMentor[] }) => {
  const navigate = useNavigate();
  const [sharedId, setSharedId] = useState<string | null>(null);

  if (mentors.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Compass className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Recommended Mentors for you</CardTitle>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/mentors">Browse all mentors</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {mentors.map((m) => {
              const topTag = m.current_role;
              const expertiseTags = m.expertise ?? [];
              const visibleTags = expertiseTags.slice(0, 2);
              const remainingCount = expertiseTags.length - visibleTags.length;

              return (
                <Card
                  key={m.user_id}
                  onClick={() => navigate(`/book/${m.user_id}`)}
                  className="group relative overflow-hidden cursor-pointer border-0 rounded-2xl aspect-[4/5] bg-[#1a1a2e] hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="absolute top-3 right-3 z-20 flex gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const url = `${window.location.origin}/book/${m.user_id}`;
                        navigator.clipboard.writeText(url);
                        setSharedId(m.user_id);
                        toast.success("Link copied");
                        setTimeout(() => setSharedId(null), 1500);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm text-white hover:bg-black/70"
                    >
                      {sharedId === m.user_id ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                    </button>
                  </div>

                  {m.avatar_url ? (
                    <img
                      src={m.avatar_url}
                      alt={m.full_name}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="rounded-full bg-white/10 text-white text-4xl font-medium w-24 h-24 flex items-center justify-center">
                        {initials(m.full_name)}
                      </div>
                    </div>
                  )}

                  {topTag && (
                    <span className="absolute top-3 left-3 z-10 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs font-medium px-3 py-1 max-w-[65%] truncate">
                      {topTag}
                    </span>
                  )}

                  <div
                    className="absolute bottom-0 left-0 right-0 z-10 px-3 pb-3 pt-10"
                    style={{
                      background: "linear-gradient(to top, rgba(0,0,0,0.94) 55%, rgba(0,0,0,0.45) 82%, transparent 100%)",
                    }}
                  >
                    <h3 className="font-bold text-white text-[15px] leading-tight truncate">
                      {m.full_name}
                    </h3>

                    {expertiseTags.length > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1 mt-1.5 flex-nowrap overflow-hidden">
                            {visibleTags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-white/15 text-white/90 text-[10px] font-medium px-2 py-0.5 truncate"
                              >
                                {tag}
                              </span>
                            ))}
                            {remainingCount > 0 && (
                              <span className="rounded-full bg-white/20 text-white text-[10px] font-semibold px-2 py-0.5 whitespace-nowrap">
                                +{remainingCount}
                              </span>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <div className="flex flex-wrap gap-1">
                            {expertiseTags.map((tag) => (
                              <span key={tag} className="rounded-full bg-muted text-foreground text-xs px-2 py-0.5">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )}

                    <div className="flex items-center justify-between mt-3">
                      {m.years_experience ? (
                        <div className="text-white/75 text-sm">
                          <span className="font-bold text-white">{m.years_experience}</span> Yrs
                        </div>
                      ) : (
                        <span />
                      )}
                      <Button
                        size="sm"
                        className="bg-white text-black hover:bg-white/90 text-xs font-semibold"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/book/${m.user_id}`);
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
        </TooltipProvider>
      </CardContent>
    </Card>
  );
};

export default /* @__PURE__ */ memo(RecommendedMentors);
