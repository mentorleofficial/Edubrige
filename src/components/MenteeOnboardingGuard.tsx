import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMenteeProfileStatus } from "@/features/mentee-onboarding/hooks/useMenteeProfileStatus";

interface Props {
  children: React.ReactNode;
}

/**
 * Redirects mentees to /onboarding/mentee until they finish the
 * "Complete your profile" wizard. Non-mentees pass through.
 */
const MenteeOnboardingGuard = ({ children }: Props) => {
  const { profile, user } = useAuth();
  const { loading, isComplete } = useMenteeProfileStatus(user?.id);

  if (profile?.role !== "mentee") return <>{children}</>;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isComplete) return <Navigate to="/onboarding/mentee" replace />;

  return <>{children}</>;
};

export default MenteeOnboardingGuard;
