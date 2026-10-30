import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Field from "@/components/planning/Field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { dialogClass, inputClass, selectClass, primaryButton, subtleButton, panelClass, labelClass } from "@/components/planning/styles";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { actingUserName } from "@/lib/permissions";
import { num } from "@/lib/planning";
import { productionLines } from "@/lib/shiftLogConstants";
import { todayStr } from "@/lib/warehouse";
import {
  DISPOSITIONS, SHIFTS, canApproveRework, fmtKg, logYieldAudit, nextReworkLotId, outputKgFor, reworkPctFor,
} from "@/lib/yieldLoss";

export default function ReworkDialog({ open, onClose, settings, records = [], products = [], yields = [], reworks = [], onSaved }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({
    rework_date: todayStr(), shift_type: "Morning", production_line: "", source_batch: "", quantity_kg: "",
    reason: "", disposition: "Reprocessed", reused_batch: "", reused_qty_kg: "",
    allergen_concern: false, halal_concern: false, qa_clearance: "Pending", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm({
      rework_date: todayStr(), shift_type: "Morning", production_line: "", source_batch: "", quantity_kg: "",
      reason: settings.rework_reasons?.[0] || "Other", disposition: "Reprocessed", reused_batch: "", reused_qty_kg: "",
      allergen_concern: false, halal_concern: false, qa_clearance: "Pending", notes: "",
    });
  }, [open, settings.rework_reasons]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const sourceRecord = records.find((r) => r.batch_number === form.source_batch) || null;
  const product = products.find((p) => p.id === sourceRecord?.product_id) || null;
  const yieldRecord = yields.find((y) => y.batch_number === form.source_batch) || null;
  const batchOutputKg = num(yieldRecord?.output_kg) ||
    outputKgFor({ cartons: sourceRecord?.quantity_cartons, cartonSize: product?.carton_size, netWeightG: product?.target_net_weight_g });
  const pct = reworkPctFor(form.quantity_kg, batchOutputKg);
  const exceeds = batchOutputKg > 0 && pct > num(settings.max_rework_pct);
  const lotId = useMemo(() => nextReworkLotId(reworks, form.rework_date), [reworks, form.rework_date]);

  const save = async () => {
    if (!form.source_batch) return setError("Select the source batch.");
    if (!(num(form.quantity_kg) > 0)) return setError("Enter the rework quantity in kg.");
    if (!form.reason) return setError("Select a rework reason.");
    if (form.disposition === "Reused in new batch" && !form.reused_batch) return setError("Select the batch the rework is used in.");
    setSaving(true);
    setError("");
    try {
      const payload = {
        rework_lot_id: lotId,
        rework_date: form.rework_date,
        shift_type: form.shift_type,
        production_line: form.production_line || sourceRecord?.machine || "",
        source_batch: form.source_batch,
        product_id: sourceRecord?.product_id || "",
        product_code: sourceRecord?.product_code || "",
        product_name: sourceRecord?.product_name || "",
        quantity_kg: num(form.quantity_kg),
        batch_output_kg: Math.round(batchOutputKg * 100) / 100,
        rework_pct: pct,
        exceeds_max: exceeds,
        reason: form.reason,
        disposition: form.disposition,
        reused_batch: form.disposition === "Reused in new batch" ? form.reused_batch : "",
        reused_qty_kg: form.disposition === "Reused in new batch" ? num(form.reused_qty_kg) : 0,
        allergen_concern: !!form.allergen_concern,
        halal_concern: !!form.halal_concern,
        qa_clearance: canApproveRework(user) ? form.qa_clearance : "Pending",
        qa_approved_by: canApproveRework(user) && form.qa_clearance !== "Pending" ? actingUserName(user) : "",
        qa_approved_date: canApproveRework(user) && form.qa_clearance !== "Pending" ? new Date().toISOString() : "",
        status: "Open",
        notes: form.notes.trim(),
      };
      const created = await base44.entities.ReworkRecord.create(payload);
      await logYieldAudit({
        user,
        action: "Created",
        recordId: created?.id || lotId,
        details: `Rework ${lotId} from batch ${form.source_batch}: ${fmtKg(payload.quantity_kg)} · ${payload.reason} · ${payload.disposition}${payload.reused_batch ? ` → ${payload.reused_batch}` : ""}`,
        newValue: exceeds ? "Above maximum rework %" : "Within maximum rework %",
      });
      toast({ title: "Rework recorded", description: `${lotId}${exceeds ? " · above the maximum rework %" : ""}` });
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e?.message || "Could not save the rework record.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={dialogClass}>
        <DialogHeader>
          <DialogTitle className="text-white">New Rework Record · {lotId}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Date">
            <Input type="date" value={form.rework_date} onChange={(e) => set("rework_date", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Shift">
            <Select value={form.shift_type} onValueChange={(v) => set("shift_type", v)}>
              <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
              <SelectContent>{SHIFTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Line">
            <Select value={form.production_line || undefined} onValueChange={(v) => set("production_line", v)}>
              <SelectTrigger className={selectClass}><SelectValue placeholder="Select line" /></SelectTrigger>
              <SelectContent>{productionLines.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Source batch" className="sm:col-span-2">
            <Select value={form.source_batch || undefined} onValueChange={(v) => set("source_batch", v)}>
              <SelectTrigger className={selectClass}><SelectValue placeholder="Select batch" /></SelectTrigger>
              <SelectContent>
                {records.slice(0, 200).map((r) => <SelectItem key={r.id} value={r.batch_number}>{r.batch_number} — {r.product_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Quantity (kg)">
            <Input type="number" min="0" step="0.01" value={form.quantity_kg} onChange={(e) => set("quantity_kg", e.target.value)} className={inputClass} placeholder="0" />
          </Field>
          <Field label="Reason" hint="Managed in Settings">
            <Select value={form.reason || undefined} onValueChange={(v) => set("reason", v)}>
              <SelectTrigger className={selectClass}><SelectValue placeholder="Select reason" /></SelectTrigger>
              <SelectContent>{(settings.rework_reasons || []).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Disposition">
            <Select value={form.disposition} onValueChange={(v) => set("disposition", v)}>
              <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
              <SelectContent>{DISPOSITIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          {form.disposition === "Reused in new batch" && (
            <>
              <Field label="Used in batch">
                <Select value={form.reused_batch || undefined} onValueChange={(v) => set("reused_batch", v)}>
                  <SelectTrigger className={selectClass}><SelectValue placeholder="Select batch" /></SelectTrigger>
                  <SelectContent>
                    {records.filter((r) => r.batch_number !== form.source_batch).slice(0, 200).map((r) => (
                      <SelectItem key={r.id} value={r.batch_number}>{r.batch_number}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Quantity used (kg)">
                <Input type="number" min="0" step="0.01" value={form.reused_qty_kg} onChange={(e) => set("reused_qty_kg", e.target.value)} className={inputClass} placeholder="0" />
              </Field>
            </>
          )}
        </div>

        <div className={`${panelClass} p-3 grid grid-cols-2 sm:grid-cols-3 gap-2`}>
          <div><p className={labelClass}>Batch output</p><p className="text-white text-sm font-semibold">{batchOutputKg ? fmtKg(batchOutputKg) : "unknown"}</p></div>
          <div><p className={labelClass}>Rework % of batch</p><p className={`text-sm font-semibold ${exceeds ? "text-[#ff4d4d]" : "text-[#00ff9d]"}`}>{pct}%</p></div>
          <div><p className={labelClass}>Maximum allowed</p><p className="text-white text-sm font-semibold">{settings.max_rework_pct}%</p></div>
        </div>
        {exceeds && <p className="text-xs text-[#ff4d4d]">This rework is above the maximum set in Settings — it will be flagged for QA.</p>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <label className="flex items-center gap-2 text-xs text-[#a0aec0]">
            <Checkbox checked={form.allergen_concern} onCheckedChange={(v) => set("allergen_concern", !!v)} />
            Allergen concern
          </label>
          <label className="flex items-center gap-2 text-xs text-[#a0aec0]">
            <Checkbox checked={form.halal_concern} onCheckedChange={(v) => set("halal_concern", !!v)} />
            Halal concern
          </label>
          {canApproveRework(user) ? (
            <Field label="QA clearance">
              <Select value={form.qa_clearance} onValueChange={(v) => set("qa_clearance", v)}>
                <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Cleared">Cleared</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <p className="text-[11px] text-[#ff9f43]">QA approval is recorded by QA, a manager or an Admin.</p>
          )}
        </div>

        {(form.allergen_concern || form.halal_concern) && (
          <p className="text-xs text-[#ff9f43]">Allergen / halal concerns must be cleared by QA before this rework is reused.</p>
        )}

        <Field label="Notes">
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} className={`${inputClass} min-h-[60px]`} placeholder="Optional" />
        </Field>

        {error && <p className="text-sm text-[#ff4d4d]">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className={subtleButton}>Cancel</Button>
          <Button onClick={save} disabled={saving} className={primaryButton}>{saving ? "Saving..." : "Save rework"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}