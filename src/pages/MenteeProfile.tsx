import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import AvatarUploader from "@/features/mentor-profile/components/AvatarUploader";
import ChipInput from "@/features/mentee-onboarding/components/ChipInput";
import {
  upsertMenteeProfile,
  uploadMenteeAvatar,
} from "@/features/mentee-onboarding/api";
import {
  useMenteeProfile,
  useInvalidateMenteeProfile,
} from "@/features/mentee-onboarding/hooks/useMenteeProfileStatus";
import {
  Loader2,
  UserCircle,
  Target,
  Link as LinkIcon,
  Github,
  Globe,
  Save,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Moved outside component so they don't remount on each render ───

const SectionCard = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "rounded-xl border border-border/50 bg-card p-6",
      className
    )}
  >
    {children}
  </div>
);

const FieldLabel = ({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) => (
  <Label
    htmlFor={htmlFor}
    className="text-[13px] font-medium text-muted-foreground"
  >
    {children}
  </Label>
);

// ────────────────────────────────────────────────────────────────────

const MenteeProfile = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const invalidate = useInvalidateMenteeProfile();
  const { data, isLoading } = useMenteeProfile(user?.id);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [orgUnit, setOrgUnit] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [goals, setGoals] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [academicDetails, setAcademicDetails] = useState("");
  const [github, setGithub] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [originalData, setOriginalData] = useState<any>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!data || hydrated) return;
    const initial = {
      fullName: data.full_name || "",
      avatarUrl: data.avatar_url,
      headline: data.headline || "",
      bio: data.bio || "",
      orgUnit: data.organization_unit || "",
      linkedin: data.linkedin_url || "",
      goals: data.goals || "",
      interests: data.interests || [],
      areas: data.preferred_mentor_areas || [],
      academicDetails: data.academic_details ?? "",
      github: data.github_url ?? "",
      portfolio: data.portfolio_url ?? "",
    };
    setFullName(initial.fullName);
    setAvatarUrl(initial.avatarUrl);
    setHeadline(initial.headline);
    setBio(initial.bio);
    setOrgUnit(initial.orgUnit);
    setLinkedin(initial.linkedin);
    setGoals(initial.goals);
    setInterests(initial.interests);
    setAreas(initial.areas);
    setAcademicDetails(initial.academicDetails);
    setGithub(initial.github);
    setPortfolio(initial.portfolio);
    setOriginalData(initial);
    setHydrated(true);
  }, [data, hydrated]);

  const hasChanges = useMemo(() => {
    if (!originalData) return false;
    return (
      fullName !== originalData.fullName ||
      headline !== originalData.headline ||
      bio !== originalData.bio ||
      orgUnit !== originalData.orgUnit ||
      linkedin !== originalData.linkedin ||
      goals !== originalData.goals ||
      academicDetails !== originalData.academicDetails ||
      github !== originalData.github ||
      portfolio !== originalData.portfolio ||
      JSON.stringify(interests) !== JSON.stringify(originalData.interests) ||
      JSON.stringify(areas) !== JSON.stringify(originalData.areas)
    );
  }, [originalData, fullName, headline, bio, orgUnit, linkedin, goals, interests, areas, academicDetails, github, portfolio]);

  const completeness = useMemo(() => {
    const fields = [
      fullName,
      headline,
      bio,
      orgUnit,
      goals,
      academicDetails,
      linkedin,
      interests.length > 0 ? "x" : "",
      areas.length > 0 ? "x" : "",
    ];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }, [fullName, headline, bio, orgUnit, goals, academicDetails, linkedin, interests, areas]);

  const loading = isLoading && !hydrated;

  const initials = (fullName || profile?.email || "U")
    .split(" ")
    .map((s) => s.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const addProtocol = (url: string) => {
    if (!url) return "";
    let clean = url.trim().replace(/\/+$/, "");
    if (clean && !/^https?:\/\//i.test(clean)) clean = `https://${clean}`;
    return clean;
  };

  const handleAvatar = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const url = await uploadMenteeAvatar(user.id, file);
      await upsertMenteeProfile(user.id, { avatar_url: url });
      setAvatarUrl(url);
      await refreshProfile();
      toast({ title: "Profile photo updated" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Upload failed", description: e?.message });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !hasChanges) return;
    const cleanLinkedin = addProtocol(linkedin);
    const cleanGithub = addProtocol(github);
    const cleanPortfolio = addProtocol(portfolio);

    if (cleanLinkedin && !/linkedin\.com\/(in|pub)\//i.test(cleanLinkedin)) {
      toast({ variant: "destructive", title: "Invalid LinkedIn", description: "Must be a linkedin.com/in/… URL" });
      return;
    }
    if (cleanGithub && !/github\.com\//i.test(cleanGithub)) {
      toast({ variant: "destructive", title: "Invalid GitHub", description: "Must be a github.com/… URL" });
      return;
    }
    if (cleanPortfolio) {
      try { new URL(cleanPortfolio); } catch {
        toast({ variant: "destructive", title: "Invalid URL", description: "Portfolio must be a valid URL" });
        return;
      }
    }

    setSaving(true);
    try {
      await upsertMenteeProfile(user.id, {
        full_name: fullName.trim(),
        headline: headline.trim(),
        bio: bio.trim(),
        organization_unit: orgUnit.trim(),
        linkedin_url: cleanLinkedin,
        goals: goals.trim(),
        interests,
        preferred_mentor_areas: areas,
        academic_details: academicDetails.trim(),
        github_url: cleanGithub,
        portfolio_url: cleanPortfolio,
      });
      await refreshProfile();
      invalidate(user.id);
      setOriginalData({
        ...originalData,
        fullName: fullName.trim(),
        headline: headline.trim(),
        bio: bio.trim(),
        orgUnit: orgUnit.trim(),
        linkedin: cleanLinkedin,
        goals: goals.trim(),
        interests,
        areas,
        academicDetails: academicDetails.trim(),
        github: cleanGithub,
        portfolio: cleanPortfolio,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast({ title: "Profile saved" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to save", description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-40">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-5 py-10 space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-medium tracking-tight">My profile</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Keep your profile up to date to get better mentor matches
            </p>
          </div>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="min-w-[148px] gap-2"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">

          {/* Left column */}
          <div className="space-y-6">

            {/* Photo & Basics */}
            <SectionCard>
              <div className="flex items-center gap-2 mb-1">
                <UserCircle className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-[15px] font-medium">Photo & basics</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-6">
                How others see you in the mentor directory
              </p>

              <div className="flex justify-center mb-6">
                <AvatarUploader
                  url={avatarUrl}
                  fallback={initials}
                  uploading={uploading}
                  onSelect={handleAvatar}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="fullName">Full name</FieldLabel>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Alex Rivera"
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="orgUnit">Team / department</FieldLabel>
                  <Input
                    id="orgUnit"
                    value={orgUnit}
                    onChange={(e) => setOrgUnit(e.target.value)}
                    placeholder="Growth Engineering"
                  />
                </div>
              </div>

              <div className="space-y-1.5 mb-4">
                <FieldLabel htmlFor="headline">Headline</FieldLabel>
                <Input
                  id="headline"
                  value={headline}
                  maxLength={160}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Aspiring product engineer passionate about AI tools"
                />
                <p className="text-[11px] text-muted-foreground text-right">
                  {headline.length}/160
                </p>
              </div>

              <div className="space-y-1.5">
                <FieldLabel htmlFor="bio">About me</FieldLabel>
                <Textarea
                  id="bio"
                  rows={4}
                  value={bio}
                  maxLength={600}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Share your background, journey, and what you're looking for…"
                  className="resize-none"
                />
                <p className="text-[11px] text-muted-foreground text-right">
                  {bio.length}/600
                </p>
              </div>

              <Separator className="my-5" />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="linkedin">
                    <span className="flex items-center gap-1.5">
                      <LinkIcon className="h-3.5 w-3.5" /> LinkedIn
                    </span>
                  </FieldLabel>
                  <Input
                    id="linkedin"
                    value={linkedin}
                    onChange={(e) => setLinkedin(e.target.value)}
                    placeholder="linkedin.com/in/…"
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="github">
                    <span className="flex items-center gap-1.5">
                      <Github className="h-3.5 w-3.5" /> GitHub
                    </span>
                  </FieldLabel>
                  <Input
                    id="github"
                    value={github}
                    onChange={(e) => setGithub(e.target.value)}
                    placeholder="github.com/…"
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="portfolio">
                    <span className="flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5" /> Portfolio
                    </span>
                  </FieldLabel>
                  <Input
                    id="portfolio"
                    value={portfolio}
                    onChange={(e) => setPortfolio(e.target.value)}
                    placeholder="yoursite.com"
                  />
                </div>
              </div>
            </SectionCard>

            {/* Goals & Interests */}
            <SectionCard>
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-[15px] font-medium">Goals & interests</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-6">
                Help us match you with the most relevant mentors
              </p>

              <div className="space-y-1.5 mb-4">
                <FieldLabel htmlFor="academic">
                  Academic / professional background
                </FieldLabel>
                <Input
                  id="academic"
                  value={academicDetails}
                  onChange={(e) => setAcademicDetails(e.target.value)}
                  placeholder="BS Computer Science @ Stanford University, Class of 2027"
                />
              </div>

              <div className="space-y-1.5 mb-4">
                <FieldLabel htmlFor="goals">Goals</FieldLabel>
                <Textarea
                  id="goals"
                  rows={4}
                  value={goals}
                  maxLength={800}
                  onChange={(e) => setGoals(e.target.value)}
                  placeholder="What are you hoping to achieve? Career growth, skill development…"
                  className="resize-none"
                />
                <p className="text-[11px] text-muted-foreground text-right">
                  {goals.length}/800
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <FieldLabel>Interests</FieldLabel>
                  <ChipInput
                    value={interests}
                    onChange={setInterests}
                    placeholder="Add interest…"
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Preferred mentor areas</FieldLabel>
                  <ChipInput
                    value={areas}
                    onChange={setAreas}
                    placeholder="Add area…"
                  />
                </div>
              </div>
            </SectionCard>

          </div>

          {/* Sidebar */}
          <div className="lg:sticky lg:top-6 space-y-4 self-start">
            <SectionCard>
              <h2 className="text-[15px] font-medium mb-1">Profile preview</h2>
              <p className="text-xs text-muted-foreground mb-4">
                How mentors will see you
              </p>

              <div className="mb-5">
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>Completeness</span>
                  <span>{completeness}%</span>
                </div>
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-foreground/70 transition-all duration-300"
                    style={{ width: `${completeness}%` }}
                  />
                </div>
              </div>

              <Separator className="mb-5" />

              <div className="flex flex-col items-center text-center">
                <div className="mb-3 scale-90">
                  <AvatarUploader
                    url={avatarUrl}
                    fallback={initials}
                    uploading={uploading}
                    onSelect={handleAvatar}
                  />
                </div>
                <p className="font-medium text-[15px]">{fullName || "Your name"}</p>
                {headline && (
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                    {headline}
                  </p>
                )}
                {orgUnit && (
                  <p className="text-[11px] text-muted-foreground/70 mt-1">{orgUnit}</p>
                )}
              </div>

              {(bio || goals) && (
                <p className="text-xs text-muted-foreground leading-relaxed mt-4 line-clamp-4">
                  {bio || goals}
                </p>
              )}

              {interests.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4 justify-center">
                  {interests.slice(0, 6).map((item, i) => (
                    <span
                      key={i}
                      className="text-[11px] bg-muted px-2.5 py-1 rounded-full text-muted-foreground"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard className="space-y-2.5">
              <p className="text-[13px] font-medium text-muted-foreground mb-1">Tips</p>
              {[
                "Add a headline to stand out to mentors.",
                "Specific goals help mentors know how to support you.",
                "Add at least 3 interests to improve match quality.",
              ].map((tip, i) => (
                <p key={i} className="text-xs text-muted-foreground leading-relaxed flex gap-2">
                  <span className="text-muted-foreground/50 mt-px">•</span>
                  {tip}
                </p>
              ))}
            </SectionCard>
          </div>

        </div>
      </div>
    </AppLayout>
  );
};

export default MenteeProfile;