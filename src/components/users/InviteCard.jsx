import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Mail, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { ASSIGNABLE_MODULE_KEYS, MODULES, USER_MODULE_KEYS } from "@/lib/permissions";

// Invitation card. The modules chosen here are stored on the invitation and applied to the
// account the first time the invited person opens the app. The platform email goes out
// immediately, but the person only reaches the dashboard once an administrator approves
// the invitation.
export default function InviteCard({ onInvited }) {
  const { user: currentUser } = useAuth();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [modules, setModules] = useState(USER_MODULE_KEYS);
  const [warnNoModules, setWarnNoModules] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const isAdminRole = role === "admin";
  const moduleOptions = MODULES.filter((m) => ASSIGNABLE_MODULE_KEYS.includes(m.key));

  const toggleModule = (key) => {
    setWarnNoModules(false);
    setModules((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const send = async (confirmed = false) => {
    setError("");
    setNotice("");
    if (!email.trim()) return;
    // A clear warning before sending an invitation that carries no modules.
    if (!isAdminRole && modules.length === 0 && !confirmed) {
      setWarnNoModules(true);
      return;
    }
    setInviting(true);
    try {
      const address = email.trim().toLowerCase();
      const assigned = isAdminRole ? [] : modules;
      await base44.users.inviteUser(address, role);
      // Track the invitation here so it appears in the list straight away, carrying the
      // modules that will be applied to the account on first sign-in.
      const found = await base44.entities.UserInvite.filter({ email: address, status: "pending" });
      const items = Array.isArray(found) ? found : found?.items || [];
      const payload = { email: address, role, status: "pending", permissions: assigned, invited_by: currentUser?.email || "" };
      if (items.length) await base44.entities.UserInvite.update(items[0].id, payload);
      else await base44.entities.UserInvite.create(payload);
      setEmail("");
      setWarnNoModules(false);
      let sent = `Invitation sent to ${address}. Administrators can open every module.`;
      if (!isAdminRole) {
        sent = assigned.length
          ? `Invitation sent to ${address} with ${assigned.length} module${assigned.length === 1 ? "" : "s"}. They can sign in once you approve the invitation.`
          : `Invitation sent to ${address} with the default pages only. They can sign in once you approve the invitation.`;
      }
      setNotice(sent);
      onInvited?.();
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "Failed to invite user");
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
          <UserPlus className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Invite New User</h3>
          <p className="text-sm text-slate-500">Choose the modules the invitation carries — invited users still require approval</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="user@example.com"
            className="pl-9"
          />
        </div>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4">
        <label className="text-sm font-medium text-slate-700">Modules for this invitation</label>
        {isAdminRole ? (
          <p className="text-xs text-slate-400 mt-1">Administrators can open every module, so no selection is needed.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 border border-slate-200 rounded-lg p-3 mt-2">
            {moduleOptions.map((m) => (
              <label key={m.key} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <Checkbox
                  checked={modules.includes(m.key)}
                  onCheckedChange={() => toggleModule(m.key)}
                  disabled={inviting}
                />
                {m.label}
              </label>
            ))}
          </div>
        )}
        {warnNoModules && (
          <div className="flex flex-wrap items-center gap-2 mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 flex-1">
              No modules are selected. {email.trim() || "This person"} would only get the default pages (Dashboard, Shift
              Log, Operation Record). Select the modules they need, or send without any.
            </p>
            <Button size="sm" variant="outline" onClick={() => send(true)} disabled={inviting}>
              Send anyway
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mt-4">
        <Button onClick={() => send()} disabled={inviting || !email.trim()} className="bg-sky-600 hover:bg-sky-700 text-white">
          <UserPlus className="w-4 h-4 mr-1" />
          {inviting ? "Inviting..." : "Send Invite"}
        </Button>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        {notice && <p className="text-green-600 text-sm">{notice}</p>}
      </div>
    </div>
  );
}