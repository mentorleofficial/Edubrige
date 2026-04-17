import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, UserPlus } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
type UserRow = Database["public"]["Tables"]["users"]["Row"] & { mentor_profiles?: { is_active: boolean }[] };

const AdminUsers = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("mentee");
  const [newPassword, setNewPassword] = useState("");
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("users")
      .select("*, mentor_profiles(is_active)")
      .order("created_at", { ascending: false });
    setUsers((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async () => {
    try {
      const res = await supabase.auth.signUp({
        email: newEmail,
        password: newPassword,
        options: { data: { full_name: newName, role: newRole } },
      });
      if (res.error) throw res.error;
      toast({ title: "User created", description: `${newEmail} has been invited.` });
      setDialogOpen(false);
      setNewEmail(""); setNewName(""); setNewPassword("");
      setTimeout(fetchUsers, 1000);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const filtered = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const roleBadgeVariant = (role: AppRole) =>
    role === "admin" ? "destructive" : role === "mentor" ? "default" : "secondary";

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Users</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><UserPlus className="mr-2 h-4 w-4" />Add User</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create New User</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
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
                <Button className="w-full" onClick={handleCreate}>Create User</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No users found</TableCell></TableRow>
                ) : (
                  filtered.map((u) => {
                    const mp = u.mentor_profiles?.[0];
                    return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.full_name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell><Badge variant={roleBadgeVariant(u.role)}>{u.role}</Badge></TableCell>
                      <TableCell>
                        {u.role === "mentor" ? (
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={!!mp?.is_active}
                              onCheckedChange={async (checked) => {
                                const { error } = await supabase
                                  .from("mentor_profiles")
                                  .update({ is_active: checked })
                                  .eq("user_id", u.id);
                                if (error) {
                                  toast({ variant: "destructive", title: "Update failed", description: error.message });
                                } else {
                                  toast({ title: checked ? "Mentor activated" : "Mentor deactivated" });
                                  fetchUsers();
                                }
                              }}
                            />
                            <span className="text-xs text-muted-foreground">{mp?.is_active ? "Active" : "Inactive"}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminUsers;
