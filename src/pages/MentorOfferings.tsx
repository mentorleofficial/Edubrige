import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus,
  Edit2,
  Trash2,
  Clock,
  Coins,
  Tag,
  Loader2,
  AlertCircle,
  Play,
  Pause,
  Archive,
} from "lucide-react";

export interface MentorshipOffering {
  id: string;
  mentor_id: string;
  title: string;
  description: string | null;
  category: string;
  price: number;
  currency: string;
  duration_minutes: number;
  status: string; // 'draft' | 'active' | 'paused' | 'archived'
  created_at: string;
  updated_at: string;
}

const MentorOfferings = () => {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOffering, setSelectedOffering] = useState<MentorshipOffering | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("30");
  const [price, setPrice] = useState("0");
  const [status, setStatus] = useState("draft");
  const [category, setCategory] = useState("mentorship");

  // Fetch offerings
  const { data: offerings = [], isLoading } = useQuery<MentorshipOffering[]>({
    queryKey: ["mentor", "offerings", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentorship_offerings")
        .select("*")
        .eq("mentor_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as MentorshipOffering[]) ?? [];
    },
  });

  // Mutate offerings
  const saveMutation = useMutation({
    mutationFn: async (payload: Omit<MentorshipOffering, "id" | "mentor_id" | "created_at" | "updated_at"> & { id?: string }) => {
      if (payload.id) {
        // Update
        const { error } = await supabase
          .from("mentorship_offerings")
          .update({
            title: payload.title,
            description: payload.description,
            duration_minutes: payload.duration_minutes,
            price: payload.price,
            status: payload.status,
            category: payload.category,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from("mentorship_offerings")
          .insert({
            mentor_id: user!.id,
            title: payload.title,
            description: payload.description,
            duration_minutes: payload.duration_minutes,
            price: payload.price,
            status: payload.status,
            category: payload.category,
          });
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["mentor", "offerings", user?.id] });
      qc.invalidateQueries({ queryKey: ["mentor-profile", user?.id] });
      await refreshProfile();
      toast({ title: selectedOffering ? "Offering updated" : "Offering created successfully" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Failed to save offering", description: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // We perform an archive action or hard delete
      const { error } = await supabase
        .from("mentorship_offerings")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["mentor", "offerings", user?.id] });
      qc.invalidateQueries({ queryKey: ["mentor-profile", user?.id] });
      await refreshProfile();
      toast({ title: "Offering deleted successfully" });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Failed to delete offering", description: err.message });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("mentorship_offerings")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["mentor", "offerings", user?.id] });
      qc.invalidateQueries({ queryKey: ["mentor-profile", user?.id] });
      await refreshProfile();
      toast({ title: "Status updated successfully" });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Failed to update status", description: err.message });
    },
  });

  const resetForm = () => {
    setSelectedOffering(null);
    setTitle("");
    setDescription("");
    setDuration("30");
    setPrice("0");
    setStatus("draft");
    setCategory("mentorship");
  };

  const handleEdit = (o: MentorshipOffering) => {
    setSelectedOffering(o);
    setTitle(o.title);
    setDescription(o.description ?? "");
    setDuration(String(o.duration_minutes));
    setPrice(String(o.price));
    setStatus(o.status);
    setCategory(o.category);
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ variant: "destructive", title: "Title is required" });
      return;
    }
    saveMutation.mutate({
      id: selectedOffering?.id,
      title: title.trim(),
      description: description.trim() || null,
      duration_minutes: Number(duration),
      price: Number(price),
      status,
      category,
      currency: "INR",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-500/15 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/35">Active</Badge>;
      case "paused":
        return <Badge className="bg-amber-500/15 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/35">Paused</Badge>;
      case "archived":
        return <Badge className="bg-destructive/15 hover:bg-destructive/20 text-destructive border border-destructive/35">Archived</Badge>;
      case "draft":
      default:
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Offerings & Services</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage the mentorship sessions you offer. Mentees book sessions under these specific offerings.
            </p>
          </div>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Offering
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-12">
            <Loader2 className="h-6 w-6 animate-spin" /> Loading offerings…
          </div>
        ) : offerings.length === 0 ? (
          <Card className="border-dashed p-12 text-center flex flex-col items-center justify-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Tag className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-lg">No offerings created yet</CardTitle>
            <CardDescription className="max-w-md mt-1 mb-6">
              Create at least one offering (like a 30-minute Career Guidance session) to complete your profile and start accepting bookings.
            </CardDescription>
            <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Create Your First Offering
            </Button>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {offerings.map((o) => (
              <Card
                key={o.id}
                className="group flex flex-col justify-between overflow-hidden relative border border-muted/80 bg-card hover:border-primary/50 hover:shadow-md transition-all duration-300"
              >
                <div>
                  <div className="h-2 bg-gradient-to-r from-primary to-accent" />
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors">
                        {o.title}
                      </CardTitle>
                      {getStatusBadge(o.status)}
                    </div>
                    {o.description && (
                      <p className="text-muted-foreground text-xs line-clamp-3 mt-1.5 leading-relaxed">
                        {o.description}
                      </p>
                    )}
                  </CardHeader>
                </div>
                <CardContent className="pt-0 space-y-4">
                  <div className="flex items-center gap-4 text-sm font-medium text-foreground/80 border-t pt-3">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-primary" />
                      <span>{o.duration_minutes} mins</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Coins className="h-4 w-4 text-emerald-500" />
                      <span>{o.price === 0 ? "Free" : `₹${o.price}`}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t pt-3">
                    {o.status === "active" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Pause offering"
                        onClick={() => updateStatusMutation.mutate({ id: o.id, status: "paused" })}
                        disabled={updateStatusMutation.isPending}
                      >
                        <Pause className="h-4 w-4 text-amber-500" />
                      </Button>
                    ) : o.status === "paused" || o.status === "draft" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Activate offering"
                        onClick={() => updateStatusMutation.mutate({ id: o.id, status: "active" })}
                        disabled={updateStatusMutation.isPending}
                      >
                        <Play className="h-4 w-4 text-emerald-500" />
                      </Button>
                    ) : null}
                    
                    {o.status !== "archived" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Archive offering"
                        onClick={() => updateStatusMutation.mutate({ id: o.id, status: "archived" })}
                        disabled={updateStatusMutation.isPending}
                      >
                        <Archive className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}

                    <Button variant="outline" size="sm" onClick={() => handleEdit(o)}>
                      <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this offering?")) {
                          deleteMutation.mutate(o.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{selectedOffering ? "Edit Offering" : "Add Offering"}</DialogTitle>
              <DialogDescription>
                Fill in the details for this session offering. Offerings represent different services mentees can book.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g. 1-on-1 Mock Interview"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what this session covers, how you will help, and what the mentee should prepare..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={500}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="duration">Duration *</Label>
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger id="duration">
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">60 minutes</SelectItem>
                      <SelectItem value="90">90 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="price">Price (INR) *</Label>
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    placeholder="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    placeholder="mentorship"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="status">Status *</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter className="pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…
                    </>
                  ) : (
                    "Save Offering"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default MentorOfferings;
