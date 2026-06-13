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
import { Search, Clock, Coins, Tag } from "lucide-react";
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
      <div className="max-w-6xl mx-auto px-5 py-10 space-y-8">
        <div>
          <h1 className="text-[22px] font-medium tracking-tight">Book a session</h1>
          <p className="text-sm text-muted-foreground mt-1">
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
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-52 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Search className="mx-auto h-8 w-8 mb-3 opacity-40" />
            <p className="font-medium">No offerings found</p>
            <p className="text-sm mt-1">Try adjusting the search or filters.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((o) => (
              <div
                key={o.id}
                className="rounded-2xl border bg-card overflow-hidden flex flex-col hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200"
              >
                <div className="h-1 bg-gradient-to-r from-primary to-primary/40" />
                <div className="p-5 flex flex-col flex-1 gap-3">
                  {/* Mentor row */}
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={o.mentor?.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs">{initials(o.mentor?.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{o.mentor?.full_name ?? "Mentor"}</p>
                    </div>
                  </div>

                  {/* Offering info */}
                  <div>
                    <h3 className="font-semibold text-sm leading-tight">{o.title}</h3>
                    {o.category && (
                      <Badge variant="secondary" className="mt-1 text-[10px] rounded-full">
                        <Tag className="h-2.5 w-2.5 mr-1" />{o.category}
                      </Badge>
                    )}
                  </div>

                  {o.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 flex-1">
                      {stripMarkdown(o.description)}
                    </p>
                  )}

                  {/* Price / duration */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {o.duration_minutes} min
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-foreground">
                      <Coins className="h-3.5 w-3.5" />
                      {o.price === 0 ? "Free" : `₹${o.price}`}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    {o.description && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => setDetailOffering(o)}
                      >
                        Learn more
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => setBookTarget(o)}
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

      {/* Learn more dialog */}
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
