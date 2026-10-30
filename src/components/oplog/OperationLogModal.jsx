import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calculateOTMetrics } from "@/lib/otCalculations";

const objectives = ["Production Catch-up", "Maintenance", "Cleaning", "Changeover", "Quality Issue", "Trial Run", "To complete the day's order"];

function Field({ label, children }) {
  return (
    <div>
      <Label className="text-xs text-slate-500 mb-1 block">{label}</Label>
      {children}
    </div>
  );
}

function SummaryItem({ label, value, color = "text-slate-800" }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-sm font-semibold ${color}`}>{value}</p>
    </div>
  );
}

const defaultForm = {
  ot_date: new Date().toISOString().split("T")[0],
  production_line: "",
  product_sku: "",
  task: "",
  staff_count: 1,
  staff_name: "",
  ot_objective: "Production Catch-up",
  ot_start: "",
  ot_end: "",
  hourly_ot_rate: 12,
  planned_ot_qty: "",
  actual_good_output: 0,
  rejected_wasted_qty: 0,
  downtime_min: 0,
  record_batch: "current",
};

export default function OperationLogModal({ open, onClose, onSave, editData }) {
  const [formData, setFormData] = useState(defaultForm);

  useEffect(() => {
    if (open) {
      if (editData) {
        setFormData({
          ...editData,
          planned_ot_qty: editData.planned_ot_qty || "",
          ot_start: editData.ot_start ? editData.ot_start.substring(0, 16) : "",
          ot_end: editData.ot_end ? editData.ot_end.substring(0, 16) : "",
        });
      } else {
        setFormData(defaultForm);
      }
    }
  }, [open, editData]);

  const m = calculateOTMetrics(formData);
  const update = (key, value) => setFormData((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = () => {
    if (!formData.production_line || !formData.product_sku) return;
    onSave({
      ...formData,
      staff_count: Number(formData.staff_count) || 0,
      hourly_ot_rate: Number(formData.hourly_ot_rate) || 0,
      planned_ot_qty: Number(formData.planned_ot_qty) || 0,
      actual_good_output: Number(formData.actual_good_output) || 0,
      rejected_wasted_qty: Number(formData.rejected_wasted_qty) || 0,
      downtime_min: Number(formData.downtime_min) || 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editData ? "Edit Operation Log Entry" : "New Operation Log Entry"}</DialogTitle>
        </DialogHeader>

        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-2">Shift Details</h4>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Date">
              <Input type="date" value={formData.ot_date} onChange={(e) => update("ot_date", e.target.value)} />
            </Field>
            <Field label="Line">
              <Input value={formData.production_line} onChange={(e) => update("production_line", e.target.value)} placeholder="Pasta Pouch Packing" />
            </Field>
            <Field label="Product / SKU">
              <Input value={formData.product_sku} onChange={(e) => update("product_sku", e.target.value)} placeholder="RASTO CARBONARA POUCH 220GM" />
            </Field>
            <Field label="Task">
              <Input value={formData.task} onChange={(e) => update("task", e.target.value)} placeholder="Filling & Packing" />
            </Field>
            <Field label="Staff Count">
              <Input type="number" value={formData.staff_count} onChange={(e) => update("staff_count", e.target.value)} />
            </Field>
            <Field label="Name">
              <Input value={formData.staff_name} onChange={(e) => update("staff_name", e.target.value)} placeholder="Supervisor name" />
            </Field>
            <Field label="Objective">
              <Select value={formData.ot_objective} onValueChange={(v) => update("ot_objective", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {objectives.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-2">Timing</h4>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Start">
              <Input type="datetime-local" value={formData.ot_start} onChange={(e) => update("ot_start", e.target.value)} />
            </Field>
            <Field label="End">
              <Input type="datetime-local" value={formData.ot_end} onChange={(e) => update("ot_end", e.target.value)} />
            </Field>
            <Field label="Hourly Rate (RM)">
              <Input type="number" step="0.01" value={formData.hourly_ot_rate} onChange={(e) => update("hourly_ot_rate", e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <SummaryItem label="OT Hrs (after 5pm)" value={m.ot_duration_hours.toFixed(2)} />
            <SummaryItem label="OT Man-Hours" value={m.ot_man_hours.toFixed(1)} />
            <SummaryItem label="OT Spend" value={`RM ${m.expenditure_ot_man_hr.toFixed(2)}`} color="text-amber-600" />
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-2">Production Output</h4>
          <div className="grid grid-cols-4 gap-3">
            <Field label="Planned Qty">
              <Input type="number" value={formData.planned_ot_qty} onChange={(e) => update("planned_ot_qty", e.target.value)} placeholder="—" />
            </Field>
            <Field label="Actual Good Output">
              <Input type="number" value={formData.actual_good_output} onChange={(e) => update("actual_good_output", e.target.value)} />
            </Field>
            <Field label="Rejected / Wasted Qty">
              <Input type="number" value={formData.rejected_wasted_qty} onChange={(e) => update("rejected_wasted_qty", e.target.value)} />
            </Field>
            <Field label="Downtime (min)">
              <Input type="number" value={formData.downtime_min} onChange={(e) => update("downtime_min", e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <SummaryItem label="Quality Yield %" value={`${m.ot_quality_yield_pct.toFixed(1)}%`} color={m.ot_quality_yield_pct >= 95 ? "text-green-600" : "text-red-500"} />
            <SummaryItem label="Output Variance" value={m.output_variance.toLocaleString()} color={m.output_variance >= 0 ? "text-green-600" : "text-red-500"} />
            <SummaryItem label="Achievement %" value={`${m.achievement_pct.toFixed(1)}%`} color={m.achievement_pct >= 90 ? "text-green-600" : "text-red-500"} />
            <SummaryItem label="Good Output / Man-Hr" value={m.good_output_per_man_hour.toFixed(1)} />
            <SummaryItem label="Actual UPM" value={m.actual_upm.toFixed(2)} />
            <SummaryItem label="Net Productive (hrs)" value={m.net_productive_ot_hours.toFixed(2)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} className="bg-sky-600 hover:bg-sky-700 text-white">{editData ? "Update Operation Log" : "Save Operation Log"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}