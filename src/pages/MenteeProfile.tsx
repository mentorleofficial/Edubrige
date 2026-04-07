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

const MenteeProfile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [goals, setGoals] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [newInterest, setNewInterest] = useState("");
  const [orgUnit, setOrgUnit] = useState("");
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("mentee_profiles").select("*").eq("user_id", user.id).single().then(({ data }) => {
      if (data) {
        setProfileId(data.id);
        setGoals(data.goals || "");
        setInterests(data.interests || []);
        setOrgUnit(data.organization_unit || "");
      }
    });
  }, [user]);

  const handleSave = async () => {
    if (!profileId) return;
    const { error } = await supabase.from("mentee_profiles").update({
      goals, interests, organization_unit: orgUnit,
    }).eq("id", profileId);
    if (error) toast({ variant: "destructive", title: "Error", description: error.message });
    else toast({ title: "Profile saved" });
  };

  const addInterest = () => {
    if (newInterest.trim() && !interests.includes(newInterest.trim())) {
      setInterests([...interests, newInterest.trim()]);
      setNewInterest("");
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-3xl font-bold">My Profile</h1>
        <Card>
          <CardHeader>
            <CardTitle>Mentee Profile</CardTitle>
            <CardDescription>Tell mentors about your goals and interests.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Goals</Label>
              <Textarea rows={3} value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="What do you want to achieve?" />
            </div>
            <div className="space-y-2">
              <Label>Interests</Label>
              <div className="flex gap-2">
                <Input value={newInterest} onChange={(e) => setNewInterest(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInterest())}
                  placeholder="Add an interest…" />
                <Button type="button" variant="outline" onClick={addInterest}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {interests.map((i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    {i}
                    <button onClick={() => setInterests(interests.filter((x) => x !== i))}><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Organization Unit</Label>
              <Input value={orgUnit} onChange={(e) => setOrgUnit(e.target.value)} />
            </div>
            <Button onClick={handleSave}>Save Profile</Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default MenteeProfile;
