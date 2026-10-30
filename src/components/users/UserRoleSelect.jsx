import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

// Administrator-only control for another user's app role.
export default function UserRoleSelect({ user, disabled, onChanged }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const change = async (role) => {
    if (role === user.role) return;
    setSaving(true);
    try {
      await base44.functions.invoke("setUserRole", { userId: user.id, role });
      toast({ title: "Role updated", description: `${user.email} is now ${role}` });
      onChanged?.();
    } catch (e) {
      const message = e?.response?.data?.error || e?.message || "Role change failed";
      toast({ title: "Role change failed", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Select value={user.role || "user"} onValueChange={change} disabled={disabled || saving}>
      <SelectTrigger className="h-8 w-28" title={disabled ? "You cannot change your own role" : undefined}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="user">User</SelectItem>
        <SelectItem value="admin">Admin</SelectItem>
      </SelectContent>
    </Select>
  );
}