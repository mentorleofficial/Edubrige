import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Users,
  Settings,
  ClipboardList,
  ClipboardCheck,
  User,
  Calendar,
  BookOpen,
  LogOut,
  GraduationCap,
  FolderKanban,
  UsersRound,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const AppSidebar = () => {
  const { profile, signOut, mentorActive } = useAuth();
  const branding = useBranding();
  const navigate = useNavigate();
  const location = useLocation();
  const role = profile?.role;
  const [pendingApps, setPendingApps] = useState(0);

  useEffect(() => {
    if (role !== "admin") return;
    supabase
      .from("mentor_applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .then(({ count }) => setPendingApps(count || 0));
  }, [role, location.pathname]);

  const adminItems = [
    { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { title: "Users", icon: Users, path: "/admin/users" },
    { title: "Applications", icon: ClipboardCheck, path: "/admin/applications", badge: pendingApps },
    { title: "Programs", icon: FolderKanban, path: "/admin/programs" },
    { title: "Settings", icon: Settings, path: "/admin/settings" },
    { title: "Audit Logs", icon: ClipboardList, path: "/admin/audit-logs" },
  ];

  const mentorItemsActive = [
    { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { title: "My Profile", icon: User, path: "/mentor/profile" },
    { title: "Availability", icon: Calendar, path: "/mentor/availability" },
    { title: "Programs", icon: FolderKanban, path: "/mentor/programs" },
    { title: "My Mentees", icon: UsersRound, path: "/mentor/mentees" },
    { title: "Sessions", icon: BookOpen, path: "/mentor/sessions" },
  ];
  const mentorItemsInactive = [
    { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { title: "My Profile", icon: User, path: "/mentor/profile" },
  ];

  const menteeItems = [
    { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { title: "My Profile", icon: User, path: "/mentee/profile" },
    { title: "Programs", icon: FolderKanban, path: "/mentee/programs" },
    { title: "Find Mentors", icon: GraduationCap, path: "/mentors" },
    { title: "My Sessions", icon: BookOpen, path: "/mentee/sessions" },
  ];

  const items =
    role === "admin"
      ? adminItems
      : role === "mentor"
      ? (mentorActive ? mentorItemsActive : mentorItemsInactive)
      : menteeItems;
  const initials = profile?.full_name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "?";

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          {branding.logo_url ? (
            <img src={branding.logo_url} alt={branding.app_name} className="h-8 w-8 rounded" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">
              M
            </div>
          )}
          <span className="font-semibold text-sidebar-foreground text-sm">{branding.app_name}</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item: any) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={location.pathname === item.path}
                    onClick={() => navigate(item.path)}
                    className="gap-3"
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="flex-1">{item.title}</span>
                    {item.badge ? (
                      <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-xs">{item.badge}</Badge>
                    ) : null}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="text-xs bg-sidebar-accent text-sidebar-accent-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{profile?.full_name}</p>
            <p className="text-xs text-sidebar-foreground/60 capitalize">
              {profile?.role}{role === "mentor" && !mentorActive ? " · inactive" : ""}
            </p>
          </div>
          <button
            onClick={() => signOut().then(() => navigate("/login"))}
            className="text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
