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
  fetchMenteeProfile,
  upsertMenteeProfile,
  uploadMenteeAvatar,
} from "@/features/mentee-onboarding/api";
import { useInvalidateMenteeProfile } from "@/features/mentee-onboarding/hooks/useMenteeProfileStatus";
import { Loader2 } from "lucide-react";

const MenteeProfile = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const invalidate = useInvalidateMenteeProfile();

  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    if (!user) return;
    fetchMenteeProfile(user.id)
      .then((d) => {
        setFullName(d.full_name);
        setAvatarUrl(d.avatar_url);
        setHeadline(d.headline);
        setBio(d.bio);
        setOrgUnit(d.organization_unit);
        setLinkedin(d.linkedin_url);
        setGoals(d.goals);
        setInterests(d.interests);
        setAreas(d.preferred_mentor_areas);
      })
      .finally(() => setLoading(false));
  }, [user]);

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
    if (linkedin && !/^https?:\/\/(www\.)?linkedin\.com\//i.test(linkedin)) {
      toast({ variant: "destructive", title: "Invalid LinkedIn URL" });
      return;
    }
    setSaving(true);
    try {
      await upsertMenteeProfile(user.id, {
        full_name: fullName,
        headline,
        bio,
        organization_unit: orgUnit,
        linkedin_url: linkedin,
        goals,
        interests,
        preferred_mentor_areas: areas,
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
              <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://www.linkedin.com/in/…" />
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
