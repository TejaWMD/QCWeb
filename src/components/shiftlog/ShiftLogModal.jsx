import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, X, Calendar, Users, Clock, DollarSign, Plus, Trash2, Timer, CheckCircle2 } from "lucide-react";
import { productionLines, wasteComponents, productNames } from "@/lib/shiftLogConstants";

const SectionLabel = ({ children }) => (
  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 mt-5">{children}</p>
);

const Field = ({ label, children }) => (
  <div>
    <Label className="text-sm text-gray-500 font-normal mb-1.5 block">{label}</Label>
    {children}
  </div>
);

const NumberField = ({ label, icon: Icon, value, onChange, placeholder }) => (
  <Field label={label}>
    <div className="relative">
      {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />}
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        placeholder={placeholder}
        className={Icon ? "pl-9" : ""}
      />
    </div>
  </Field>
);

const taskChecklist = [
  { key: "task_filled_packed", label: "Filled & Packed" },
  { key: "task_capped", label: "Capped" },
  { key: "task_label_applied", label: "Label Applied" },
  { key: "task_carton_packed", label: "Carton Packed" },
  { key: "task_packed_in_container", label: "Packed in Container (3kg/4kg)" },
];

const calcHours = (start, end) => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  return diff / 60;
};

export default function ShiftLogModal({ open, onClose, onSave }) {
  const [form, setForm] = useState({
    shift_date: new Date().toISOString().split("T")[0],
    shift_type: "Morning",
    production_line: "SA01 - Milan/ Sufri Machine",
    task: "Carton Packing",
    staff_count: 1,
    planned_qty: "",
    actual_output: "",
    rejected_qty: "",
    product_type: "",
    product_name: "",
    batch_number: "",
    bottle_used: 0, bottle_waste: 0,
    jar_used: 0, jar_waste: 0,
    plastic_used: 0, plastic_waste: 0,
    pouch_used: 0, pouch_waste: 0,
    foil_used: 0, foil_waste: 0,
    cup_used: 0, cup_waste: 0,
    tub_used: 0, tub_waste: 0,
    cap_used: 0, cap_waste: 0,
    lid_used: 0, lid_waste: 0,
    packet_used: 0, packet_waste: 0,
    shrink_label_used: 0, shrink_label_waste: 0,
    label_used: 0, label_waste: 0,
    extra_sticker_used: 0, extra_sticker_waste: 0,
    carton_box_used: 0, carton_box_waste: 0,
    break_duration: 1,
    ot_duration_hours: 0,
    hourly_ot_rate: 12,
    task_filled_packed: false,
    task_capped: false,
    task_label_applied: false,
    task_carton_packed: false,
    task_packed_in_container: false,
  });
  const [staffNames, setStaffNames] = useState([""]);
  const [timeRows, setTimeRows] = useState([{ start: "08:00", end: "17:00", planned_qty: "", actual_output: "", rejected_qty: "" }]);
  const [saving, setSaving] = useState(false);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const dayName = form.shift_date
    ? new Date(form.shift_date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" })
    : "";

  const status = taskChecklist.every((t) => form[t.key]) ? "complete" : "incomplete";
  const checkedCount = taskChecklist.filter((t) => form[t.key]).length;

  const totalPlanned = timeRows.reduce((s, r) => s + (Number(r.planned_qty) || 0), 0);
  const totalActual = timeRows.reduce((s, r) => s + (Number(r.actual_output) || 0), 0);
  const totalRejected = timeRows.reduce((s, r) => s + (Number(r.rejected_qty) || 0), 0);
  const achieveRate = totalPlanned > 0 ? ((totalActual / totalPlanned) * 100).toFixed(1) : "0";
  const totalWaste = wasteComponents.reduce((s, c) => s + (Number(form[`${c.key}_waste`]) || 0), 0);
  const totalUsed = wasteComponents.reduce((s, c) => s + (Number(form[`${c.key}_used`]) || 0), 0);

  const grossHours = timeRows.reduce((s, r) => s + calcHours(r.start, r.end), 0);
  const breakHours = Number(form.break_duration) || 0;
  const netHours = Math.max(0, grossHours - breakHours);
  const OT_START = 17 * 60;
  const calcOtHours = (start, end) => {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const sMin = sh * 60 + sm;
    const eMin = eh * 60 + em;
    if (eMin <= sMin) {
      return Math.max(0, 1440 - Math.max(sMin, OT_START)) / 60;
    }
    if (eMin <= OT_START) return 0;
    return (eMin - Math.max(sMin, OT_START)) / 60;
  };
  const otHours = timeRows.reduce((s, r) => s + calcOtHours(r.start, r.end), 0);
  const latestEnd = timeRows.map((r) => r.end).filter(Boolean).sort().pop() || "";

  const otManHours = otHours * (Number(form.staff_count) || 0);
  const otSpend = otManHours * form.hourly_ot_rate;

  const addName = () => setStaffNames((arr) => [...arr, ""]);
  const removeName = (i) => setStaffNames((arr) => arr.filter((_, idx) => idx !== i));
  const updateName = (i, val) => setStaffNames((arr) => arr.map((n, idx) => (idx === i ? val : n)));

  const addTimeRow = () => setTimeRows((arr) => [...arr, { start: "", end: "", planned_qty: "", actual_output: "", rejected_qty: "" }]);
  const removeTimeRow = (i) => setTimeRows((arr) => arr.filter((_, idx) => idx !== i));
  const updateTimeRow = (i, key, val) => setTimeRows((arr) => arr.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));

  const handleSave = async () => {
    setSaving(true);
    try {
      const cleanedNames = staffNames.map((n) => n.trim()).filter(Boolean);
      await onSave({
        ...form,
        start_time: timeRows[0]?.start || "",
        end_time: latestEnd,
        staff_names: cleanedNames,
        staff_count: Number(form.staff_count) || 0,
        staff_name: cleanedNames.join(", "),
        break_duration: Number(form.break_duration) || 0,
        ot_duration_hours: Number(otHours.toFixed(2)) || 0,
        planned_qty: totalPlanned,
        actual_output: totalActual,
        rejected_qty: totalRejected,
        status,
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
            <ClipboardList className="w-5 h-5" />
            New Packaging Shift Log Entry
          </DialogTitle>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </DialogHeader>

        <div className="px-5 py-2 max-h-[60vh] overflow-y-auto">
          <SectionLabel>1. Shift &amp; Line Metadata</SectionLabel>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Shift Date">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
                  <Input
                    type="date"
                    value={form.shift_date}
                    onChange={(e) => set("shift_date", e.target.value)}
                    className="pl-9"
                  />
                </div>
                {dayName && (
                  <span className="text-sm font-semibold text-sky-700 bg-sky-50 px-3 py-2 rounded-md whitespace-nowrap">
                    {dayName}
                  </span>
                )}
              </div>
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
            <div className="col-span-2">
              <Field label="Production Line Code">
                <Select value={form.production_line} onValueChange={(v) => set("production_line", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {productionLines.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Staff Count">
                <Input type="number" min="0" value={form.staff_count} onChange={(e) => set("staff_count", Number(e.target.value))} placeholder="e.g. 5" className="max-w-[200px]" />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Staff Names (one per row)">
                <div className="space-y-2">
                  {staffNames.map((name, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={name}
                        onChange={(e) => updateName(i, e.target.value)}
                        placeholder={`Staff name ${i + 1}`}
                      />
                      {staffNames.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeName(i)} className="text-red-400 hover:text-red-600 shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addName} className="text-sky-600 border-sky-200 hover:bg-sky-50">
                    <Plus className="w-4 h-4 mr-1" /> Add name
                  </Button>
                </div>
              </Field>
            </div>
          </div>

          <SectionLabel>2. Product Details</SectionLabel>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Product Name">
              <Select value={form.product_name} onValueChange={(v) => set("product_name", v)}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {productNames.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Batch Number">
              <Input value={form.batch_number} onChange={(e) => set("batch_number", e.target.value)} placeholder="e.g. BN20261012" />
            </Field>
          </div>

          <SectionLabel>3. Task Checklist</SectionLabel>
          <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-4">
            {taskChecklist.map((t) => (
              <label key={t.key} className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={form[t.key]}
                  onCheckedChange={(c) => set(t.key, c === true)}
                />
                <span className="text-sm text-slate-700">{t.label}</span>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs">
            <span className="text-slate-500">Status:</span>
            <span className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded ${status === "complete" ? "text-green-700 bg-green-50" : "text-amber-700 bg-amber-50"}`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              {status === "complete" ? "Complete" : `Incomplete (${checkedCount}/5)`}
            </span>
          </div>

          <SectionLabel>4. Component Packaging Waste (Units Scrap)</SectionLabel>
          <div className="mb-3">
            <Field label="Type">
              <Input value={form.product_type} onChange={(e) => set("product_type", e.target.value)} placeholder="e.g. 1L, 200g" />
            </Field>
          </div>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Component</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600 w-28">Used</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600 w-28">Wasted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {wasteComponents.map((c) => (
                  <tr key={c.key}>
                    <td className="px-3 py-1.5 text-slate-700">{c.label}</td>
                    <td className="px-2 py-1.5">
                      <Input type="number" value={form[`${c.key}_used`]} onChange={(e) => set(`${c.key}_used`, Number(e.target.value))} className="h-8 text-right" placeholder="0" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input type="number" value={form[`${c.key}_waste`]} onChange={(e) => set(`${c.key}_waste`, Number(e.target.value))} className="h-8 text-right" placeholder="0" />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td className="px-3 py-2 font-semibold text-slate-700">Total</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-700">{totalUsed.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-semibold text-red-500">{totalWaste.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <SectionLabel>5. Labor Parameters</SectionLabel>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Field label="Break Duration">
              <Select value={String(form.break_duration)} onValueChange={(v) => set("break_duration", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">None</SelectItem>
                  <SelectItem value="1">1 hour</SelectItem>
                  <SelectItem value="1.5">1.5 hours</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Net Duration (hrs)">
              <Input value={netHours.toFixed(1)} readOnly className="bg-slate-50 font-semibold text-slate-700" />
            </Field>
          </div>
          <div className="border border-slate-200 rounded-lg overflow-x-auto mb-2">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Work Segment</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600 w-28">Start Time</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600 w-28">End Time</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600 w-20">Hours</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600 w-24">Planned Qty</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600 w-24">Actual Output</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600 w-24">Rejected Qty</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {timeRows.map((row, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5 text-slate-700">Segment {i + 1}</td>
                    <td className="px-2 py-1.5">
                      <Input type="time" value={row.start} onChange={(e) => updateTimeRow(i, "start", e.target.value)} className="h-8" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input type="time" value={row.end} onChange={(e) => updateTimeRow(i, "end", e.target.value)} className="h-8" />
                    </td>
                    <td className="px-3 py-1.5 text-right text-slate-700">{calcHours(row.start, row.end).toFixed(2)}</td>
                    <td className="px-2 py-1.5">
                      <Input type="number" value={row.planned_qty} onChange={(e) => updateTimeRow(i, "planned_qty", e.target.value)} className="h-8 text-right" placeholder="0" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input type="number" value={row.actual_output} onChange={(e) => updateTimeRow(i, "actual_output", e.target.value)} className="h-8 text-right" placeholder="0" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input type="number" value={row.rejected_qty} onChange={(e) => updateTimeRow(i, "rejected_qty", e.target.value)} className="h-8 text-right" placeholder="0" />
                    </td>
                    <td className="px-2 py-1.5">
                      {timeRows.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeTimeRow(i)} className="text-red-400 hover:text-red-600 h-8 w-8">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td className="px-3 py-2 font-semibold text-slate-700" colSpan={3}>Gross Duration</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-700">{grossHours.toFixed(2)} hrs</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-700">{totalPlanned.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-700">{totalActual.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-semibold text-red-500">{totalRejected.toLocaleString()}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <Button variant="outline" size="sm" onClick={addTimeRow} className="text-sky-600 border-sky-200 hover:bg-sky-50 mb-3">
            <Plus className="w-4 h-4 mr-1" /> Add time segment
          </Button>
          <Field label="Overtime Duration (auto)">
            <div className="relative max-w-sm">
              <Timer className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
              <Input
                value={otHours > 0 ? `${otHours.toFixed(2)} hrs (after 5pm)` : "0 hrs"}
                readOnly
                className={`pl-9 font-semibold ${otHours > 0 ? "text-amber-600 bg-amber-50" : "text-slate-500 bg-slate-50"}`}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">Auto-calculated as hours worked after 5:00 PM across all segments.</p>
          </Field>
        </div>

        <div className="px-5 py-3 bg-slate-100 border-y border-slate-200 flex items-center gap-6 text-sm flex-wrap">
          <span>Achieve Rate: <span className="font-bold text-sky-600">{achieveRate}%</span></span>
          <span>Total Waste: <span className="font-bold text-red-500">{totalWaste} Pcs</span></span>
          <span>Net Hours: <span className="font-bold text-slate-700">{netHours.toFixed(1)} hrs</span></span>
          <span>OT Hours: <span className="font-bold text-amber-600">{otHours.toFixed(2)} hrs</span></span>
          <span>OT Man-Hrs: <span className="font-bold text-slate-700">{otManHours.toFixed(1)} hrs</span></span>
          <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5 text-slate-400" />OT Spend: <span className="font-bold text-orange-500">RM {otSpend.toFixed(2)}</span></span>
        </div>

        <div className="px-5 py-4 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} className="text-gray-500">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-sky-600 hover:bg-sky-700 text-white">
            {saving ? "Saving..." : "Save Shift Record"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}