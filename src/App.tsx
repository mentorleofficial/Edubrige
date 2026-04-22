import { lazy, Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import RoleGuard from "@/components/RoleGuard";
import ErrorBoundary from "@/components/ErrorBoundary";
import RouteFallback from "@/components/RouteFallback";
import { queryClient } from "@/lib/queryClient";

const Login = lazy(() => import("@/pages/Login"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const AdminUsers = lazy(() => import("@/pages/AdminUsers"));
const AdminSettings = lazy(() => import("@/pages/AdminSettings"));
const AdminAuditLogs = lazy(() => import("@/pages/AdminAuditLogs"));
const AdminApplications = lazy(() => import("@/pages/AdminApplications"));
const MentorLanding = lazy(() => import("@/pages/MentorLanding"));
const MentorDirectory = lazy(() => import("@/pages/MentorDirectory"));
const MentorProfile = lazy(() => import("@/pages/MentorProfile"));
const MentorAvailability = lazy(() => import("@/pages/MentorAvailability"));
const MentorSessions = lazy(() => import("@/pages/MentorSessions"));
const MenteeProfile = lazy(() => import("@/pages/MenteeProfile"));
const MenteeSessions = lazy(() => import("@/pages/MenteeSessions"));
const BookSession = lazy(() => import("@/pages/BookSession"));
const SessionFeedback = lazy(() => import("@/pages/SessionFeedback"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const JwtCallback = lazy(() => import("@/pages/JwtCallback"));
const PublicMentorProfile = lazy(() => import("@/pages/PublicMentorProfile"));

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <BrandingProvider>
            <AuthProvider>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<Navigate to="/login" replace />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/become-a-mentor" element={<MentorLanding />} />
                  <Route path="/mentors/:mentorId" element={<PublicMentorProfile />} />
                  <Route path="/auth/jwt/callback" element={<JwtCallback />} />
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
              </Suspense>
            </AuthProvider>
          </BrandingProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
