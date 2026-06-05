import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import BadgeChip from "@/components/badges/BadgeChip";
import SocialShareButtons from "@/components/SocialShareButtons";
import { useMentorBadges } from "@/features/badges/api";
import {
  Briefcase,
  GraduationCap,
  Linkedin,
  Globe,
  Building2,
  Calendar,
  Sparkles,
  ArrowLeft,
  Star,
  Tag,
  Clock,
  Coins,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

type Qualification = {
  institution: string;
  degree: string;
  field?: string;
  start_year?: string;
  end_year?: string;
};

type Experience = {
  company: string;
  title: string;
  start_date: string;
  end_date?: string;
  description?: string;
};

type PublicMentor = {
  user_id: string;
  slug: string | null;
  full_name: string;
  avatar_url: string | null;
  headline: string;
  bio: string;
  expertise: string[];
  years_experience: number;
  current_organization: string;
  current_role: string;
  linkedin_url: string;
  portfolio_url: string;
  qualifications: Qualification[];
  experiences: Experience[];
};

const initialsOf = (name: string) =>
  name.split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "M";

const formatMonth = (s?: string) => {
  if (!s) return "Present";
  try {
    const [y, m] = s.split("-");
    if (!m) return y;
    return new Date(Number(y), Number(m) - 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  } catch {
    return s;
  }
};

const PublicMentorProfile = () => {
  const { mentorId } = useParams<{ mentorId: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const branding = useBranding();
  const [mentor, setMentor] = useState<PublicMentor | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [rating, setRating] = useState<{ avg: number; count: number }>({ avg: 0, count: 0 });
  const { data: mentorBadges = [] } = useMentorBadges(mentor?.user_id);

  // Fetch active offerings
  const { data: offerings = [] } = useQuery<any[]>({
    queryKey: ["public-offerings", mentor?.user_id],
    enabled: !!mentor?.user_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentorship_offerings")
        .select("*")
        .eq("mentor_id", mentor!.user_id)
        .eq("status", "active")
        .order("duration_minutes");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const fetch = async () => {
      if (!mentorId) return;
      setLoading(true);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mentorId);

      // SECURITY DEFINER RPC: returns only public-safe mentor fields, no email.
      const { data: rows } = await supabase.rpc("get_public_mentor", {
        _slug_or_id: mentorId,
      });
      const mp = Array.isArray(rows) && rows.length ? (rows[0] as any) : null;

      if (!mp) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // If accessed via UUID but slug exists, redirect to pretty URL
      if (isUuid && mp.slug) {
        navigate(`/mentors/${mp.slug}`, { replace: true });
        return;
      }

      setMentor({
        user_id: mp.user_id,
        slug: mp.slug ?? null,
        full_name: mp.full_name ?? "Mentor",
        avatar_url: mp.avatar_url ?? null,
        headline: mp.headline ?? "",
        bio: mp.bio ?? "",
        expertise: mp.expertise ?? [],
        years_experience: mp.years_experience ?? 0,
        current_organization: mp.current_organization ?? "",
        current_role: mp.current_role ?? "",
        linkedin_url: mp.linkedin_url ?? "",
        portfolio_url: mp.portfolio_url ?? "",
        qualifications: (mp.qualifications as Qualification[]) ?? [],
        experiences: (mp.experiences as Experience[]) ?? [],
      });
      setLoading(false);

      // Aggregate mentor rating
      const { data: fb } = await supabase
        .from("feedback")
        .select("rating, sessions!inner(mentor_id)")
        .eq("audience", "mentor")
        .eq("sessions.mentor_id", mp.user_id);
      if (fb && fb.length) {
        const avg = fb.reduce((s: number, r: any) => s + r.rating, 0) / fb.length;
        setRating({ avg: Math.round(avg * 10) / 10, count: fb.length });
      }
    };
    fetch();
  }, [mentorId]);

  const onBook = () => {
    if (!user) {
      navigate(`/login?redirect=/mentors/${mentorId}`);
      return;
    }
    const targetId = mentor?.user_id ?? mentorId;
    if (role === "mentee") navigate(`/book/${targetId}`);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (notFound || !mentor) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <CardTitle>Mentor not found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              This profile doesn't exist or isn't currently active.
            </p>
            <Button asChild variant="outline">
              <Link to="/"><ArrowLeft className="h-4 w-4" /> Back home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const title = `${mentor.full_name} — Mentor on ${branding.app_name}`;
  const description = mentor.headline || mentor.bio.slice(0, 155) || `Mentor with ${mentor.years_experience}+ years of experience.`;

  return (
    <TooltipProvider>
    <div className="min-h-screen bg-muted/20">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="profile" />
        {mentor.avatar_url && <meta property="og:image" content={mentor.avatar_url} />}
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Header card */}
        <Card className="overflow-hidden">
          <div className="h-32 bg-gradient-to-br from-primary via-primary/80 to-accent" />
          <CardContent className="-mt-14 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <Avatar className="h-28 w-28 border-4 border-background shadow-lg">
                <AvatarImage src={mentor.avatar_url ?? undefined} />
                <AvatarFallback className="text-2xl">{initialsOf(mentor.full_name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 sm:pb-2">
                <h1 className="text-2xl sm:text-3xl font-bold">{mentor.full_name}</h1>
                {mentor.headline && (
                  <p className="text-muted-foreground mt-1">{mentor.headline}</p>
                )}
                <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                  {mentor.current_role && mentor.current_organization && (
                    <span className="flex items-center gap-1.5">
                      <Building2 className="h-4 w-4" /> {mentor.current_role} at {mentor.current_organization}
                    </span>
                  )}
                  {mentor.years_experience > 0 && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" /> {mentor.years_experience}+ years
                    </span>
                  )}
                  {rating.count > 0 && (
                    <span className="flex items-center gap-1.5">
                      <Star className="h-4 w-4 fill-primary text-primary" /> {rating.avg} ({rating.count} review{rating.count === 1 ? "" : "s"})
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 sm:pb-2">
                {mentor.linkedin_url && (
                  <Button variant="outline" size="icon" asChild>
                    <a href={mentor.linkedin_url} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                      <Linkedin className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                {mentor.portfolio_url && (
                  <Button variant="outline" size="icon" asChild>
                    <a href={mentor.portfolio_url} target="_blank" rel="noopener noreferrer" aria-label="Portfolio">
                      <Globe className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                <Button onClick={onBook}>Book a session</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Badges + Share */}
        {(mentorBadges.length > 0 || true) && (
          <Card>
            <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {mentorBadges.length > 0 ? (
                  mentorBadges.map((mb) => <BadgeChip key={mb.id} badge={mb.badge} />)
                ) : (
                  <span className="text-xs text-muted-foreground">No badges yet</span>
                )}
              </div>
              <SocialShareButtons
                url={typeof window !== "undefined" ? window.location.href : ""}
                text={`Check out ${mentor.full_name}${mentor.headline ? ` — ${mentor.headline}` : ""} on ${branding.app_name}`}
              />
            </CardContent>
          </Card>
        )}

        {/* Offerings & Services */}
        {offerings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Tag className="h-5 w-5 text-primary" /> Offerings & Services
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {offerings.map((o) => (
                  <Card key={o.id} className="flex flex-col justify-between border bg-card/50 hover:border-primary/40 transition-all">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-sm text-foreground">{o.title}</h4>
                      </div>
                      {o.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                          {o.description}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="p-4 pt-2 space-y-3">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-primary" /> {o.duration_minutes} mins
                        </span>
                        <span className="flex items-center gap-1">
                          <Coins className="h-3.5 w-3.5 text-emerald-500" /> {o.price === 0 ? "Free" : `₹${o.price}`}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        className="w-full mt-2"
                        onClick={() => {
                          if (!user) {
                            navigate(`/login?redirect=/mentors/${mentorId}`);
                            return;
                          }
                          const targetId = mentor?.user_id ?? mentorId;
                          if (role === "mentee") navigate(`/book/${targetId}?offeringId=${o.id}`);
                        }}
                      >
                        Book session
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* About */}
        {mentor.bio && (
          <Card>
            <CardHeader><CardTitle className="text-lg">About</CardTitle></CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{mentor.bio}</p>
            </CardContent>
          </Card>
        )}

        {/* Expertise */}
        {mentor.expertise.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Expertise
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {mentor.expertise.map((e) => (
                  <Badge key={e} variant="secondary" className="text-xs">{e}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Experience */}
        {mentor.experiences.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" /> Experience
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mentor.experiences.map((x, i) => (
                <div key={i}>
                  {i > 0 && <Separator className="mb-4" />}
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="font-semibold">{x.title}</p>
                      <p className="text-sm text-muted-foreground">{x.company}</p>
                      {x.description && (
                        <p className="text-sm mt-2 whitespace-pre-line text-foreground/80">{x.description}</p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatMonth(x.start_date)} – {formatMonth(x.end_date)}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Qualifications */}
        {mentor.qualifications.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary" /> Qualifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mentor.qualifications.map((q, i) => (
                <div key={i}>
                  {i > 0 && <Separator className="mb-4" />}
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="font-semibold">{q.institution}</p>
                      <p className="text-sm text-muted-foreground">
                        {[q.degree, q.field].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {q.start_year} – {q.end_year || "Present"}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="text-center text-xs text-muted-foreground py-4">
          Powered by {branding.app_name}
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
};

export default PublicMentorProfile;
