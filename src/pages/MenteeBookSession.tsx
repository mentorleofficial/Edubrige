import { useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Clock, Calendar, Tag } from "lucide-react";
import { markdownToHtml } from "@/components/ui/markdown-editor";
import { useBrowseOfferings, type BrowseOffering } from "@/features/mentee-booking/useBrowseOfferings";
import BookingModal from "@/components/sessions/BookingModal";

const stripMarkdown = (md: string) =>
  markdownToHtml(md || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const initials = (name: string | null | undefined) =>
  (name ?? "M")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "M";

export default function MenteeBookSession() {
  const { data: offerings = [], isLoading } = useBrowseOfferings();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [detailOffering, setDetailOffering] = useState<BrowseOffering | null>(null);
  const [bookTarget, setBookTarget] = useState<BrowseOffering | null>(null);

  const categories = useMemo(() => {
    const cats = new Set(offerings.map((o) => o.category).filter(Boolean) as string[]);
    return Array.from(cats).sort();
  }, [offerings]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return offerings.filter((o) => {
      if (activeCategory && o.category !== activeCategory) return false;
      if (q && !o.title.toLowerCase().includes(q) && !o.mentor?.full_name?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [offerings, search, activeCategory]);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-5 space-y-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Book a session</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Browse offerings from all available mentors and book instantly
          </p>
        </div>

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by offering title or mentor name…"
              className="pl-9"
            />
          </div>

          {categories.length > 0 && (
            <Select
              value={activeCategory ?? "all"}
              onValueChange={(val) => setActiveCategory(val === "all" ? null : val)}
            >
              <SelectTrigger className="sm:w-52">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Results count */}
        {!isLoading && (
          <p className="text-xs text-muted-foreground">
            {filtered.length} offering{filtered.length !== 1 ? "s" : ""} found
          </p>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[340px] rounded-3xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Search className="mx-auto h-8 w-8 mb-3 opacity-40" />
            <p className="font-medium">No offerings found</p>
            <p className="text-sm mt-1">Try adjusting the search or filters.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((o) => (
              <div
                key={o.id}
                className="group bg-white border border-gray-200 rounded-[10px] overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-all duration-200"
              >
                {/* Mentor Header - Matching the screenshot */}
                <div className="p-5 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 ring-1 ring-gray-100">
                      <AvatarImage src={o.mentor?.avatar_url ?? undefined} />
                      <AvatarFallback className="text-sm font-medium bg-gray-50">
                        {initials(o.mentor?.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-base leading-none">
                        {o.mentor?.full_name ?? "Mentor"}
                      </p>
                      {o.mentor?.mentor_profiles?.[0]?.current_role && (
                        <p className="text-sm text-gray-500 mt-0.5">
                          {o.mentor.mentor_profiles[0].current_role}
                        </p>
                      )}
                    </div>
                  </div>

                  {o.category && (
                    <Badge
                      variant="secondary"
                      className="mt-4 text-xs px-3 py-1 rounded-full font-medium border border-gray-100 bg-gray-50"
                    >
                      {o.category}
                    </Badge>
                  )}
                </div>

                {/* Main Content */}
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="text-xl font-semibold leading-tight tracking-tight text-gray-900 mb-1">
                    {o.title}
                  </h3>

                  {o.description && (
                    <p className="text-gray-600 text-[15px] line-clamp-2 mt-1 mb-5">
                      {stripMarkdown(o.description)}
                    </p>
                  )}

                  {/* Meta Info */}
                  <div className="flex items-center gap-5 text-sm text-gray-500 mt-auto mb-6">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      <span>{o.duration_minutes} min</span>
                    </div>
                    {o.description && (
                      <div className="px-5 pb-5 pt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-500 hover:text-gray-900 w-full text-xs font-medium h-8"
                          onClick={() => setDetailOffering(o)}
                        >
                          Learn more
                        </Button>
                      </div>
                    )}
                  </div>



                  {/* Footer with Price + Book Button */}
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-1">
                      <span className="text-2xl font-semibold text-gray-900">₹</span>
                      <span className="text-2xl font-semibold text-gray-900">
                        {o.price === 0 ? "Free" : o.price}
                      </span>
                    </div>

                    <Button
                      size="lg"
                      className="px-8 rounded-2xl bg-black hover:bg-black/90 text-white font-medium shadow-sm"
                      onClick={() => setBookTarget(o)}
                    >
                      Book Now
                    </Button>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* Learn more dialog - kept as is */}
      <Dialog open={!!detailOffering} onOpenChange={(open) => !open && setDetailOffering(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailOffering?.title}</DialogTitle>
          </DialogHeader>
          {detailOffering && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={detailOffering.mentor?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs">{initials(detailOffering.mentor?.full_name)}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{detailOffering.mentor?.full_name}</span>
              </div>
              {detailOffering.description && (
                <div
                  className="text-sm text-muted-foreground [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-sm [&_h2]:font-semibold [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 leading-relaxed space-y-2"
                  dangerouslySetInnerHTML={{ __html: markdownToHtml(detailOffering.description) }}
                />
              )}
              <div className="flex gap-6 pt-3 border-t text-sm font-medium">
                <span>{detailOffering.duration_minutes} min</span>
                <span>{detailOffering.price === 0 ? "Free" : `₹${detailOffering.price}`}</span>
              </div>
              <Button
                className="w-full"
                onClick={() => { setDetailOffering(null); setBookTarget(detailOffering); }}
              >
                Book this session
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Booking modal */}
      {bookTarget && (
        <BookingModal
          mentorId={bookTarget.mentor_id}
          offeringId={bookTarget.id}
          open={!!bookTarget}
          onOpenChange={(open) => !open && setBookTarget(null)}
        />
      )}
    </AppLayout>
  );
}