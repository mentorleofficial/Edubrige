import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const AdminSettings = () => {
  const { toast } = useToast();

  // Branding state
  const [appName, setAppName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [secondaryColor, setSecondaryColor] = useState("");
  const [accentColor, setAccentColor] = useState("");
  const [brandingId, setBrandingId] = useState<string | null>(null);

  // JWT state
  const [jwtIssuer, setJwtIssuer] = useState("");
  const [jwtAudience, setJwtAudience] = useState("");
  const [jwtPublicKey, setJwtPublicKey] = useState("");
  const [jwtAlgorithm, setJwtAlgorithm] = useState("RS256");
  const [jwtEnabled, setJwtEnabled] = useState(false);
  const [jwtId, setJwtId] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data: b } = await supabase.from("branding").select("*").limit(1).single();
      if (b) {
        setBrandingId(b.id);
        setAppName(b.app_name);
        setPrimaryColor(b.primary_color);
        setSecondaryColor(b.secondary_color);
        setAccentColor(b.accent_color);
      }
      const { data: j } = await supabase.from("jwt_config").select("*").limit(1).single();
      if (j) {
        setJwtId(j.id);
        setJwtIssuer(j.issuer);
        setJwtAudience(j.audience);
        setJwtPublicKey(j.public_key);
        setJwtAlgorithm(j.algorithm);
        setJwtEnabled(j.enabled);
      }
    };
    fetch();
  }, []);

  const saveBranding = async () => {
    if (!brandingId) return;
    const { error } = await supabase.from("branding").update({
      app_name: appName,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      accent_color: accentColor,
    }).eq("id", brandingId);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Saved", description: "Branding updated successfully." });
      // Apply live
      const root = document.documentElement;
      root.style.setProperty("--primary", primaryColor);
      root.style.setProperty("--secondary", secondaryColor);
      root.style.setProperty("--accent", accentColor);
    }
  };

  const saveJwt = async () => {
    if (!jwtId) return;
    const { error } = await supabase.from("jwt_config").update({
      issuer: jwtIssuer,
      audience: jwtAudience,
      public_key: jwtPublicKey,
      algorithm: jwtAlgorithm,
      enabled: jwtEnabled,
    }).eq("id", jwtId);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Saved", description: "JWT config updated." });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <Tabs defaultValue="branding" className="max-w-2xl">
          <TabsList>
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="jwt">EduBridge JWT</TabsTrigger>
          </TabsList>

          <TabsContent value="branding" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Platform Branding</CardTitle>
                <CardDescription>Customize the look and feel of your platform.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>App Name</Label>
                  <Input value={appName} onChange={(e) => setAppName(e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Primary Color (HSL)</Label>
                    <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="199 89% 32%" />
                  </div>
                  <div className="space-y-2">
                    <Label>Secondary Color (HSL)</Label>
                    <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Accent Color (HSL)</Label>
                    <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
                  </div>
                </div>
                <Button onClick={saveBranding}>Save Branding</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jwt" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>EduBridge JWT Configuration</CardTitle>
                <CardDescription>Configure JWT validation for EduBridge SSO.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Switch checked={jwtEnabled} onCheckedChange={setJwtEnabled} />
                  <Label>Enable EduBridge SSO</Label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Issuer</Label>
                    <Input value={jwtIssuer} onChange={(e) => setJwtIssuer(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Audience</Label>
                    <Input value={jwtAudience} onChange={(e) => setJwtAudience(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Algorithm</Label>
                  <Input value={jwtAlgorithm} onChange={(e) => setJwtAlgorithm(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Public Key (PEM)</Label>
                  <Textarea rows={6} value={jwtPublicKey} onChange={(e) => setJwtPublicKey(e.target.value)} className="font-mono text-xs" />
                </div>
                <Button onClick={saveJwt}>Save JWT Config</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default AdminSettings;
