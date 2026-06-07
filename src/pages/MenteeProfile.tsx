import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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
import { Loader2 } from "lucide-react";

const MenteeProfile = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const invalidate = useInvalidateMenteeProfile();
  const { data, isLoading } = useMenteeProfile(user?.id);

  const [saving, setSaving] = useState(false);
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
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!data || hydrated) return;
    setFullName(data.full_name);
    setAvatarUrl(data.avatar_url);
    setHeadline(data.headline);
    setBio(data.bio);
    setOrgUnit(data.organization_unit);
    setLinkedin(data.linkedin_url);
    setGoals(data.goals);
    setInterests(data.interests);
    setAreas(data.preferred_mentor_areas);
    setAcademicDetails(data.academic_details ?? "");
    setGithub(data.github_url ?? "");
    setPortfolio(data.portfolio_url ?? "");
    setHydrated(true);
  }, [data, hydrated]);

  const loading = isLoading && !hydrated;

  const initials = (fullName || profile?.email || "U")
    .split(" ").map((s) => s.charAt(0)).slice(0, 2).join("").toUpperCase();

  const handleAvatar = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const url = await uploadMenteeAvatar(user.id, file);
      await upsertMenteeProfile(user.id, { avatar_url: url });
      setAvatarUrl(url);
      await refreshProfile();
      toast({ title: "Photo updated" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Upload failed", description: e?.message });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    let cleanLinkedin = linkedin.trim();
    if (cleanLinkedin) {
      cleanLinkedin = cleanLinkedin.replace(/\/+$/, "");
      if (!/^https?:\/\//i.test(cleanLinkedin)) {
        cleanLinkedin = `https://${cleanLinkedin}`;
      }
      if (!/linkedin\.com\/(in|pub)\//i.test(cleanLinkedin)) {
        toast({ variant: "destructive", title: "Invalid LinkedIn URL", description: "Must be a linkedin.com/in/... URL" });
        return;
      }
    }
    setLinkedin(cleanLinkedin);

    let cleanGithub = github.trim();
    if (cleanGithub) {
      cleanGithub = cleanGithub.replace(/\/+$/, "");
      if (!/^https?:\/\//i.test(cleanGithub)) {
        cleanGithub = `https://${cleanGithub}`;
      }
      if (!/github\.com\//i.test(cleanGithub)) {
        toast({ variant: "destructive", title: "Invalid GitHub URL", description: "Must be a github.com/... URL" });
        return;
      }
    }
    setGithub(cleanGithub);

    let cleanPortfolio = portfolio.trim();
    if (cleanPortfolio) {
      cleanPortfolio = cleanPortfolio.replace(/\/+$/, "");
      if (!/^https?:\/\//i.test(cleanPortfolio)) {
        cleanPortfolio = `https://${cleanPortfolio}`;
      }
      try {
        new URL(cleanPortfolio);
      } catch {
        toast({ variant: "destructive", title: "Invalid Portfolio URL", description: "Must be a valid portfolio URL" });
        return;
      }
    }
    setPortfolio(cleanPortfolio);

    setSaving(true);
    try {
      await upsertMenteeProfile(user.id, {
        full_name: fullName,
        headline,
        bio,
        organization_unit: orgUnit,
        linkedin_url: cleanLinkedin,
        goals,
        interests,
        preferred_mentor_areas: areas,
        academic_details: academicDetails,
        github_url: cleanGithub,
        portfolio_url: cleanPortfolio,
      });
      await refreshProfile();
      invalidate(user.id);
      toast({ title: "Profile saved" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not save", description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-3xl font-bold">My Profile</h1>

        <Card>
          <CardHeader>
            <CardTitle>Photo & basics</CardTitle>
            <CardDescription>How mentors see you in the directory.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <AvatarUploader url={avatarUrl} fallback={initials} uploading={uploading} onSelect={handleAvatar} />
            </div>
            <div className="space-y-2">
              <Label>Full name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Headline</Label>
              <Input value={headline} maxLength={160} onChange={(e) => setHeadline(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>About</Label>
              <Textarea rows={4} value={bio} maxLength={600} onChange={(e) => setBio(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Team / department</Label>
              <Input value={orgUnit} onChange={(e) => setOrgUnit(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>LinkedIn URL</Label>
              <Input
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                onBlur={(e) => {
                  let cleanL = e.target.value.trim().replace(/\/+$/, "");
                  if (cleanL && !/^https?:\/\//i.test(cleanL)) {
                    cleanL = `https://${cleanL}`;
                  }
                  setLinkedin(cleanL);
                }}
                placeholder="https://www.linkedin.com/in/…"
              />
            </div>
            <div className="space-y-2">
              <Label>GitHub Profile</Label>
              <Input
                value={github}
                onChange={(e) => setGithub(e.target.value)}
                onBlur={(e) => {
                  let cleanG = e.target.value.trim().replace(/\/+$/, "");
                  if (cleanG && !/^https?:\/\//i.test(cleanG)) {
                    cleanG = `https://${cleanG}`;
                  }
                  setGithub(cleanG);
                }}
                placeholder="https://github.com/…"
              />
            </div>
            <div className="space-y-2">
              <Label>Portfolio URL</Label>
              <Input
                value={portfolio}
                onChange={(e) => setPortfolio(e.target.value)}
                onBlur={(e) => {
                  let cleanP = e.target.value.trim().replace(/\/+$/, "");
                  if (cleanP && !/^https?:\/\//i.test(cleanP)) {
                    cleanP = `https://${cleanP}`;
                  }
                  setPortfolio(cleanP);
                }}
                placeholder="https://…"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Goals & interests</CardTitle>
            <CardDescription>Help us match you with the right mentors.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Goals</Label>
              <Textarea rows={4} value={goals} maxLength={800} onChange={(e) => setGoals(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Academic Details</Label>
              <Input
                value={academicDetails}
                onChange={(e) => setAcademicDetails(e.target.value)}
                placeholder="e.g. BS Computer Science @ Stanford University, Class of 2027"
              />
            </div>
            <div className="space-y-2">
              <Label>Interests</Label>
              <ChipInput value={interests} onChange={setInterests} placeholder="Add an interest…" />
            </div>
            <div className="space-y-2">
              <Label>Preferred mentor areas</Label>
              <ChipInput value={areas} onChange={setAreas} placeholder="Add an area…" />
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={saving} className="min-w-[140px]">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
        </Button>
      </div>
    </AppLayout>
  );
};

export default MenteeProfile;
