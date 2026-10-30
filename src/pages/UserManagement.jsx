import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Users, Power, Trash2, Check, Pencil } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import InviteCard from "@/components/users/InviteCard";
import StatusBadge from "@/components/users/StatusBadge";
import MembersExport from "@/components/users/MembersExport";
import UserRoleSelect from "@/components/users/UserRoleSelect";
import MemberEditDialog from "@/components/users/MemberEditDialog";
import MemberDeleteDialog from "@/components/users/MemberDeleteDialog";
import MemberModules from "@/components/users/MemberModules";
import { effectiveModuleKeys, hasAssignedModules, isAdminUser, USER_MODULE_KEYS } from "@/lib/permissions";

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);

  const loadUsers = async () => {
    const data = await base44.entities.User.list("-created_date", 200);
    setUsers(Array.isArray(data) ? data : data?.items || []);
  };

  const loadInvites = async () => {
    const page = await base44.entities.UserInvite.filter({}, { sort: "-created_date", limit: 200 });
    setInvites(page.items || []);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      await Promise.all([loadUsers(), loadInvites()]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Keep the table live: a member row appears (Active) the moment an invited
  // person signs in, and invite changes (approve/revoke) reflect immediately.
  useEffect(() => {
    const unsubUsers = base44.entities.User.subscribe(() => loadUsers());
    const unsubInvites = base44.entities.UserInvite.subscribe(() => loadInvites());
    return () => {
      if (typeof unsubUsers === "function") unsubUsers();
      if (typeof unsubInvites === "function") unsubInvites();
    };
  }, []);

  const memberEmails = useMemo(
    () => new Set(users.map((u) => (u.email || "").toLowerCase())),
    [users]
  );

  // Invitations whose email has not appeared as a signed-in member yet.
  const openInvites = useMemo(
    () => invites.filter((i) => !memberEmails.has((i.email || "").toLowerCase())),
    [invites, memberEmails]
  );

  const query = search.trim().toLowerCase();
  const matchesSearch = (text) => !query || (text || "").toLowerCase().includes(query);
  const matchesRole = (role) => roleFilter === "all" || role === roleFilter;

  const filteredUsers = users.filter(
    (u) => matchesSearch(`${u.full_name || ""} ${u.email || ""}`) && matchesRole(u.role)
  );
  const filteredInvites = openInvites.filter((i) => matchesSearch(i.email) && matchesRole(i.role));

  const rowKeys = [
    ...filteredUsers.map((u) => `user:${u.id}`),
    ...filteredInvites.map((i) => `invite:${i.id}`),
  ];
  const allSelected = rowKeys.length > 0 && rowKeys.every((k) => selected.has(k));

  const toggleRow = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) next.clear();
      else rowKeys.forEach((k) => next.add(k));
      return next;
    });
  };

  const selectedUserIds = [...selected].filter((k) => k.startsWith("user:")).map((k) => k.slice(5));
  const selectedInviteIds = [...selected].filter((k) => k.startsWith("invite:")).map((k) => k.slice(7));
  const selectedPendingInvites = openInvites.filter(
    (i) => selectedInviteIds.includes(i.id) && i.status === "pending"
  );
  const selectedMembers = users.filter((u) => selectedUserIds.includes(u.id));
  const canSuspendSelected = selectedMembers.some((u) => u.role !== "admin" && u.status !== "suspended");
  const canActivateSelected = selectedMembers.some((u) => u.status === "suspended");

  const approveInvite = async (invite) => {
    setBusy(true);
    try {
      await base44.entities.UserInvite.update(invite.id, {
        status: "accepted",
        accepted_date: new Date().toISOString(),
      });
      toast({ title: "Invitation approved", description: `${invite.email} can now open the dashboard.` });
      setSelected(new Set());
      await loadAll();
    } catch (e) {
      toast({ title: "Approval failed", description: e?.message || "Please try again", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const revokeInvite = async (invite) => {
    setBusy(true);
    try {
      await base44.entities.UserInvite.delete(invite.id);
      toast({ title: "Invitation revoked", description: `${invite.email} was removed from the invitation list.` });
      setSelected(new Set());
      await loadInvites();
    } catch (e) {
      toast({ title: "Revoke failed", description: e?.message || "Please try again", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const setMemberStatus = async (user, status) => {
    setBusy(true);
    try {
      await base44.functions.invoke("setUserStatus", { userId: user.id, status });
      toast({
        title: status === "suspended" ? "Member suspended" : "Member reactivated",
        description: `${user.email} is now ${status === "suspended" ? "blocked from the app" : "able to sign in again"}.`,
      });
      await loadUsers();
    } catch (e) {
      const message = e?.response?.data?.error || e?.message || "Status change failed";
      toast({ title: "Status change failed", description: message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const runBulk = async (action) => {
    setBusy(true);
    try {
      if (action === "approve") {
        for (const invite of selectedPendingInvites) {
          await base44.entities.UserInvite.update(invite.id, {
            status: "accepted",
            accepted_date: new Date().toISOString(),
          });
        }
      } else {
        const status = action === "suspend" ? "suspended" : "active";
        for (const member of selectedMembers) {
          if (member.role === "admin") continue;
          await base44.functions.invoke("setUserStatus", { userId: member.id, status });
        }
      }
      setSelected(new Set());
      await loadAll();
      toast({ title: "Changes applied" });
    } catch (e) {
      const message = e?.response?.data?.error || e?.message || "Bulk action failed";
      toast({ title: "Bulk action failed", description: message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const exportRows = [
    ...users.map((u) => ({
      name: u.full_name || "-",
      email: u.email || "",
      role: u.role || "",
      status: u.status === "suspended" ? "Suspended" : "Active",
      joined: u.created_date ? format(new Date(u.created_date), "d MMM yyyy") : "-",
    })),
    ...openInvites.map((i) => ({
      name: "Invited — not signed in yet",
      email: i.email,
      role: i.role || "",
      status: i.status === "pending" ? "Awaiting approval" : "Invited",
      joined: "-",
    })),
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  // Modules an invitation carries onto the account: the ones chosen by the administrator,
  // or the default operational pages when none were chosen.
  const inviteModuleKeys = (invite) =>
    Array.isArray(invite.permissions) && invite.permissions.length ? invite.permissions : USER_MODULE_KEYS;

  const empty = filteredUsers.length === 0 && filteredInvites.length === 0;

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">User Management</h2>
          <p className="text-slate-500 text-sm">Manage members, roles, and access</p>
        </div>
        <MembersExport rows={exportRows} />
      </div>

      <InviteCard onInvited={loadAll} />

      <div className="bg-white rounded-xl border border-slate-200 mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Members</h3>
              <p className="text-xs text-slate-500">{users.length} total</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email"
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-5 py-3 bg-sky-50 border-b border-sky-100">
            <span className="text-sm text-slate-600 font-medium mr-1">{selected.size} selected</span>
            {selectedPendingInvites.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => runBulk("approve")} disabled={busy}>
                <Check className="w-3.5 h-3.5 mr-1" /> Approve
              </Button>
            )}
            {canSuspendSelected && (
              <Button size="sm" variant="outline" onClick={() => runBulk("suspend")} disabled={busy}>
                <Power className="w-3.5 h-3.5 mr-1" /> Suspend
              </Button>
            )}
            {canActivateSelected && (
              <Button size="sm" variant="outline" onClick={() => runBulk("activate")} disabled={busy}>
                <Power className="w-3.5 h-3.5 mr-1" /> Activate
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-slate-500 text-left">
                <th className="px-4 py-3 w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                </th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Modules</th>
                <th className="px-4 py-3 font-medium">Sign-in Date</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {empty && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">No members found.</td>
                </tr>
              )}
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selected.has(`user:${user.id}`)}
                      onCheckedChange={() => toggleRow(`user:${user.id}`)}
                      aria-label={`Select ${user.email}`}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{user.full_name || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{user.email}</td>
                  <td className="px-4 py-3">
                    {user.role === "admin" ? (
                      <span className="text-slate-600">Admin</span>
                    ) : (
                      <UserRoleSelect
                        user={user}
                        disabled={currentUser?.id === user.id}
                        onChanged={loadUsers}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge label={user.status === "suspended" ? "Suspended" : "Active"} />
                  </td>
                  <td className="px-4 py-3">
                    <MemberModules
                      all={isAdminUser(user)}
                      modules={effectiveModuleKeys(user)}
                      note={!isAdminUser(user) && !hasAssignedModules(user) ? "default" : undefined}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {user.created_date ? format(new Date(user.created_date), "d MMM yyyy") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {currentUser?.id !== user.id && (
                        <button
                          title="Edit role & permissions"
                          onClick={() => setEditUser(user)}
                          disabled={busy}
                          className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-md transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      {user.role !== "admin" && (
                        <button
                          title={user.status === "suspended" ? "Reactivate" : "Suspend"}
                          onClick={() => setMemberStatus(user, user.status === "suspended" ? "active" : "suspended")}
                          disabled={busy}
                          className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-md transition-colors"
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      )}
                      {user.role !== "admin" && currentUser?.id !== user.id && (
                        <button
                          title="Remove member"
                          onClick={() => setDeleteUser(user)}
                          disabled={busy}
                          className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredInvites.map((invite) => (
                <tr key={invite.id} className="bg-amber-50/40 hover:bg-amber-50/70">
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selected.has(`invite:${invite.id}`)}
                      onCheckedChange={() => toggleRow(`invite:${invite.id}`)}
                      aria-label={`Select ${invite.email}`}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-400 italic">Invited — awaiting sign-in</td>
                  <td className="px-4 py-3 text-slate-600">{invite.email}</td>
                  <td className="px-4 py-3 text-slate-600 capitalize">{invite.role || "user"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge label={invite.status === "pending" ? "Awaiting approval" : "Invited"} />
                  </td>
                  <td className="px-4 py-3">
                    <MemberModules
                      all={invite.role === "admin"}
                      modules={inviteModuleKeys(invite)}
                      note="applies on first sign-in"
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-400">—</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {invite.status === "pending" && (
                        <button
                          title="Approve"
                          onClick={() => approveInvite(invite)}
                          disabled={busy}
                          className="text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-md transition-colors"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        title="Revoke invitation"
                        onClick={() => revokeInvite(invite)}
                        disabled={busy}
                        className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-md transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editUser && (
        <MemberEditDialog
          user={editUser}
          disabled={currentUser?.id === editUser.id}
          onClose={() => setEditUser(null)}
          onChanged={loadUsers}
        />
      )}
      {deleteUser && (
        <MemberDeleteDialog
          user={deleteUser}
          onClose={() => setDeleteUser(null)}
          onDeleted={loadAll}
        />
      )}
    </div>
  );
}