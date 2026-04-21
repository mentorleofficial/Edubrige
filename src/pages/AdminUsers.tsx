import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, UserPlus } from "lucide-react";
import {
  useAdminUsers,
  useCreateUser,
  useToggleMentorActive,
  type RoleFilter,
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
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset to first page when filter changes
  useEffect(() => {
    setPage(0);
  }, [roleFilter]);

  const queryParams = { page, pageSize: PAGE_SIZE, role: roleFilter };
  const { data, isLoading, isFetching } = useAdminUsers(queryParams);
  const toggleMutation = useToggleMentorActive(queryParams);
  const createMutation = useCreateUser();

  const [dialogOpen, setDialogOpen] = useState(false);
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

  const handleCreate = async () => {
    try {
      await createMutation.mutateAsync({
        email: newEmail,
        password: newPassword,
        full_name: newName,
        role: newRole,
      });
      toast({ title: "User created", description: `${newEmail} has been invited.` });
      setDialogOpen(false);
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      setNewRole("mentee");
    } catch (err) {
      handleError(err, "Failed to create user");
    }
  };

  const handleToggle = (userId: string, isActive: boolean) => {
    setPendingUserId(userId);
    toggleMutation.mutate(
      { userId, isActive },
      {
        onSuccess: () => {
          toast({ title: isActive ? "Mentor activated" : "Mentor deactivated" });
        },
        onError: (err) => {
          handleError(err, "Failed to update mentor");
        },
        onSettled: () => setPendingUserId(null),
      },
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Users</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {total} {total === 1 ? "user" : "users"} total
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="mentor">Mentor</SelectItem>
                      <SelectItem value="mentee">Mentee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create User
                </Button>
              </div>
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
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="mentor">Mentor</SelectItem>
              <SelectItem value="mentee">Mentee</SelectItem>
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
                  <TableHead>Mentor Active</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={`sk-${i}`}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
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
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.full_name}</TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <Badge variant={roleBadgeVariant(u.role)}>{u.role}</Badge>
                        </TableCell>
                        <TableCell>
                          {u.role === "mentor" ? (
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={!!mp?.is_active}
                                disabled={isPending || isSelf}
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
                                <Badge variant="outline" className="text-[10px] px-1 py-0">
                                  no profile
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString()}
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || isLoading}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page + 1 >= totalPages || isLoading}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminUsers;
