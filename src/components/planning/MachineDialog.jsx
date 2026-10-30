import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Field from "@/components/planning/Field";
import { MACHINE_STATUSES, logPlanningAudit, num } from "@/lib/planning";
import { dialogClass, inputClass, selectClass, primaryButton, subtleButton } from "@/components/planning/styles";

// Machine names are picked from the production line names the downtime page uses,
// so a machine always matches a line.
export default function MachineDialog({ open, onClose, machine, availableNames = [], onSaved }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", location: "", capacity_cph: "", status: "Active", notes: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm(
      machine
        ? { name: machine.name || "", location: machine.location || "", capacity_cph: machine.capacity_cph ?? "", status: machine.status || "Active", notes: machine.notes || "" }
        : { name: "", location: "Plant 1", capacity_cph: "", status: "Active", notes: "" }
    );
  }, [open, machine]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!form.name) return setError("Select the machine / production line.");
    setSaving(true);
    setError("");
    const payload = {
      name: form.name,
      location: form.location || "",
      capacity_cph: num(form.capacity_cph),
      status: form.status || "Active",
      notes: form.notes || "",
    };
    try {
      if (machine) await base44.entities.Machine.update(machine.id, payload);
      else await base44.entities.Machine.create(payload);
      await logPlanningAudit({
        user,
        module: "Machines",
        action: machine ? "Updated" : "Created",
        recordId: payload.name,
        details: `Machine ${payload.name} — ${payload.status}, ${num(payload.capacity_cph)} cartons/hour`,
        newValue: payload.status,
      });
      toast({ title: machine ? "Machine updated" : "Machine added", description: payload.name });
      onSaved?.();
    } catch (e) {
      setError(e?.message || "Could not save the machine.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={`${dialogClass} max-w-lg`}>
        <DialogHeader>
          <DialogTitle className="text-white">{machine ? machine.name : "Add Machine"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Field label="Machine / Production Line">
            {machine ? (
              <Input value={form.name} disabled className={`${inputClass} opacity-70`} />
            ) : availableNames.length === 0 ? (
              <p className="text-xs text-[#ff9f43]">Every production line already has a machine.</p>
            ) : (
              <Select value={form.name || undefined} onValueChange={(v) => set("name", v)}>
                <SelectTrigger className={selectClass}><SelectValue placeholder="Select production line" /></SelectTrigger>
                <SelectContent>
                  {availableNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Location">
              <Input value={form.location} onChange={(e) => set("location", e.target.value)} className={inputClass} placeholder="Plant 1" />
            </Field>
            <Field label="Capacity (cartons per hour)">
              <Input type="number" min="0" value={form.capacity_cph} onChange={(e) => set("capacity_cph", e.target.value)} className={inputClass} placeholder="1200" />
            </Field>
            <Field label="Status" className="sm:col-span-2">
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MACHINE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Notes">
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} className={`${inputClass} min-h-[60px]`} placeholder="Optional" />
          </Field>
        </div>

        {error && <p className="text-sm text-[#ff4d4d]">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className={subtleButton}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.name} className={primaryButton}>{saving ? "Saving..." : "Save machine"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}