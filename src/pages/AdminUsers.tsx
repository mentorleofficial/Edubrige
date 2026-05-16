import { import { formatISTDate } from "@/lib/datetime";
import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MoreHorizontal, Search, UserPlus } from "lucide-react";
import {
  useAdminUsers, useCreateUser, useToggleMentorActive, useSetUserDisabled,
  type RoleFilter, type StatusFilter,
} from "@/features/admin";
import type { AppRole } from "@/features/admin/api/users";
import { useAuth } from "@/contexts/AuthContext";
import { handleError } from "@/lib/handleError";

const PAGE_SIZE = 25;

const roleBadgeVariant = (role: AppRole) =>
  role === "admin" ? "destructive" : role === "mentor" ? "default" : "secondary";

const AdminUsers = () => {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const [page, setPage] = useState(0);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { setPage(0); }, [roleFilter, statusFilter]);

  const queryParams = { page, pageSize: PAGE_SIZE, role: roleFilter, status: statusFilter };
  const { data, isLoading, isFetching } = useAdminUsers(queryParams);
  const toggleMutation = useToggleMentorActive(queryParams);
  const createMutation = useCreateUser();
  const disableMutation = useSetUserDisabled();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteMode, setInviteMode] = useState<"invite" | "password">("invite");
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("mentee");
  const [newPassword, setNewPassword] = useState("");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filtered = useMemo(() => {
    if (!search) return rows;
    return rows.filter(
      (u) =>
        u.full_name.toLowerCase().includes(search) ||
        u.email.toLowerCase().includes(search),
    );
  }, [rows, search]);

  const resetForm = () => {
    setNewEmail(""); setNewName(""); setNewPassword(""); setNewRole("mentee");
    setInviteMode("invite");
  };

  const handleCreate = async () => {
    try {
      await createMutation.mutateAsync({
        email: newEmail.trim(),
        full_name: newName.trim(),
        role: newRole,
        mode: inviteMode,
        password: inviteMode === "password" ? newPassword : undefined,
      });
      toast({
        title: inviteMode === "invite" ? "Invite sent" : "User created",
        description:
          inviteMode === "invite"
            ? `${newEmail} will receive an email to set their password.`
            : `${newEmail} can sign in with the password you set.`,
      });
      setDialogOpen(false);
      resetForm();
    } catch (err) {
      handleError(err, "Failed to create user");
    }
  };

  const handleToggle = (userId: string, isActive: boolean) => {
    setPendingUserId(userId);
    toggleMutation.mutate(
      { userId, isActive },
      {
        onSuccess: () => toast({ title: isActive ? "Mentor activated" : "Mentor deactivated" }),
        onError: (err) => handleError(err, "Failed to update mentor"),
        onSettled: () => setPendingUserId(null),
      },
    );
  };

  const handleSetDisabled = async (userId: string, disabled: boolean) => {
    try {
      await disableMutation.mutateAsync({ userId, disabled });
      toast({ title: disabled ? "User deactivated" : "User restored" });
    } catch (err) {
      handleError(err, disabled ? "Failed to deactivate user" : "Failed to restore user");
    }
  };

  const canSubmit =
    newEmail.trim().length > 0 &&
    newName.trim().length > 0 &&
    (inviteMode === "invite" || newPassword.length >= 8);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Users</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {total} {total === 1 ? "user" : "users"} · {statusFilter}
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><UserPlus className="mr-2 h-4 w-4" />Add User</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create new user</DialogTitle>
              </DialogHeader>
              <Tabs value={inviteMode} onValueChange={(v) => setInviteMode(v as "invite" | "password")} className="pt-2">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="invite">Email invite</TabsTrigger>
                  <TabsTrigger value="password">Set password</TabsTrigger>
                </TabsList>
                <TabsContent value="invite" className="pt-1">
                  <p className="text-xs text-muted-foreground">
                    The user receives an email with a secure link to set their own password.
                  </p>
                </TabsContent>
                <TabsContent value="password" className="pt-1">
                  <p className="text-xs text-muted-foreground">
                    You set a temporary password and share it with the user manually.
                  </p>
                </TabsContent>
              </Tabs>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Full name</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                </div>
                {inviteMode === "password" && (
                  <div className="space-y-2">
                    <Label>Temporary password</Label>
                    <Input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimum 8 characters" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="mentor">Mentor</SelectItem>
                      <SelectItem value="mentee">Mentee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={!canSubmit || createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {inviteMode === "invite" ? "Send invite" : "Create user"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
            <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="mentor">Mentor</SelectItem>
              <SelectItem value="mentee">Mentee</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="disabled">Deactivated</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Mentor active</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={`sk-${i}`}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((u) => {
                    const mp = u.mentor_profiles?.[0];
                    const hasProfile = !!u.mentor_profiles && u.mentor_profiles.length > 0;
                    const isPending = pendingUserId === u.id;
                    const isSelf = currentUser?.id === u.id;
                    return (
                      <TableRow key={u.id} className={u.is_disabled ? "opacity-60" : undefined}>
                        <TableCell className="font-medium">{u.full_name}</TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <Badge variant={roleBadgeVariant(u.role)}>{u.role}</Badge>
                        </TableCell>
                        <TableCell>
                          {u.is_disabled ? (
                            <Badge variant="outline" className="text-destructive border-destructive/40">Deactivated</Badge>
                          ) : (
                            <Badge variant="secondary">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {u.role === "mentor" ? (
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={!!mp?.is_active}
                                disabled={isPending || isSelf || u.is_disabled}
                                onCheckedChange={(checked) => handleToggle(u.id, checked)}
                              />
                              {isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {mp?.is_active ? "Active" : "Inactive"}
                                </span>
                              )}
                              {!hasProfile && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0">no profile</Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatISTDate(u.created_at)}
                        </TableCell>
                        <TableCell>
                          <UserRowActions
                            user={u}
                            isSelf={isSelf}
                            onSetDisabled={handleSetDisabled}
                            pending={disableMutation.isPending}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
            {isFetching && !isLoading && " · refreshing…"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || isLoading}>
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page + 1 >= totalPages || isLoading}>
              Next
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

const UserRowActions = ({
  user, isSelf, onSetDisabled, pending,
}: {
  user: { id: string; full_name: string; is_disabled: boolean };
  isSelf: boolean;
  onSetDisabled: (id: string, disabled: boolean) => void;
  pending: boolean;
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const disabling = !user.is_disabled;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isSelf}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {user.is_disabled ? (
            <DropdownMenuItem onClick={() => setConfirmOpen(true)}>Restore user</DropdownMenuItem>
          ) : (
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmOpen(true)}>
              Deactivate user
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {disabling ? `Deactivate ${user.full_name}?` : `Restore ${user.full_name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {disabling
                ? "They will no longer be visible to mentors or mentees and cannot sign in. Sessions and history are preserved. You can restore them anytime."
                : "They will regain access to the platform. Their previous role and history are restored."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { onSetDisabled(user.id, disabling); setConfirmOpen(false); }}
              disabled={pending}
              className={disabling ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
            >
              {disabling ? "Deactivate" : "Restore"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AdminUsers;
