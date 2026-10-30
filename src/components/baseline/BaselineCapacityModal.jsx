import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SlidersHorizontal, X } from "lucide-react";

const Section = ({ title, children }) => (
  <div className="mt-4 first:mt-0">
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{title}</p>
    {children}
  </div>
);

const Field = ({ label, children }) => (
  <div>
    <Label className="text-sm text-gray-500 font-normal mb-1.5 block">{label}</Label>
    {children}
  </div>
);

const defaults = {
  product_name: "", packing_line_code: "", thermal_state: "", line_setup: "",
  packaging_config_type: "", next_step: "", remark_downtime: "",
  machine_setup_time_min: "", acceptable_downtime_min: "", manpower_req: "",
  unit_per_cycle: "", unit_per_minute: "", theoretical_uph: "", adjusted_uph: "",
  changeover_complexity: "Low", remarks_viscosity: "", remarks_thermal: "", remarks_packaging: "",
};

export default function BaselineCapacityModal({ open, onClose, onSave, editData }) {
  const [form, setForm] = useState(defaults);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(editData ? { ...defaults, ...editData } : defaults);
  }, [open, editData]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const num = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
      await onSave({
        ...form,
        machine_setup_time_min: num(form.machine_setup_time_min),
        acceptable_downtime_min: num(form.acceptable_downtime_min),
        manpower_req: num(form.manpower_req),
        unit_per_minute: num(form.unit_per_minute),
        theoretical_uph: num(form.theoretical_uph),
        adjusted_uph: num(form.adjusted_uph),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden [&>button:last-of-type]:hidden">
        <DialogHeader className="bg-gray-900 px-5 py-4 flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-white flex items-center gap-2 text-base font-semibold">
            <SlidersHorizontal className="w-5 h-5" />
            {editData ? "Edit Baseline Record" : "New Baseline Record"}
          </DialogTitle>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </DialogHeader>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          <Section title="Product & Line">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Product Name"><Input value={form.product_name} onChange={(e) => set("product_name", e.target.value)} /></Field>
              <Field label="Packing Line Code"><Input value={form.packing_line_code} onChange={(e) => set("packing_line_code", e.target.value)} /></Field>
              <Field label="Thermal State / Viscosity Index"><Input value={form.thermal_state} onChange={(e) => set("thermal_state", e.target.value)} /></Field>
              <Field label="Line Setup"><Input value={form.line_setup} onChange={(e) => set("line_setup", e.target.value)} /></Field>
            </div>
          </Section>

          <Section title="Packaging Configuration">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Packaging Configuration Type"><Input value={form.packaging_config_type} onChange={(e) => set("packaging_config_type", e.target.value)} /></Field>
              <Field label="Next Step"><Input value={form.next_step} onChange={(e) => set("next_step", e.target.value)} /></Field>
            </div>
          </Section>

          <Section title="Time & Manpower">
            <div className="grid grid-cols-3 gap-4">
              <Field label="Machine Set-up Time (mins)"><Input type="number" value={form.machine_setup_time_min} onChange={(e) => set("machine_setup_time_min", e.target.value)} /></Field>
              <Field label="Acceptable Downtime (mins)"><Input type="number" value={form.acceptable_downtime_min} onChange={(e) => set("acceptable_downtime_min", e.target.value)} /></Field>
              <Field label="Manpower Req (Headcount)"><Input type="number" value={form.manpower_req} onChange={(e) => set("manpower_req", e.target.value)} /></Field>
            </div>
          </Section>

          <Section title="Throughput Rates">
            <div className="grid grid-cols-2 gap-4 mb-3">
              <Field label="Unit Per Cycle (UPC)"><Input value={form.unit_per_cycle} onChange={(e) => set("unit_per_cycle", e.target.value)} placeholder="e.g. 6 units/cycle" /></Field>
              <Field label="Unit Per Minute (UPM)"><Input type="number" value={form.unit_per_minute} onChange={(e) => set("unit_per_minute", e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Theoretical UPH"><Input type="number" value={form.theoretical_uph} onChange={(e) => set("theoretical_uph", e.target.value)} /></Field>
              <Field label="Adjusted / Estimated UPH"><Input type="number" value={form.adjusted_uph} onChange={(e) => set("adjusted_uph", e.target.value)} /></Field>
            </div>
          </Section>

          <Section title="Changeover & Remarks">
            <div className="grid grid-cols-2 gap-4 mb-3">
              <Field label="Changeover Complexity">
                <Select value={form.changeover_complexity} onValueChange={(v) => set("changeover_complexity", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Remarks 1 (Viscosity/Flow)"><Textarea rows={2} value={form.remarks_viscosity} onChange={(e) => set("remarks_viscosity", e.target.value)} /></Field>
            <div className="mt-3"><Field label="Remarks 2 (Thermal/Labeling)"><Textarea rows={2} value={form.remarks_thermal} onChange={(e) => set("remarks_thermal", e.target.value)} /></Field></div>
            <div className="mt-3"><Field label="Remark 3 (Packaging Flow)"><Textarea rows={2} value={form.remarks_packaging} onChange={(e) => set("remarks_packaging", e.target.value)} /></Field></div>
            <div className="mt-3"><Field label="Remark / Downtime"><Textarea rows={2} value={form.remark_downtime} onChange={(e) => set("remark_downtime", e.target.value)} /></Field></div>
          </Section>
        </div>

        <div className="px-5 py-4 flex justify-end gap-3 border-t border-slate-200">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-sky-600 hover:bg-sky-700 text-white">
            {saving ? "Saving..." : "Save Record"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}