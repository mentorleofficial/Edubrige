import AppLayout from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BrandingSettings from "@/components/admin/BrandingSettings";
import JwtSettings from "@/components/admin/JwtSettings";
import PrivacySettings from "@/components/admin/PrivacySettings";

const AdminSettings = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-3xl">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Customize your platform's appearance, authentication and privacy.</p>
        </div>
        <Tabs defaultValue="branding">
          <TabsList>
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="jwt">SSO / JWT</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
          </TabsList>
          <TabsContent value="branding" className="mt-6">
            <BrandingSettings />
          </TabsContent>
          <TabsContent value="jwt" className="mt-6">
            <JwtSettings />
          </TabsContent>
          <TabsContent value="privacy" className="mt-6">
            <PrivacySettings />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default AdminSettings;
