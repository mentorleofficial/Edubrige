import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Star } from "lucide-react";

const SessionFeedback = () => {
  const { id: sessionId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!sessionId || !user || rating === 0) return;
    setSubmitting(true);
    const { error } = await supabase.from("feedback").insert({
      session_id: sessionId,
      submitted_by: user.id,
      rating,
      comment: comment || null,
    });
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Thank you!", description: "Your feedback has been submitted." });
      navigate("/mentee/sessions");
    }
    setSubmitting(false);
  };

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Session Feedback</h1>
        <Card>
          <CardHeader>
            <CardTitle>Rate Your Session</CardTitle>
            <CardDescription>Your feedback helps improve the mentorship experience.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Rating</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-8 w-8 ${
                        star <= (hoverRating || rating)
                          ? "fill-accent text-accent"
                          : "text-border"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Comment (optional)</Label>
              <Textarea
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience…"
              />
            </div>
            <Button onClick={handleSubmit} disabled={rating === 0 || submitting} className="w-full">
              {submitting ? "Submitting…" : "Submit Feedback"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default SessionFeedback;
