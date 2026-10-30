import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { ASSIGNABLE_MODULE_KEYS, MODULES, APP_ROLES, ROLE_PRESETS, effectiveModuleKeys } from "@/lib/permissions";
import { productionLines } from "@/lib/shiftLogConstants";

// Edits a member's role and the modules assigned to them. Saving here takes effect the
// next time that member opens a page — the app re-reads their account when a page is
// blocked, so no re-invitation is needed.
export default function MemberEditDialog({ user, disabled, onClose, onChanged }) {
  const { toast } = useToast();
  const [role, setRole] = useState(user?.role || "user");
  const [appRole, setAppRole] = useState("none");
  const [line, setLine] = useState("all");
  const [modules, setModules] = useState([]);
  const [saving, setSaving] = useState(false);

  const assignableKeys = (value) => effectiveModuleKeys(value).filter((key) => ASSIGNABLE_MODULE_KEYS.includes(key));

  useEffect(() => {
    setRole(user?.role || "user");
    setAppRole(user?.app_role || "none");
    setLine(user?.line || "all");
    setModules(assignableKeys(user));
  }, [user?.id]);

  if (!user) return null;

  const isAdminRole = role === "admin";
  const moduleOptions = MODULES.filter((m) => ASSIGNABLE_MODULE_KEYS.includes(m.key));

  const toggleModule = (key) => {
    setModules((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const save = async () => {
    const nextModules = ASSIGNABLE_MODULE_KEYS.filter((key) => modules.includes(key));
    const currentModules = assignableKeys(user);
    if (role === user.role && nextModules.join() === currentModules.join()) return onClose();

    setSaving(true);
    try {
      await base44.functions.invoke("setUserRole", {
        userId: user.id,
        role,
        permissions: nextModules,
        app_role: appRole === "none" ? null : appRole,
        line: line === "all" ? null : line,
      });
      toast({
        title: "Member updated",
        description: isAdminRole
          ? `${user.email} can now open every module.`
          : nextModules.length
            ? `${user.email} now has ${nextModules.length} module${nextModules.length === 1 ? "" : "s"}.`
            : `${user.email} now has no module access.`,
      });
      onClose();
      onChanged?.();
    } catch (e) {
      const message = e?.response?.data?.error || e?.message || "Update failed";
      toast({ title: "Update failed", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit member</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Role</label>
            <Select value={role} onValueChange={setRole} disabled={disabled || saving}>
              <SelectTrigger className="w-full mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            {disabled && <p className="text-xs text-slate-400 mt-1">You cannot change your own access.</p>}
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">FactoryOps Role</label>
            <Select
              value={appRole}
              onValueChange={(v) => {
                setAppRole(v);
                const preset = ROLE_PRESETS[v];
                if (preset) setModules(preset);
              }}
              disabled={disabled || saving || isAdminRole}
            >
              <SelectTrigger className="w-full mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No role (custom modules)</SelectItem>
                {APP_ROLES.map((r) => (
                  <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-400 mt-1">
              A role grants its fixed set of modules automatically: Operators enter production, downtime and defect data; Supervisors manage tasks; QA Officers manage HACCP, holds and CAPAs; Production Manager / MD sees everything and verifies closures.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Assigned Line</label>
            <Select value={line} onValueChange={setLine} disabled={disabled || saving}>
              <SelectTrigger className="w-full mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All lines</SelectItem>
                {productionLines.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-400 mt-1">Operators and Line Leaders enter data for their own line by default.</p>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Modules</label>
            {isAdminRole ? (
              <p className="text-xs text-slate-400 mt-1">Administrators can open every module, so no selection is needed.</p>
            ) : (
              <div className="mt-2 border border-slate-200 rounded-lg divide-y divide-slate-100">
                {moduleOptions.map((m) => (
                  <label key={m.key} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 cursor-pointer">
                    <Checkbox
                      checked={modules.includes(m.key)}
                      onCheckedChange={() => toggleModule(m.key)}
                      disabled={disabled || saving}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            )}
            {!isAdminRole && modules.length === 0 && (
              <p className="flex items-start gap-1.5 text-xs text-amber-600 mt-2">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                With no module selected, this member cannot open any page.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={disabled || saving}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}