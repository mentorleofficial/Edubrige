import { useState } from "react";
import { formatISTDate } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ListTodo } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useSessionActionItems,
  useCreateActionItem,
  useUpdateActionItem,
  useDeleteActionItem,
  useToggleActionItem,
  type ActionItem,
} from "@/features/action-items/useActionItems";
import { cn } from "@/lib/utils";

interface Props {
  sessionId: string;
  mentorId: string;
  menteeId: string;
  currentUserId: string;
  role: "mentor" | "mentee";
}

export default function SessionActionItemsPanel({
  sessionId,
  mentorId,
  menteeId,
  currentUserId,
  role,
}: Props) {
  const { toast } = useToast();
  const { data: items = [], isLoading } = useSessionActionItems(sessionId);
  const createMut = useCreateActionItem();
  const updateMut = useUpdateActionItem();
  const deleteMut = useDeleteActionItem();
  const toggle = useToggleActionItem();

  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDue, setNewDue] = useState("");

  const canEdit = role === "mentor";

  const handleAdd = async () => {
    const t = newTitle.trim();
    if (!t) return;
    try {
      await createMut.mutateAsync({
        session_id: sessionId,
        mentor_id: mentorId,
        mentee_id: menteeId,
        title: t,
        description: newDesc.trim(),
        due_date: newDue || null,
        created_by: currentUserId,
      });
      setNewTitle("");
      setNewDesc("");
      setNewDue("");
    } catch (e) {
      toast({ variant: "destructive", title: "Couldn't add task", description: (e as Error).message });
    }
  };

  const handleToggle = async (item: ActionItem) => {
    try {
      await toggle(item);
    } catch (e) {
      toast({ variant: "destructive", title: "Update failed", description: (e as Error).message });
    }
  };

  const handleDelete = async (item: ActionItem) => {
    try {
      await deleteMut.mutateAsync({
        id: item.id,
        session_id: item.session_id,
        mentor_id: item.mentor_id,
        mentee_id: item.mentee_id,
      });
    } catch (e) {
      toast({ variant: "destructive", title: "Delete failed", description: (e as Error).message });
    }
  };

  const handleInlineEdit = async (item: ActionItem, patch: Partial<ActionItem>) => {
    try {
      await updateMut.mutateAsync({
        id: item.id,
        session_id: item.session_id,
        patch: {
          title: patch.title,
          description: patch.description,
          due_date: patch.due_date,
        },
      });
    } catch (e) {
      toast({ variant: "destructive", title: "Save failed", description: (e as Error).message });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ListTodo className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">Action Items</h3>
        <Badge variant="secondary" className="text-[10px]">
          {items.filter((i) => i.status === "open").length} open
        </Badge>
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}

      {!isLoading && items.length === 0 && !canEdit && (
        <p className="text-xs text-muted-foreground">No tasks assigned for this session.</p>
      )}

      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={cn(
              "flex items-start gap-3 rounded-md border p-3 text-sm",
              item.status === "done" && "bg-muted/40"
            )}
          >
            <Checkbox
              checked={item.status === "done"}
              onCheckedChange={() => handleToggle(item)}
              className="mt-0.5"
              aria-label="Mark complete"
            />
            <div className="flex-1 min-w-0 space-y-1">
              {canEdit ? (
                <Input
                  defaultValue={item.title}
                  onBlur={(e) => {
                    if (e.target.value !== item.title) handleInlineEdit(item, { title: e.target.value });
                  }}
                  className={cn("h-8 border-0 px-0 focus-visible:ring-0 font-medium", item.status === "done" && "line-through text-muted-foreground")}
                />
              ) : (
                <p className={cn("font-medium", item.status === "done" && "line-through text-muted-foreground")}>
                  {item.title}
                </p>
              )}
              {canEdit ? (
                <Textarea
                  defaultValue={item.description}
                  onBlur={(e) => {
                    if (e.target.value !== item.description) handleInlineEdit(item, { description: e.target.value });
                  }}
                  rows={1}
                  placeholder="Add details…"
                  className="text-xs border-0 px-0 focus-visible:ring-0 resize-none min-h-0"
                />
              ) : (
                item.description && <p className="text-xs text-muted-foreground">{item.description}</p>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {canEdit ? (
                  <Input
                    type="date"
                    defaultValue={item.due_date ?? ""}
                    onBlur={(e) => {
                      const next = e.target.value || null;
                      if (next !== item.due_date) handleInlineEdit(item, { due_date: next });
                    }}
                    className="h-7 w-auto text-xs"
                  />
                ) : item.due_date ? (
                  <span>Due {format(new Date(item.due_date), "PP")}</span>
                ) : null}
                {item.status === "done" && item.completed_at && (
                  <span>· Done {format(new Date(item.completed_at), "PP")}</span>
                )}
              </div>
            </div>
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(item)}
                aria-label="Delete task"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </li>
        ))}
      </ul>

      {canEdit && (
        <div className="rounded-md border border-dashed p-3 space-y-2">
          <Label className="text-xs">Add a follow-up task</Label>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Send portfolio draft"
            className="h-8"
          />
          <Textarea
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Optional details…"
            rows={2}
          />
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={newDue}
              onChange={(e) => setNewDue(e.target.value)}
              className="h-8 w-auto"
            />
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={createMut.isPending || !newTitle.trim()}
              className="ml-auto"
            >
              <Plus className="mr-1 h-3 w-3" />
              {createMut.isPending ? "Adding…" : "Add task"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
