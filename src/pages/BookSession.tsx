import { useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import BookingModal from "@/components/sessions/BookingModal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, ArrowLeft, Clock, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { markdownToHtml } from "@/components/ui/markdown-editor";
import { useBookSessionStatic } from "@/features/mentee-booking/useBookSessionData";

const stripMarkdown = (md: string) =>
  markdownToHtml(md || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const BookSession = () => {
  const { mentorId } = useParams<{ mentorId: string }>();
  const [params] = useSearchParams();
  const preselectedOfferingId = params.get("offering") ?? undefined;
  const navigate = useNavigate();

  const { data: staticData, isPending } = useBookSessionStatic(mentorId);
  const mentor = staticData?.mentor ?? null;
  const mentorProfile = staticData?.mentorProfile ?? null;
  const offerings = staticData?.offerings ?? [];

  const [selectedOfferingId, setSelectedOfferingId] = useState<string | undefined>(
    preselectedOfferingId
  );
  const [modalOpen, setModalOpen] = useState(!!preselectedOfferingId);

  const mentorInitials =
    mentor?.full_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "M";

  const timezone = mentorProfile?.timezone
    ? mentorProfile.timezone.replace("Asia/Kolkata", "IST")
    : "IST";

  if (!mentorId) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Back */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {/* Hero card */}
        {isPending ? (
          <Skeleton className="h-40 rounded-2xl" />
        ) : mentor ? (
          <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border border-white/15 shadow-lg shadow-black/20">
                    <AvatarImage src={mentor.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-white/10 text-white font-bold text-lg">
                      {mentorInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-white/60">
                      Booking session
                    </p>
                    <h1 className="mt-1 text-2xl sm:text-3xl font-bold">
                      Book with {mentor.full_name}
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm text-white/70">
                      Pick an offering, then choose a date and time that works for both of us.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm backdrop-blur-sm sm:min-w-[280px]">
                  <div>
                    <p className="text-white/50 text-[11px] uppercase tracking-wide">Timezone</p>
                    <p className="mt-1 font-medium">{timezone}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-[11px] uppercase tracking-wide">Notice</p>
                    <p className="mt-1 font-medium">
                      {mentorProfile?.minimum_notice_hours ?? 0}h
                    </p>
                  </div>
                  <div>
                    <p className="text-white/50 text-[11px] uppercase tracking-wide">Buffer</p>
                    <p className="mt-1 font-medium">
                      {mentorProfile?.buffer_time_minutes ?? 0} min
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Timezone note */}
        {!isPending && mentor && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Globe className="h-3 w-3" />
            All times shown in{" "}
            <span className="font-medium">India Standard Time (IST)</span>
          </p>
        )}

        {/* Mentor profile card */}
        {isPending ? (
          <Skeleton className="h-32 rounded-2xl" />
        ) : mentor ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Mentor profile</CardTitle>
              <CardDescription>Quick context before selecting a session type.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-[auto_minmax(0,1fr)] md:items-start">
              <Avatar className="h-20 w-20">
                <AvatarImage
                  src={mentor.avatar_url ?? undefined}
                  alt={mentor.full_name ?? "Mentor"}
                />
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
                  {mentorInitials}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-3">
                <div>
                  <h2 className="text-2xl font-bold">{mentor.full_name}</h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="secondary">{timezone}</Badge>
                    <Badge variant="secondary">
                      {mentorProfile?.minimum_notice_hours ?? 0}h notice
                    </Badge>
                    <Badge variant="secondary">
                      {mentorProfile?.buffer_time_minutes ?? 0} min buffer
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Offerings */}
        <div className="space-y-3">
          <div>
            <h2 className="text-xl font-bold">Choose an offering</h2>
            <p className="text-sm text-muted-foreground">
              Select a session type to book with this mentor.
            </p>
          </div>

          {isPending ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40 rounded-2xl" />
              ))}
            </div>
          ) : offerings.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                This mentor has no active offerings right now.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {offerings.map((offering) => (
                <div
                  key={offering.id}
                  className={cn(
                    "text-left rounded-2xl border bg-card overflow-hidden",
                    "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                  )}
                >
                  <div className="h-1 bg-gradient-to-r from-primary to-primary/40" />
                  <div className="p-5 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold leading-tight">
                          {offering.title}
                        </h3>
                        <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                          {offering.category || "Mentorship"}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {offering.price === 0 ? "Free" : `₹${offering.price}`}
                      </Badge>
                    </div>

                    {offering.description && (
                      <p className="text-sm text-muted-foreground line-clamp-3 min-h-[3.75rem]">
                        {stripMarkdown(offering.description)}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {offering.duration_minutes} min
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-foreground">
                          <Coins className="h-3.5 w-3.5" />
                          {offering.price === 0 ? "Free" : `₹${offering.price}`}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedOfferingId(offering.id);
                          setModalOpen(true);
                        }}
                      >
                        Book
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BookingModal
        mentorId={mentorId}
        offeringId={selectedOfferingId}
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setSelectedOfferingId(undefined);
        }}
      />
    </AppLayout>
  );
};

export default BookSession;
