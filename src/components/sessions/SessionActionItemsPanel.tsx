import { useState } from "react";
import { formatISTDate } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ListTodo, Paperclip, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useSessionActionItems,
  useCreateActionItem,
  useUpdateActionItem,
  useDeleteActionItem,
  useToggleActionItem,
  type ActionItem,
} from "@/features/action-items/useActionItems";
import { useMentorProfile } from "@/features/mentor-profile";
import { supabase } from "@/integrations/supabase/client";
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
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState<string | null>(null);

  const { data: mentorProfile } = useMentorProfile(mentorId);
  const allowMenteeAttachments = mentorProfile?.allow_mentee_attachments ?? false;

  const canEdit = role === "mentor";

  const handleAdd = async () => {
    const t = newTitle.trim();
    if (!t) return;
    try {
      let uploadedAttachments: { name: string; url: string }[] = [];
      if (newFiles.length > 0) {
        uploadedAttachments = await Promise.all(
          newFiles.map(async (file) => {
            const ext = file.name.split(".").pop();
            const filePath = `${sessionId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
            const { error: uploadError } = await supabase.storage
              .from("session-attachments")
              .upload(filePath, file);
            if (uploadError) throw uploadError;
            
            const { data } = supabase.storage
              .from("session-attachments")
              .getPublicUrl(filePath);
            return { name: file.name, url: data.publicUrl };
          })
        );
      }

      await createMut.mutateAsync({
        session_id: sessionId,
        mentor_id: mentorId,
        mentee_id: menteeId,
        title: t,
        description: newDesc.trim(),
        due_date: newDue || null,
        created_by: currentUserId,
        mentor_attachments: uploadedAttachments,
      });

      setNewTitle("");
      setNewDesc("");
      setNewDue("");
      setNewFiles([]);
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
      // Delete attachments from storage first if any
      const allAttachments = [
        ...(item.mentor_attachments || []),
        ...(item.mentee_attachments || [])
      ];
      if (allAttachments.length > 0) {
        const paths = allAttachments
          .map((att) => att.url.split("/session-attachments/")[1])
          .filter(Boolean);
        if (paths.length > 0) {
          await supabase.storage.from("session-attachments").remove(paths);
        }
      }

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
        patch,
      });
    } catch (e) {
      toast({ variant: "destructive", title: "Save failed", description: (e as Error).message });
    }
  };

  const handleUploadAttachment = async (
    item: ActionItem,
    type: "mentor" | "mentee",
    files: FileList | null
  ) => {
    if (!files || files.length === 0) return;
    setIsUploading(item.id);
    try {
      const file = files[0];
      const ext = file.name.split(".").pop();
      const filePath = `${sessionId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("session-attachments")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("session-attachments")
        .getPublicUrl(filePath);

      const newAttachment = { name: file.name, url: data.publicUrl };
      const currentList = type === "mentor" ? item.mentor_attachments || [] : item.mentee_attachments || [];
      const updatedList = [...currentList, newAttachment];

      await updateMut.mutateAsync({
        id: item.id,
        session_id: item.session_id,
        patch: {
          [type === "mentor" ? "mentor_attachments" : "mentee_attachments"]: updatedList,
        },
      });
      toast({ title: "File attached successfully" });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: (e as Error).message,
      });
    } finally {
      setIsUploading(null);
    }
  };

  const handleDeleteAttachment = async (
    item: ActionItem,
    type: "mentor" | "mentee",
    indexToDelete: number
  ) => {
    try {
      const currentList = type === "mentor" ? item.mentor_attachments || [] : item.mentee_attachments || [];
      const attachment = currentList[indexToDelete];
      if (attachment?.url) {
        const pathPart = attachment.url.split("/session-attachments/")[1];
        if (pathPart) {
          await supabase.storage.from("session-attachments").remove([pathPart]);
        }
      }

      const updatedList = currentList.filter((_, i) => i !== indexToDelete);

      await updateMut.mutateAsync({
        id: item.id,
        session_id: item.session_id,
        patch: {
          [type === "mentor" ? "mentor_attachments" : "mentee_attachments"]: updatedList,
        },
      });
      toast({ title: "Attachment removed" });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: (e as Error).message,
      });
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
              "flex items-start gap-3 rounded-md border p-3 text-sm bg-card shadow-sm",
              item.status === "done" && "bg-muted/40"
            )}
          >
            <Checkbox
              checked={item.status === "done"}
              onCheckedChange={() => handleToggle(item)}
              className="mt-0.5"
              aria-label="Mark complete"
            />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="space-y-1">
                {canEdit ? (
                  <Input
                    defaultValue={item.title}
                    onBlur={(e) => {
                      if (e.target.value !== item.title) handleInlineEdit(item, { title: e.target.value });
                    }}
                    className={cn("h-8 border-0 px-0 focus-visible:ring-0 font-medium bg-transparent", item.status === "done" && "line-through text-muted-foreground")}
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
                    className="text-xs border-0 px-0 focus-visible:ring-0 resize-none min-h-0 bg-transparent"
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
                      className="h-7 w-auto text-xs bg-transparent"
                    />
                  ) : item.due_date ? (
                    <span>Due {formatISTDate(item.due_date)}</span>
                  ) : null}
                  {item.status === "done" && item.completed_at && (
                    <span>· Done {formatISTDate(item.completed_at)}</span>
                  )}
                </div>
              </div>

              {/* Attachments Section */}
              <div className="space-y-2 pt-1 border-t border-muted-foreground/10">
                {/* Mentor Attachments */}
                {item.mentor_attachments && item.mentor_attachments.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground block">Mentor Attachments:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {item.mentor_attachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-1.5 rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] shadow-sm">
                          <a href={att.url} target="_blank" rel="noreferrer" className="hover:underline text-primary truncate max-w-[150px]">
                            {att.name}
                          </a>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleDeleteAttachment(item, 'mentor', i)}
                              className="text-muted-foreground hover:text-destructive ml-0.5"
                              title="Remove attachment"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mentee Attachments */}
                {item.mentee_attachments && item.mentee_attachments.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground block">Mentee Attachments:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {item.mentee_attachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-1.5 rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] shadow-sm">
                          <a href={att.url} target="_blank" rel="noreferrer" className="hover:underline text-primary truncate max-w-[150px]">
                            {att.name}
                          </a>
                          {!canEdit && (
                            <button
                              type="button"
                              onClick={() => handleDeleteAttachment(item, 'mentee', i)}
                              className="text-muted-foreground hover:text-destructive ml-0.5"
                              title="Remove attachment"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* File Upload Controls */}
                <div className="flex items-center gap-2">
                  {canEdit ? (
                    <>
                      <input
                        type="file"
                        id={`upload-mentor-${item.id}`}
                        className="hidden"
                        onChange={(e) => handleUploadAttachment(item, 'mentor', e.target.files)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => document.getElementById(`upload-mentor-${item.id}`)?.click()}
                        disabled={isUploading === item.id}
                      >
                        <Paperclip className="h-3 w-3 mr-1" />
                        {isUploading === item.id ? "Uploading..." : "Attach File"}
                      </Button>
                    </>
                  ) : (
                    allowMenteeAttachments && (
                      <>
                        <input
                          type="file"
                          id={`upload-mentee-${item.id}`}
                          className="hidden"
                          onChange={(e) => handleUploadAttachment(item, 'mentee', e.target.files)}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => document.getElementById(`upload-mentee-${item.id}`)?.click()}
                          disabled={isUploading === item.id}
                        >
                          <Paperclip className="h-3 w-3 mr-1" />
                          {isUploading === item.id ? "Uploading..." : "Attach Reply File"}
                        </Button>
                      </>
                    )
                  )}
                </div>
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
          
          {/* New files attached representation */}
          {newFiles.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-muted-foreground">Files to attach:</span>
              <div className="flex flex-wrap gap-1.5">
                {newFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-xs shadow-sm">
                    <span className="truncate max-w-[120px]">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setNewFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-muted-foreground hover:text-destructive ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={newDue}
              onChange={(e) => setNewDue(e.target.value)}
              className="h-8 w-auto"
            />
            
            <input
              type="file"
              id="new-task-files"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  setNewFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => document.getElementById("new-task-files")?.click()}
            >
              <Paperclip className="mr-1 h-3.5 w-3.5" /> Attach files
            </Button>

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
