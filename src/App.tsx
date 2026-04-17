import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import RoleGuard from "@/components/RoleGuard";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import AdminUsers from "@/pages/AdminUsers";
import AdminSettings from "@/pages/AdminSettings";
import AdminAuditLogs from "@/pages/AdminAuditLogs";
import AdminApplications from "@/pages/AdminApplications";
import MentorLanding from "@/pages/MentorLanding";
import MentorDirectory from "@/pages/MentorDirectory";
import MentorProfile from "@/pages/MentorProfile";
import MentorAvailability from "@/pages/MentorAvailability";
import MentorSessions from "@/pages/MentorSessions";
import MenteeProfile from "@/pages/MenteeProfile";
import MenteeSessions from "@/pages/MenteeSessions";
import BookSession from "@/pages/BookSession";
import SessionFeedback from "@/pages/SessionFeedback";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <BrandingProvider>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/become-a-mentor" element={<MentorLanding />} />
              <Route path="/admin/applications" element={<RoleGuard allowedRoles={["admin"]}><AdminApplications /></RoleGuard>} />
              <Route path="/dashboard" element={<RoleGuard allowedRoles={["admin", "mentor", "mentee"]}><Dashboard /></RoleGuard>} />
              <Route path="/admin/users" element={<RoleGuard allowedRoles={["admin"]}><AdminUsers /></RoleGuard>} />
              <Route path="/admin/settings" element={<RoleGuard allowedRoles={["admin"]}><AdminSettings /></RoleGuard>} />
              <Route path="/admin/audit-logs" element={<RoleGuard allowedRoles={["admin"]}><AdminAuditLogs /></RoleGuard>} />
              <Route path="/mentors" element={<RoleGuard allowedRoles={["mentee", "admin"]}><MentorDirectory /></RoleGuard>} />
              <Route path="/mentor/profile" element={<RoleGuard allowedRoles={["mentor"]}><MentorProfile /></RoleGuard>} />
              <Route path="/mentor/availability" element={<RoleGuard allowedRoles={["mentor"]} requireActiveMentor><MentorAvailability /></RoleGuard>} />
              <Route path="/mentor/sessions" element={<RoleGuard allowedRoles={["mentor"]} requireActiveMentor><MentorSessions /></RoleGuard>} />
              <Route path="/mentee/profile" element={<RoleGuard allowedRoles={["mentee"]}><MenteeProfile /></RoleGuard>} />
              <Route path="/mentee/sessions" element={<RoleGuard allowedRoles={["mentee"]}><MenteeSessions /></RoleGuard>} />
              <Route path="/book/:mentorId" element={<RoleGuard allowedRoles={["mentee"]}><BookSession /></RoleGuard>} />
              <Route path="/session/:id/feedback" element={<RoleGuard allowedRoles={["mentee"]}><SessionFeedback /></RoleGuard>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrandingProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
