import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Github, Globe } from "lucide-react";
import { useMenteeDetailsForMentor } from "../useMentorMentees";

interface MenteeDetailsDialogProps {
  menteeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MenteeDetailsDialog = ({ menteeId, open, onOpenChange }: MenteeDetailsDialogProps) => {
  const { data: profile, isLoading, error } = useMenteeDetailsForMentor(menteeId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md md:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mentee Details</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error || !profile ? (
          <div className="py-6 text-center text-destructive text-sm">
            Failed to load mentee profile details.
          </div>
        ) : (
          <div className="space-y-6 pt-4 text-sm">
            {/* Header Profile Summary */}
            <div className="flex items-center gap-4 pb-4 border-b">
              <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center text-xl font-bold uppercase overflow-hidden text-slate-700">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.full_name} className="h-full w-full object-cover" />
                ) : (
                  profile.full_name.split(" ").map((s) => s.charAt(0)).slice(0, 2).join("")
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold">{profile.full_name}</h3>
                {profile.headline ? (
                  <p className="text-sm text-muted-foreground mt-0.5">{profile.headline}</p>
                ) : (
                  <p className="text-sm text-muted-foreground mt-0.5 italic">Mentee</p>
                )}
              </div>
            </div>

            {/* Profile Fields */}
            <div className="space-y-4">
              {profile.bio && (
                <div>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground block mb-0.5">About</span>
                  <p className="whitespace-pre-wrap text-slate-800 dark:text-slate-200">{profile.bio}</p>
                </div>
              )}

              {profile.organization_unit && (
                <div>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground block mb-0.5">Team / Department</span>
                  <span className="text-slate-800 dark:text-slate-200">{profile.organization_unit}</span>
                </div>
              )}

              {profile.academic_details && (
                <div>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground block mb-0.5">Academic Details</span>
                  <span className="text-slate-800 dark:text-slate-200">{profile.academic_details}</span>
                </div>
              )}

              {profile.goals && (
                <div>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground block mb-0.5">Goals</span>
                  <p className="whitespace-pre-wrap text-slate-800 dark:text-slate-200">{profile.goals}</p>
                </div>
              )}

              {profile.interests && profile.interests.length > 0 && (
                <div>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground block mb-1.5">Interests</span>
                  <div className="flex flex-wrap gap-1">
                    {profile.interests.map((interest: string) => (
                      <Badge key={interest} variant="secondary">{interest}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {profile.preferred_mentor_areas && profile.preferred_mentor_areas.length > 0 && (
                <div>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground block mb-1.5">Preferred Mentor Areas</span>
                  <div className="flex flex-wrap gap-1">
                    {profile.preferred_mentor_areas.map((area: string) => (
                      <Badge key={area} variant="outline">{area}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Social / Link buttons */}
              {(profile.github_url || profile.portfolio_url) && (
                <div className="pt-2 flex flex-wrap gap-2">
                  {profile.github_url && (
                    <a
                      href={profile.github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                    >
                      <Github className="h-3.5 w-3.5" />
                      GitHub Profile
                    </a>
                  )}
                  {profile.portfolio_url && (
                    <a
                      href={profile.portfolio_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      Portfolio Website
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
