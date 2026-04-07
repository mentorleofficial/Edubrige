import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";

const MentorProfile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [bio, setBio] = useState("");
  const [expertise, setExpertise] = useState<string[]>([]);
  const [newExpertise, setNewExpertise] = useState("");
  const [yearsExp, setYearsExp] = useState(0);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("mentor_profiles").select("*").eq("user_id", user.id).single().then(({ data }) => {
      if (data) {
        setProfileId(data.id);
        setBio(data.bio || "");
        setExpertise(data.expertise || []);
        setYearsExp(data.years_experience || 0);
        setLinkedinUrl(data.linkedin_url || "");
      }
    });
  }, [user]);

  const handleSave = async () => {
    if (!profileId) return;
    const { error } = await supabase.from("mentor_profiles").update({
      bio, expertise, years_experience: yearsExp, linkedin_url: linkedinUrl,
    }).eq("id", profileId);
    if (error) toast({ variant: "destructive", title: "Error", description: error.message });
    else toast({ title: "Profile saved" });
  };

  const addExpertise = () => {
    if (newExpertise.trim() && !expertise.includes(newExpertise.trim())) {
      setExpertise([...expertise, newExpertise.trim()]);
      setNewExpertise("");
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-3xl font-bold">My Profile</h1>
        <Card>
          <CardHeader>
            <CardTitle>Mentor Profile</CardTitle>
            <CardDescription>This information is visible to mentees.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Bio</Label>
              <Textarea rows={4} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell mentees about yourself…" />
            </div>
            <div className="space-y-2">
              <Label>Expertise</Label>
              <div className="flex gap-2">
                <Input value={newExpertise} onChange={(e) => setNewExpertise(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addExpertise())}
                  placeholder="Add a skill…" />
                <Button type="button" variant="outline" onClick={addExpertise}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {expertise.map((e) => (
                  <Badge key={e} variant="secondary" className="gap-1">
                    {e}
                    <button onClick={() => setExpertise(expertise.filter((x) => x !== e))}><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Years of Experience</Label>
                <Input type="number" value={yearsExp} onChange={(e) => setYearsExp(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>LinkedIn URL</Label>
                <Input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/…" />
              </div>
            </div>
            <Button onClick={handleSave}>Save Profile</Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default MentorProfile;
