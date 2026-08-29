import { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useMentorProfile } from "../hooks/useMentorProfile";
import { calculateCompleteness } from "../utils/completeness";
import { ArrowRight, Circle, Sparkles } from "lucide-react";

// The mentor cannot finish the profile while a non-dismissible modal covers
// the very pages they need to edit, so these stay clear.
const EXEMPT_PATHS = ["/mentor/profile", "/mentor/offerings"];

const MentorProfileCompletionModal = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, isApproved } = useAuth();
  const isMentor = profile?.role === "mentor";
  const { data } = useMentorProfile(isMentor ? user?.id : undefined);
  const [open, setOpen] = useState(false);

  const completeness = data ? calculateCompleteness(data) : null;
  const percentage = completeness?.percentage ?? 100;
  const missingItems = completeness?.missingItems ?? [];

  const exempt = EXEMPT_PATHS.some((p) => location.pathname.startsWith(p));
  const shouldShow = isMentor && isApproved && !!data && percentage < 100 && !exempt;

  useEffect(() => {
    if (!shouldShow) {
      setOpen(false);
      return;
    }

    const timer = setTimeout(() => {
      setOpen(true);
    }, 1200); // 1.2s delay for a smoother page entrance

    return () => clearTimeout(timer);
  }, [shouldShow]);

  const handleGoToProfile = () => {
    setOpen(false);
    navigate("/mentor/profile");
  };

  if (!shouldShow) return null;

  return (
    <Dialog open={open}>
      <DialogContent
        hideClose
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="max-w-md sm:max-w-lg border border-primary/20 bg-background/95 backdrop-blur shadow-2xl p-6 rounded-xl animate-in fade-in duration-300"
      >
        <DialogHeader className="space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-2">
            <Sparkles className="h-6 w-6 text-primary animate-pulse" />
          </div>
          <DialogTitle className="text-2xl font-serif text-center font-bold">
            Unlock Your Booking Features!
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground pt-1">
            Your mentor account has been approved by the admin. To unlock your availability calendar, program modules, bookings, and public visibility, please complete your profile to 100%.
          </DialogDescription>
        </DialogHeader>

        <div className="my-5 space-y-4 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-muted-foreground uppercase tracking-wider">Completeness Score</span>
            <span className="text-primary font-bold text-sm">{percentage}%</span>
          </div>
          <Progress value={percentage} className="h-2 bg-muted-foreground/10" />

          {missingItems.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Remaining Requirements ({missingItems.length})
              </span>
              <ul className="grid gap-2 sm:grid-cols-2 text-xs max-h-36 overflow-y-auto pr-1">
                {missingItems.map((item) => (
                  <li key={item.key} className="flex items-center gap-2 text-foreground font-medium">
                    <Circle className="h-3 w-3 text-amber-500 shrink-0" />
                    <span className="truncate flex items-center gap-1">
                      {item.label}
                      {item.key === "has_offerings" && (
                        <Link
                          to="/mentor/offerings"
                          onClick={() => setOpen(false)}
                          className="text-primary hover:underline font-bold"
                        >
                          (Go)
                        </Link>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>


        <DialogFooter className="mt-4">
          <Button
            type="button"
            onClick={handleGoToProfile}
            className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-primary/10 transition-all hover:scale-[1.02]"
          >
            Complete Profile Now
            <ArrowRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MentorProfileCompletionModal;
