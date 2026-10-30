import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Loader2 } from "lucide-react";
import { num } from "@/lib/planning";
import { eventStamp } from "@/lib/warehouse";
import { actingUserName } from "@/lib/permissions";
import {
  addMinutes, fmtDateTime, isUnderMaintenance, logProductionAudit, overlapsOnMachine, runMinutes,
} from "@/lib/production";
import { primaryButton, subtleButton, labelClass } from "@/components/planning/styles";

// Confirms a move made on the schedule. Every move needs a reason, and the
// clashes on the target machine are shown before it is saved.
export default function PlanChangeDialog({ open, onClose, order, target, machines = [], orders = [], user, onSaved }) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setSaving(false);
  }, [open]);

  const machine = target?.machine || null;
  const startIso = target?.startIso || "";
  const durationMin = order
    ? Math.max(15, Math.round((new Date(order.planned_end || order.planned_start).getTime() - new Date(order.planned_start).getTime()) / 60000)) ||
      runMinutes(order.quantity_cartons, order.capacity_cph)
    : 0;
  const endIso = startIso ? addMinutes(startIso, durationMin) : "";
  const conflicts = order && machine && startIso ? overlapsOnMachine(orders, machine.name, startIso, endIso, order.id) : [];
  const maintenance = isUnderMaintenance(machine);

  const save = async () => {
    if (!order || !machine || !startIso) return;
    if (!reason.trim()) return toast({ title: "Give a reason for the plan change", variant: "destructive" });
    setSaving(true);
    try {
      const change = {
        changed_at: new Date().toISOString(),
        changed_by: actingUserName(user),
        reason: reason.trim(),
        from_machine: order.machine || "",
        to_machine: machine.name,
        from_start: order.planned_start || "",
        to_start: startIso,
      };
      await base44.entities.ProductionOrder.update(order.id, {
        machine: machine.name,
        machine_id: machine.id,
        capacity_cph: num(machine.capacity_cph) || num(order.capacity_cph),
        planned_start: startIso,
        planned_end: endIso,
        plan_changes: [...(order.plan_changes || []), change],
      });
      await logProductionAudit({
        user,
        action: "Rescheduled",
        recordId: order.id,
        details: `${order.order_number} moved to ${machine.name} at ${eventStamp(new Date(startIso))} — ${reason.trim()}`,
        oldValue: `${order.machine || "—"} · ${order.planned_start ? fmtDateTime(order.planned_start) : "—"}`,
        newValue: `${machine.name} · ${fmtDateTime(startIso)}`,
      });
      toast({ title: "Plan updated", description: `${order.order_number} moved to ${machine.name}.` });
      onSaved?.();
      onClose();
    } catch (e) {
      toast({ title: "Could not move the order", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#0b1018] border-[#1e2740] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Change the plan</DialogTitle>
          <p className="text-xs text-[#5f6b7f]">{order?.order_number} · {order?.product_name}</p>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={labelClass}>From</p>
              <p className="text-[#a0aec0]">{order?.machine || "—"}</p>
              <p className="text-xs text-[#5f6b7f]">{order?.planned_start ? fmtDateTime(order.planned_start) : "—"}</p>
            </div>
            <div>
              <p className={labelClass}>To</p>
              <p className="text-white">{machine?.name || "—"}</p>
              <p className="text-xs text-[#5f6b7f]">{startIso ? fmtDateTime(startIso) : "—"}</p>
            </div>
          </div>

          {(maintenance || conflicts.length > 0) && (
            <div className="rounded-lg border border-[#ff9f43]/40 bg-[#ff9f43]/10 p-3 flex gap-2">
              <AlertTriangle className="w-4 h-4 text-[#ff9f43] shrink-0 mt-0.5" />
              <div className="text-xs text-[#ffb46b] space-y-1">
                {maintenance && <p>{machine?.name} is under maintenance.</p>}
                {conflicts.length > 0 && <p>Overlaps {conflicts.map((o) => o.order_number).join(", ")} on this machine.</p>}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className={labelClass}>Reason for the change</label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="bg-[#0a0e17] border-[#1e2740] text-white min-h-[70px]" placeholder="e.g. Changeover running late, moved to SA03" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className={subtleButton} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className={primaryButton}>
            {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            {saving ? "Saving..." : "Move order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}