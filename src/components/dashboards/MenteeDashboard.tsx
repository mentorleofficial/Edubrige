
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMenteeProfileStatus } from "@/features/mentee-onboarding/hooks/useMenteeProfileStatus";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Star } from "lucide-react";
import { useMyPrograms } from "@/features/programs/hooks/useMyPrograms";
import { useMenteeDashboardData } from "@/features/mentee-dashboard/useMenteeDashboardData";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import NextSessionCard from "./mentee/NextSessionCard";
import StatsRow from "./mentee/StatsRow";
import SessionsCalendar from "./mentee/SessionsCalendar";
import InsightsPanel from "./mentee/InsightsPanel";
import RecommendedMentors from "./mentee/RecommendedMentors";
import RecentActivity from "./mentee/RecentActivity";

const MenteeDashboard = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { isComplete, loading: onbLoading } = useMenteeProfileStatus(user?.id);
  const { data, isLoading } = useMenteeDashboardData(user?.id);
  const { data: programs = [] } = useMyPrograms();

  const [dismissedSessionId, setDismissedSessionId] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const pendingRatingSession = useMemo(() => {
    if (!data?.sessions || !data?.feedback) return null;
    const completed = data.sessions.filter((s) => s.status === "completed");
    const ratedSessionIds = new Set(data.feedback.map((f) => f.session_id));
    return completed.find((s) => !ratedSessionIds.has(s.id)) ?? null;
  }, [data?.sessions, data?.feedback]);

  const showFeedbackModal = !!pendingRatingSession && pendingRatingSession.id !== dismissedSessionId;

  const handleSubmitFeedback = async () => {
    if (!pendingRatingSession || rating === 0 || !user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("feedback").insert([
        {
          session_id: pendingRatingSession.id,
          submitted_by: user.id,
          rating,
          comment: comment.trim() || null,
          audience: "mentor",
        },
      ]);
      if (error) throw error;

      toast({
        title: "Feedback submitted",
        description: "Thank you for rating your session!",
      });

      setRating(0);
      setComment("");
      setDismissedSessionId(pendingRatingSession.id);
      qc.invalidateQueries({ queryKey: ["mentee-dashboard", user.id] });
      qc.invalidateQueries({ queryKey: ["mentee", "sessions", user.id] });
      qc.invalidateQueries({ queryKey: ["mentee", "rated-sessions", user.id] });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error submitting feedback",
        description: (e as Error).message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!onbLoading && !isComplete) {
    return (
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>Finish setting up your profile</CardTitle>
          </div>
          <CardDescription>
            We need a few details before mentors can match with you. It only takes 2 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="lg" onClick={() => navigate("/onboarding/mentee")}>
            Complete my profile
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const computed = (() => {
    const sessions = data.sessions;
    const now = Date.now();
    const upcoming = sessions.filter(
      (s) => s.status === "booked" && new Date(s.scheduled_at).getTime() >= now
    );
    const completed = sessions.filter((s) => s.status === "completed");
    const hours = completed.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / 60;
    const ratings = data.feedback.map((f) => f.rating);
    const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
    const next = upcoming.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0] ?? null;
    return { upcomingCount: upcoming.length, completedCount: completed.length, hours, avg, next };
  })();

  const firstName = profile?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-serif)" }}>
          Welcome back, {firstName}!
        </h2>
        <p className="text-sm text-muted-foreground">
          Here's your learning journey overview
        </p>
      </div>

      <NextSessionCard session={computed.next} />

      <StatsRow
        upcoming={computed.upcomingCount}
        completed={computed.completedCount}
        hours={computed.hours}
        avgRating={computed.avg}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SessionsCalendar sessions={data.sessions} />
        </div>
        <InsightsPanel
          sessions={data.sessions}
          feedback={data.feedback}
          programsCount={programs.length}
        />
      </div>

      <RecommendedMentors mentors={data.recommended} />

      <RecentActivity sessions={data.sessions} feedback={data.feedback} />

      <Dialog 
        open={showFeedbackModal} 
        onOpenChange={(open) => {
          if (!open && pendingRatingSession) {
            setDismissedSessionId(pendingRatingSession.id);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>How was your session?</DialogTitle>
            <DialogDescription>
              Please rate your session with{" "}
              <strong>{pendingRatingSession?.mentor?.full_name || "your mentor"}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Rating</Label>
              <div className="flex gap-1.5 justify-center py-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className="transition-transform hover:scale-110 focus:outline-none"
                  >
                    <Star
                      className={`h-8 w-8 ${
                        star <= (hoverRating || rating)
                          ? "fill-yellow-500 text-yellow-500"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedback-comment">Comments (optional)</Label>
              <Textarea
                id="feedback-comment"
                placeholder="Share your experience (what went well, topics discussed...)"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t pt-4 mt-2">
            <Button
              variant="ghost"
              onClick={() => {
                if (pendingRatingSession) {
                  setDismissedSessionId(pendingRatingSession.id);
                }
              }}
              disabled={submitting}
            >
              Remind me later
            </Button>
            <Button
              onClick={handleSubmitFeedback}
              disabled={rating === 0 || submitting}
            >
              {submitting ? "Submitting…" : "Submit Feedback"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MenteeDashboard;
