import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Save, Pencil } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { productionLines, productNames, wasteComponents } from "@/lib/shiftLogConstants";

const TASK_CHECKLIST = [
  { key: "task_filled_packed", label: "Filled & Packed" },
  { key: "task_capped", label: "Capped" },
  { key: "task_label_applied", label: "Label Applied" },
  { key: "task_carton_packed", label: "Carton Packed" },
];

const toNamesArray = (record) => {
  if (Array.isArray(record.staff_names) && record.staff_names.length) return record.staff_names;
  if (record.staff_name) return record.staff_name.split(",").map((s) => s.trim()).filter(Boolean);
  return [""];
};

// Overtime runs past 17:00, across midnight if the shift ends there.
const calcOtHours = (start, end) => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const sMin = sh * 60 + sm;
  const eMin = eh * 60 + em;
  if (eMin <= sMin) return Math.max(0, 1440 - Math.max(sMin, 17 * 60)) / 60;
  if (eMin <= 17 * 60) return 0;
  return (eMin - Math.max(sMin, 17 * 60)) / 60;
};

export default function IncompleteRecordEditModal({ record, open, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [staffNames, setStaffNames] = useState([""]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!record) return;
    setForm({
      shift_date: record.shift_date || "",
      shift_type: record.shift_type || "Morning",
      production_line: record.production_line || productionLines[0],
      task: record.task || "Carton Packing",
      product_name: record.product_name || "",
      product_type: record.product_type || "",
      batch_number: record.batch_number || "",
      staff_count: record.staff_count ?? 1,
      start_time: record.start_time || "",
      end_time: record.end_time || "",
      break_duration: record.break_duration ?? 1,
      hourly_ot_rate: record.hourly_ot_rate ?? 12,
      planned_qty: record.planned_qty ?? 0,
      actual_output: record.actual_output ?? 0,
      rejected_qty: record.rejected_qty ?? 0,
      task_filled_packed: !!record.task_filled_packed,
      task_capped: !!record.task_capped,
      task_label_applied: !!record.task_label_applied,
      task_carton_packed: !!record.task_carton_packed,
    });
    setStaffNames(toNamesArray(record));
  }, [record]);

  if (!form) return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const status = TASK_CHECKLIST.every((t) => form[t.key]) ? "complete" : "incomplete";

  const handleSave = async () => {
    const cleaned = staffNames.map((n) => n.trim()).filter(Boolean);
    // Overtime is recomputed from the edited times; wastage details carry
    // over from the stored record because this modal does not edit them.
    const otHours = calcOtHours(form.start_time, form.end_time);
    const payload = {
      ...form,
      ot_duration_hours: Number(otHours.toFixed(2)) || 0,
      planned_cartons: record.planned_cartons ?? 0,
      pcs_per_carton: record.pcs_per_carton ?? 0,
      downtime_min: record.downtime_min ?? 0,
      downtime_remarks: record.downtime_remarks || "",
      ...Object.fromEntries(wasteComponents.map((c) => [`${c.key}_used`, Number(record[`${c.key}_used`]) || 0])),
      ...Object.fromEntries(wasteComponents.map((c) => [`${c.key}_waste`, Number(record[`${c.key}_waste`]) || 0])),
      staff_count: Number(form.staff_count) || 0,
      break_duration: Number(form.break_duration) || 0,
      hourly_ot_rate: Number(form.hourly_ot_rate) || 0,
      planned_qty: Number(form.planned_qty) || 0,
      actual_output: Number(form.actual_output) || 0,
      rejected_qty: Number(form.rejected_qty) || 0,
      staff_name: cleaned.join(", "),
      staff_names: cleaned,
      status,
    };
    setSaving(true);
    try {
      // Route through the shift log sync so the Operation, Overtime and
      // Wastage records stay linked to this session.
      const res = await base44.functions.invoke("recordShiftLog", { shiftLog: payload, shiftLogId: record.id });
      onSaved && onSaved(res?.data?.shiftLog || { ...record, ...payload });
      onClose();
    } catch (e) {
      alert("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-slate-800">Edit Shift Log</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Date">
            <Input type="date" value={form.shift_date} onChange={(e) => set("shift_date", e.target.value)} />
          </Field>
          <Field label="Shift">
            <Select value={form.shift_type} onValueChange={(v) => set("shift_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Morning">Morning</SelectItem>
                <SelectItem value="Night">Night</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Line #">
            <Select value={form.production_line} onValueChange={(v) => set("production_line", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {productionLines.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Product" required>
            <Select value={form.product_name} onValueChange={(v) => set("product_name", v)}>
              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {productNames.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Product Type / Size">
            <Input value={form.product_type} onChange={(e) => set("product_type", e.target.value)} placeholder="e.g. 1L, 200g" />
          </Field>
          <Field label="Lot # (Batch)" required>
            <Input value={form.batch_number} onChange={(e) => set("batch_number", e.target.value)} />
          </Field>
          <Field label="Staff Count" required>
            <Input type="number" min="1" value={form.staff_count} onChange={(e) => set("staff_count", e.target.value)} />
          </Field>
          <Field label="Start Time">
            <Input type="time" value={form.start_time} onChange={(e) => set("start_time", e.target.value)} />
          </Field>
          <Field label="End Time">
            <Input type="time" value={form.end_time} onChange={(e) => set("end_time", e.target.value)} />
          </Field>
          <Field label="Planned Qty">
            <Input type="number" value={form.planned_qty} onChange={(e) => set("planned_qty", e.target.value)} />
          </Field>
          <Field label="Actual Output">
            <Input type="number" value={form.actual_output} onChange={(e) => set("actual_output", e.target.value)} />
          </Field>
          <Field label="Rejected Qty">
            <Input type="number" value={form.rejected_qty} onChange={(e) => set("rejected_qty", e.target.value)} />
          </Field>
        </div>

        <Field label="Staff Names (one per row)" required>
          <div className="space-y-2">
            {staffNames.map((name, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={name} onChange={(e) => setStaffNames((a) => a.map((n, idx) => idx === i ? e.target.value : n))} placeholder={`Staff name ${i + 1}`} />
                {staffNames.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => setStaffNames((a) => a.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 shrink-0">
                    ✕
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setStaffNames((a) => [...a, ""])} className="text-sky-600 border-sky-200 hover:bg-sky-50">
              + Add name
            </Button>
          </div>
        </Field>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Task Checklist</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
            {TASK_CHECKLIST.map((t) => (
              <label key={t.key} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={form[t.key]} onCheckedChange={(c) => set(t.key, c === true)} />
                <span className="text-sm text-slate-700">{t.label}</span>
              </label>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-sky-600 hover:bg-sky-700 text-white">
            <Save className="w-4 h-4 mr-1" /> {saving ? "Saving..." : "Save Log"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, required }) {
  return (
    <div>
      <Label className="block text-xs font-medium text-slate-500 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}