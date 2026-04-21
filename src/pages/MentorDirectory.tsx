import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Calendar } from "lucide-react";
import { useMentors } from "@/features/mentors";

const MentorDirectory = () => {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { data: mentors = [], isLoading } = useMentors();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return mentors.filter(
      (m) =>
        m.full_name.toLowerCase().includes(q) ||
        m.mentor_profiles?.[0]?.expertise?.some((e) => e.toLowerCase().includes(q))
    );
  }, [mentors, search]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Find a Mentor</h1>
          <p className="text-muted-foreground mt-1">Browse available mentors and book a session.</p>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name or expertise…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((m) => {
              const profile = m.mentor_profiles?.[0];
              const initials = m.full_name.split(" ").map((n) => n[0]).join("").toUpperCase();
              return (
                <Card key={m.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="flex flex-row items-start gap-4 pb-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg">{m.full_name}</CardTitle>
                      {profile?.years_experience ? (
                        <p className="text-sm text-muted-foreground">{profile.years_experience} years experience</p>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {profile?.bio && <p className="text-sm text-muted-foreground line-clamp-2">{profile.bio}</p>}
                    {profile?.expertise && profile.expertise.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {profile.expertise.slice(0, 4).map((e) => (
                          <Badge key={e} variant="secondary" className="text-xs">{e}</Badge>
                        ))}
                      </div>
                    )}
                    <Button variant="outline" className="w-full" onClick={() => navigate(`/book/${m.id}`)}>
                      <Calendar className="mr-2 h-4 w-4" />Book Session
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
            {filtered.length === 0 && <p className="text-muted-foreground col-span-full">No mentors found.</p>}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default MentorDirectory;
