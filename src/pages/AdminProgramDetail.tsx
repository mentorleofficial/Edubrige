import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, X, GripVertical, Tag } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Program = Database["public"]["Tables"]["programs"]["Row"];
type UserRow = { id: string; full_name: string; email: string };
type Assignment = { id: string; mentor_id: string; mentee_id: string };
type TagRow = Database["public"]["Tables"]["program_tags"]["Row"];

const initialsOf = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";

/* ---------- Drag pieces ---------- */
const DraggableMentee = ({ user }: { user: UserRow }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `mentee:${user.id}` });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-sm cursor-grab active:cursor-grabbing ${isDragging ? "opacity-40" : ""}`}
    >
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px]">{initialsOf(user.full_name)}</AvatarFallback></Avatar>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium leading-tight">{user.full_name}</p>
        <p className="truncate text-[10px] text-muted-foreground leading-tight">{user.email}</p>
      </div>
    </div>
  );
};

const MentorDropZone = ({
  mentor, assignedMentees, onUnassign,
}: {
  mentor: UserRow;
  assignedMentees: UserRow[];
  onUnassign: (menteeId: string) => void;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: `mentor:${mentor.id}` });
  return (
    <Card ref={setNodeRef} className={`transition-colors ${isOver ? "border-primary bg-primary/5" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8"><AvatarFallback>{initialsOf(mentor.full_name)}</AvatarFallback></Avatar>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm leading-tight truncate">{mentor.full_name}</CardTitle>
            <p className="text-[11px] text-muted-foreground truncate">{mentor.email}</p>
          </div>
          <Badge variant="secondary" className="text-xs">{assignedMentees.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 min-h-[80px]">
        {assignedMentees.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center py-3">Drop mentees here</p>
        ) : (
          assignedMentees.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 rounded bg-muted/50 px-2 py-1 text-xs">
              <span className="truncate">{m.full_name}</span>
              <button onClick={() => onUnassign(m.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

/* ---------- Page ---------- */
const AdminProgramDetail = () => {
  const { id: programId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();

  const [program, setProgram] = useState<Program | null>(null);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [allMentors, setAllMentors] = useState<UserRow[]>([]);
  const [allMentees, setAllMentees] = useState<UserRow[]>([]);
  const [programMentors, setProgramMentors] = useState<string[]>([]);
  const [programMentees, setProgramMentees] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [tab, setTab] = useState<"mapping" | "members" | "tags">("mapping");
  const [activeDrag, setActiveDrag] = useState<UserRow | null>(null);
  const [newTag, setNewTag] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const load = async () => {
    if (!programId) return;
    const [{ data: p }, { data: t }, { data: pm }, { data: pme }, { data: ma }] = await Promise.all([
      supabase.from("programs").select("*").eq("id", programId).maybeSingle(),
      supabase.from("program_tags").select("*").eq("program_id", programId).order("label"),
      supabase.from("program_mentors").select("mentor_id").eq("program_id", programId),
      supabase.from("program_mentees").select("mentee_id").eq("program_id", programId),
      supabase.from("mentor_mentee_assignments").select("id, mentor_id, mentee_id").eq("program_id", programId),
    ]);
    setProgram(p ?? null);
    setTags(t || []);
    setProgramMentors((pm || []).map((r: any) => r.mentor_id));
    setProgramMentees((pme || []).map((r: any) => r.mentee_id));
    setAssignments((ma || []) as Assignment[]);
  };

  const loadDirectory = async () => {
    const [{ data: mentors }, { data: mentees }] = await Promise.all([
      supabase.from("user_roles").select("user_id, users:user_id(id, full_name, email)").eq("role", "mentor"),
      supabase.from("user_roles").select("user_id, users:user_id(id, full_name, email)").eq("role", "mentee"),
    ]);
    setAllMentors(((mentors || []) as any).map((r: any) => r.users).filter(Boolean));
    setAllMentees(((mentees || []) as any).map((r: any) => r.users).filter(Boolean));
  };

  useEffect(() => { load(); loadDirectory(); }, [programId]);

  const mentorsInProgram = useMemo(
    () => allMentors.filter((m) => programMentors.includes(m.id)),
    [allMentors, programMentors]
  );
  const menteesInProgram = useMemo(
    () => allMentees.filter((m) => programMentees.includes(m.id)),
    [allMentees, programMentees]
  );
  const assignedMenteeIds = new Set(assignments.map((a) => a.mentee_id));
  const unassignedMentees = menteesInProgram.filter((m) => !assignedMenteeIds.has(m.id));
  const menteesByMentor = (mentorId: string) =>
    assignments
      .filter((a) => a.mentor_id === mentorId)
      .map((a) => menteesInProgram.find((m) => m.id === a.mentee_id))
      .filter(Boolean) as UserRow[];

  /* drag handlers */
  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id).replace("mentee:", "");
    setActiveDrag(menteesInProgram.find((m) => m.id === id) ?? null);
  };
  const onDragEnd = async (e: DragEndEvent) => {
    setActiveDrag(null);
    if (!e.over || !programId) return;
    const menteeId = String(e.active.id).replace("mentee:", "");
    const mentorId = String(e.over.id).replace("mentor:", "");
    const existing = assignments.find((a) => a.mentee_id === menteeId);
    if (existing && existing.mentor_id === mentorId) return;
    if (existing) {
      const { error } = await supabase.from("mentor_mentee_assignments").update({ mentor_id: mentorId, assigned_by: user?.id ?? null }).eq("id", existing.id);
      if (error) return toast({ variant: "destructive", title: "Move failed", description: error.message });
    } else {
      const { error } = await supabase.from("mentor_mentee_assignments").insert({ program_id: programId, mentor_id: mentorId, mentee_id: menteeId, assigned_by: user?.id ?? null });
      if (error) return toast({ variant: "destructive", title: "Assign failed", description: error.message });
    }
    load();
  };

  const unassign = async (menteeId: string) => {
    const a = assignments.find((x) => x.mentee_id === menteeId);
    if (!a) return;
    await supabase.from("mentor_mentee_assignments").delete().eq("id", a.id);
    load();
  };

  /* members management */
  const toggleMentor = async (mentorId: string, on: boolean) => {
    if (!programId) return;
    if (on) await supabase.from("program_mentors").insert({ program_id: programId, mentor_id: mentorId, assigned_by: user?.id ?? null });
    else await supabase.from("program_mentors").delete().match({ program_id: programId, mentor_id: mentorId });
    load();
  };
  const toggleMentee = async (menteeId: string, on: boolean) => {
    if (!programId) return;
    if (on) await supabase.from("program_mentees").insert({ program_id: programId, mentee_id: menteeId, assigned_by: user?.id ?? null });
    else await supabase.from("program_mentees").delete().match({ program_id: programId, mentee_id: menteeId });
    load();
  };

  /* tags */
  const addTag = async () => {
    const label = newTag.trim();
    if (!label || !programId) return;
    const { error } = await supabase.from("program_tags").insert({ program_id: programId, label });
    if (error) toast({ variant: "destructive", title: "Tag failed", description: error.message });
    setNewTag("");
    load();
  };
  const removeTag = async (id: string) => {
    await supabase.from("program_tags").delete().eq("id", id);
    load();
  };

  if (!program) return <AppLayout><p className="text-muted-foreground">Loading…</p></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-3">
            <Link to="/admin/programs"><ArrowLeft className="h-4 w-4 mr-1" />All programs</Link>
          </Button>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold">{program.name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <Badge variant={program.status === "active" ? "default" : "secondary"} className="capitalize">{program.status}</Badge>
                {tags.map((t) => <Badge key={t.id} variant="outline" className="text-xs"><Tag className="h-3 w-3 mr-1" />{t.label}</Badge>)}
              </div>
              {program.description && <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{program.description}</p>}
            </div>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="mapping">Mapping board</TabsTrigger>
            <TabsTrigger value="members">Members ({mentorsInProgram.length} / {menteesInProgram.length})</TabsTrigger>
            <TabsTrigger value="tags">Tags ({tags.length})</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "mapping" && (
          mentorsInProgram.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              Add mentors and mentees to this program first in the Members tab.
            </CardContent></Card>
          ) : (
            <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
              <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Unassigned mentees <Badge variant="secondary" className="ml-2">{unassignedMentees.length}</Badge></CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5 max-h-[600px] overflow-y-auto">
                    {unassignedMentees.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic text-center py-4">All mentees are assigned 🎉</p>
                    ) : unassignedMentees.map((m) => <DraggableMentee key={m.id} user={m} />)}
                  </CardContent>
                </Card>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {mentorsInProgram.map((m) => (
                    <MentorDropZone key={m.id} mentor={m} assignedMentees={menteesByMentor(m.id)} onUnassign={unassign} />
                  ))}
                </div>
              </div>
              <DragOverlay>{activeDrag ? <DraggableMentee user={activeDrag} /> : null}</DragOverlay>
            </DndContext>
          )
        )}

        {tab === "members" && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Mentors in program</CardTitle></CardHeader>
              <CardContent className="space-y-1 max-h-[500px] overflow-y-auto">
                {allMentors.length === 0 ? <p className="text-sm text-muted-foreground">No mentors in the platform yet.</p> :
                  allMentors.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50 cursor-pointer">
                      <Checkbox checked={programMentors.includes(u.id)} onCheckedChange={(v) => toggleMentor(u.id, !!v)} />
                      <span className="text-sm flex-1 truncate">{u.full_name}</span>
                      <span className="text-xs text-muted-foreground truncate">{u.email}</span>
                    </label>
                  ))
                }
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Mentees in program</CardTitle></CardHeader>
              <CardContent className="space-y-1 max-h-[500px] overflow-y-auto">
                {allMentees.length === 0 ? <p className="text-sm text-muted-foreground">No mentees yet.</p> :
                  allMentees.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50 cursor-pointer">
                      <Checkbox checked={programMentees.includes(u.id)} onCheckedChange={(v) => toggleMentee(u.id, !!v)} />
                      <span className="text-sm flex-1 truncate">{u.full_name}</span>
                      <span className="text-xs text-muted-foreground truncate">{u.email}</span>
                    </label>
                  ))
                }
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "tags" && (
          <Card>
            <CardHeader><CardTitle className="text-base">Program tags</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input placeholder="e.g. Frontend" value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTag()} />
                <Button onClick={addTag} disabled={!newTag.trim()}><Plus className="h-4 w-4 mr-1" />Add</Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tags.length === 0 ? <p className="text-sm text-muted-foreground">No tags yet.</p> :
                  tags.map((t) => (
                    <Badge key={t.id} variant="secondary" className="gap-1">
                      {t.label}
                      <button onClick={() => removeTag(t.id)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                    </Badge>
                  ))
                }
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminProgramDetail;
