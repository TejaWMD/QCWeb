import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { Calendar, Plus, Trash2, Timer, Save, ClipboardList, AlertTriangle, Recycle, CheckCircle2, Gauge } from "lucide-react";
import { productionLines, wasteComponents, productNames } from "@/lib/shiftLogConstants";
import IncompleteDataAlert from "@/components/shiftlog/IncompleteDataAlert";
import WastageGroupTable from "@/components/shiftlog/WastageGroupTable";
import WastagePickerRow from "@/components/shiftlog/WastagePickerRow";
import { pcsPerCarton } from "@/lib/packingConfig";

const primaryContainers = ["bottle", "jar", "plastic", "pouch", "foil", "cup", "tub", "packet"];
const closures = ["cap", "lid"];
const remainingComponents = wasteComponents.filter((c) => ![...primaryContainers, ...closures].includes(c.key));

const taskChecklist = [
{ key: "task_filled_packed", label: "Filled & Packed" },
{ key: "task_capped", label: "Capped" },
{ key: "task_label_applied", label: "Label Applied" },
{ key: "task_carton_packed", label: "Carton Packed" }];


const downtimeReasons = [
{ label: "Jamming", hint: "Bottle, cap, or pouch stuck" },
{ label: "Printer Error", hint: "Ink fault, bad code, ribbon snap" },
{ label: "No Materials", hint: "Waiting for caps, labels, or boxes" },
{ label: "No Product", hint: "Waiting for sauce supply" },
{ label: "Changeover", hint: "CIP, cleaning, rail setup approval" },
{ label: "Breakdown", hint: "Machine fault, technician called" },
{ label: "Others", hint: "Any other reason — specify in Remarks" }];


const calcMinutes = (start, end) => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let s = sh * 60 + sm;
  let e = eh * 60 + em;
  if (e < s) e += 1440;
  return Math.max(0, e - s);
};

const calcHours = (start, end) => calcMinutes(start, end) / 60;
const calcUpm = (start, end, actual) => {
  const h = calcHours(start, end);
  return h > 0 ? (Number(actual) || 0) / h / 60 : 0;
};

export default function ShiftLogDraft() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    shift_date: new Date().toISOString().split("T")[0],
    shift_type: "Morning",
    production_line: productionLines[0],
    task: "Carton Packing",
    supervisor: "",
    product_name: "",
    product_type: "",
    planned_cartons: "",
    pcs_per_carton: "",
    batch_number: "",
    staff_count: 1,
    break_duration: 1,
    hourly_ot_rate: 12,
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
    task_filled_packed: false,
    task_capped: false,
    task_label_applied: false,
    task_carton_packed: false
  });
  const [staffNames, setStaffNames] = useState([""]);
  const [timeRows, setTimeRows] = useState([{ start: "08:00", end: "17:00", actual_output: "", rejected_qty: "" }]);
  const [downtimeRows, setDowntimeRows] = useState([{ reason: "", start: "", end: "", remarks: "" }]);
  const [logRecords, setLogRecords] = useState([]);
  const [primaryContainer, setPrimaryContainer] = useState("");
  const [closure, setClosure] = useState("");
  const [outputUnit, setOutputUnit] = useState("units");

  useEffect(() => {
    base44.entities.ShiftLog.filter({}, { sort: "-created_date", limit: 100 }).
    then(({ items }) => setLogRecords(items)).
    catch(() => {});
  }, []);

  const handleDeleteLog = async (record) => {
    try {
      await base44.functions.invoke("deleteShiftLog", { shiftLogId: record.id });
      setLogRecords((prev) => prev.filter((r) => r.id !== record.id));
      toast({ title: "Record deleted", description: `${record.production_line} — ${record.shift_date} and its linked records` });
    } catch (e) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const dayName = form.shift_date ? new Date(form.shift_date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" }) : "";
  const checkedCount = taskChecklist.filter((t) => form[t.key]).length;
  const status = taskChecklist.every((t) => form[t.key]) ? "complete" : "incomplete";

  const pcsPerCartonValue = Number(form.pcs_per_carton) || 0;
  const totalPlanned = (Number(form.planned_cartons) || 0) * pcsPerCartonValue;
  const totalActual = timeRows.reduce((s, r) => s + (Number(r.actual_output) || 0), 0);
  const totalRejected = timeRows.reduce((s, r) => s + (Number(r.rejected_qty) || 0), 0);
  const achieveRate = totalPlanned > 0 ? (totalActual / totalPlanned * 100).toFixed(1) : "0";
  // Cartons for the batch: typed directly, or derived from units ÷ pcs per carton
  const totalCartons = outputUnit === "carton" ? Math.round(totalActual) : pcsPerCartonValue > 0 ? Math.round(totalActual / pcsPerCartonValue) : 0;

  const grossHours = timeRows.reduce((s, r) => s + calcHours(r.start, r.end), 0);
  const totalUpm = grossHours > 0 ? totalActual / grossHours / 60 : 0;
  const breakHours = Number(form.break_duration) || 0;
  const netHours = Math.max(0, grossHours - breakHours);
  const OT_START = 17 * 60;
  const calcOtHours = (start, end) => {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const sMin = sh * 60 + sm;
    const eMin = eh * 60 + em;
    if (eMin <= sMin) return Math.max(0, 1440 - Math.max(sMin, OT_START)) / 60;
    if (eMin <= OT_START) return 0;
    return (eMin - Math.max(sMin, OT_START)) / 60;
  };
  const otHours = timeRows.reduce((s, r) => s + calcOtHours(r.start, r.end), 0);
  const otManHours = otHours * (Number(form.staff_count) || 0);
  const otSpend = otManHours * form.hourly_ot_rate;
  const latestEnd = timeRows.map((r) => r.end).filter(Boolean).sort().pop() || "";

  const totalDowntime = downtimeRows.reduce((s, r) => s + calcMinutes(r.start, r.end), 0);
  const totalWaste = wasteComponents.reduce((s, c) => s + (Number(form[`${c.key}_waste`]) || 0), 0);
  const totalUsed = wasteComponents.reduce((s, c) => s + (Number(form[`${c.key}_used`]) || 0), 0);

  // Pcs per carton is read off the product name, e.g. "... 100G X 14 X 4" -> 56
  useEffect(() => {
    if (!form.product_name) return;
    setForm((f) => ({ ...f, pcs_per_carton: pcsPerCarton(form.product_name) || "" }));
  }, [form.product_name]);

  // Auto-calc Used for the selected primary container and closure from the batch output
  useEffect(() => {
    if (!primaryContainer) return;
    setForm((f) => ({ ...f, [`${primaryContainer}_used`]: totalActual }));
  }, [primaryContainer, totalActual]);
  useEffect(() => {
    if (!closure) return;
    setForm((f) => ({ ...f, [`${closure}_used`]: totalActual }));
  }, [closure, totalActual]);

  // Carton Box under Material Traceability & Wastage follows the batch carton count
  useEffect(() => {
    setForm((f) => ({ ...f, carton_box_used: totalCartons }));
  }, [totalCartons]);

  const changePrimary = (newKey) => {
    setForm((f) => primaryContainer ? { ...f, [`${primaryContainer}_used`]: 0, [`${primaryContainer}_waste`]: 0 } : f);
    setPrimaryContainer(newKey);
  };
  const changeClosure = (newKey) => {
    setForm((f) => closure ? { ...f, [`${closure}_used`]: 0, [`${closure}_waste`]: 0 } : f);
    setClosure(newKey);
  };

  const addName = () => setStaffNames((a) => [...a, ""]);
  const removeName = (i) => setStaffNames((a) => a.filter((_, idx) => idx !== i));
  const updateName = (i, v) => setStaffNames((a) => a.map((n, idx) => idx === i ? v : n));

  const addTimeRow = () => setTimeRows((a) => [...a, { start: "", end: "", actual_output: "", rejected_qty: "" }]);
  const removeTimeRow = (i) => setTimeRows((a) => a.filter((_, idx) => idx !== i));
  const updateTimeRow = (i, k, v) => setTimeRows((a) => a.map((r, idx) => idx === i ? { ...r, [k]: v } : r));

  const addDowntime = () => setDowntimeRows((a) => [...a, { reason: "", start: "", end: "", remarks: "" }]);
  const removeDowntime = (i) => setDowntimeRows((a) => a.filter((_, idx) => idx !== i));
  const updateDowntime = (i, k, v) => setDowntimeRows((a) => a.map((r, idx) => idx === i ? { ...r, [k]: v } : r));

  const handleSave = async () => {
    const cleanedNames = staffNames.map((n) => n.trim()).filter(Boolean);
    const errors = [];
    if (!form.product_name) errors.push("Product");
    if (!form.batch_number.trim()) errors.push("Lot # (Batch)");
    if (!form.staff_count || Number(form.staff_count) < 1) errors.push("Staff Count");
    if (cleanedNames.length === 0) errors.push("Staff Names");
    if (!form.planned_cartons.toString().trim()) errors.push("Planned Qty (Carton)");
    if (!pcsPerCartonValue) errors.push("Pcs per Carton");
    if (!timeRows.every((r) => r.start && r.end && r.actual_output !== "")) errors.push("Work Segments (Start, End & Actual per row)");
    if (!taskChecklist.some((t) => form[t.key])) errors.push("Task Checklist (at least 1 item)");
    const hasWaste = wasteComponents.some((c) => (Number(form[`${c.key}_used`]) || 0) > 0 || (Number(form[`${c.key}_waste`]) || 0) > 0);
    if (!hasWaste) errors.push("at least 1 Wastage component");
    if (errors.length) {
      toast({ title: "Incomplete log", description: `Please fill: ${errors.join(", ")}`, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const downtimeRemarks = downtimeRows.
      filter((r) => r.reason || r.start).
      map((r) => `${r.reason || "—"} (${r.start || ""}-${r.end || ""}, ${calcMinutes(r.start, r.end)} min)${r.remarks ? `: ${r.remarks}` : ""}`).
      join("; ");
      const shiftLogPayload = {
        shift_date: form.shift_date,
        shift_type: form.shift_type,
        production_line: form.production_line,
        task: form.task,
        product_name: form.product_name,
        product_type: form.product_type,
        batch_number: form.batch_number,
        staff_count: Number(form.staff_count) || 0,
        staff_name: cleanedNames.join(", "),
        staff_names: cleanedNames,
        start_time: timeRows[0]?.start || "",
        end_time: latestEnd,
        break_duration: Number(form.break_duration) || 0,
        ot_duration_hours: Number(otHours.toFixed(2)) || 0,
        hourly_ot_rate: Number(form.hourly_ot_rate) || 0,
        planned_cartons: Number(form.planned_cartons) || 0,
        pcs_per_carton: pcsPerCartonValue,
        planned_qty: totalPlanned,
        actual_output: totalActual,
        rejected_qty: totalRejected,
        downtime_min: totalDowntime,
        downtime_remarks: downtimeRemarks,
        status,
        ...Object.fromEntries(wasteComponents.map((c) => [`${c.key}_used`, Number(form[`${c.key}_used`]) || 0])),
        ...Object.fromEntries(wasteComponents.map((c) => [`${c.key}_waste`, Number(form[`${c.key}_waste`]) || 0])),
        ...Object.fromEntries(taskChecklist.map((t) => [t.key, form[t.key]]))
      };
      const res = await base44.functions.invoke("recordShiftLog", { shiftLog: shiftLogPayload });
      const synced = [res?.data?.operationLogId ? "Operation" : null, res?.data?.otLogId ? "Overtime" : null, res?.data?.wastageLogId ? "Wastage" : null].filter(Boolean);
      toast({
        title: "Log saved & synced",
        description: synced.length
          ? `${form.production_line} — ${form.shift_date} → ${synced.join(", ")} record${synced.length > 1 ? "s" : ""}`
          : `${form.production_line} — ${form.shift_date}`
      });
      navigate("/");
    } catch (e) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="px-6 py-4 flex items-center justify-between bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-6 h-6 text-sky-600" />
          <div>
            <h1 className="text-lg font-semibold text-slate-800 [font-family:'Rubik_Mono_One',_system-ui]">Daily Packaging Line Record</h1>
            <p className="text-xs text-slate-400">Draft Rev 01 — Packaging Activity / Downtime / Material Traceability</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${status === "complete" ? "text-green-700 bg-green-50" : "text-amber-700 bg-amber-50"}`}>
            <CheckCircle2 className="w-3.5 h-3.5" />
            {status === "complete" ? "Complete" : `Incomplete (${checkedCount}/4)`}
          </span>
          <Button onClick={handleSave} disabled={saving} className="bg-sky-600 hover:bg-sky-700 text-white">
            <Save className="w-4 h-4 mr-1" /> {saving ? "Saving..." : "Save Log"}
          </Button>
        </div>
      </header>

      <main className="p-6 max-w-6xl mx-auto space-y-6">
        <IncompleteDataAlert
          records={logRecords}
          onDelete={handleDeleteLog}
          onSaved={(updated) => setLogRecords((prev) => prev.map((r) => r.id === updated.id ? updated : r))} />
        

        {/* SECTION 1 */}
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 bg-slate-900 text-white flex items-center gap-2">
            <span className="bg-sky-600 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">1</span>
            <h2 className="text-sm font-semibold [font-family:'Bungee',_system-ui]">PACKAGING ACTIVITY</h2>
            <span className="text-slate-400 text-xs">/ Aktivitas Pengemasan / पैकेजिंग गतिविधि</span>
          </div>
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Date">
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
                  <Input type="date" value={form.shift_date} onChange={(e) => set("shift_date", e.target.value)} className="pl-9" />
                </div>
                {dayName && <p className="text-xs text-sky-600 mt-1 font-medium">{dayName}</p>}
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
              <Field label="Planned Qty (Carton)" required>
                <Input type="number" min="0" value={form.planned_cartons} onChange={(e) => set("planned_cartons", e.target.value)} placeholder="0" />
              </Field>
              <Field label="Pcs per Carton" required>
                <Input type="number" min="0" value={form.pcs_per_carton} onChange={(e) => set("pcs_per_carton", e.target.value)} placeholder="0" />
              </Field>
              <Field label="Planned Qty (pcs)">
                <Input value={totalPlanned.toLocaleString()} readOnly className="bg-slate-50 font-semibold text-slate-700" />
              </Field>
              <Field label="Lot # (Batch)" required>
                <Input value={form.batch_number} onChange={(e) => set("batch_number", e.target.value)} placeholder="e.g. BN20261016" />
              </Field>
              <Field label="Staff Count" required>
                <Input type="number" min="0" value={form.staff_count} onChange={(e) => set("staff_count", Number(e.target.value))} />
              </Field>
            </div>

            <Field label="Staff Names (one per row)" required>
              <div className="space-y-2">
                {staffNames.map((name, i) =>
                <div key={i} className="flex items-center gap-2">
                    <Input value={name} onChange={(e) => updateName(i, e.target.value)} placeholder={`Staff name ${i + 1}`} />
                    {staffNames.length > 1 &&
                  <Button variant="ghost" size="icon" onClick={() => removeName(i)} className="text-red-400 hover:text-red-600 shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                  }
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={addName} className="text-sky-600 border-sky-200 hover:bg-sky-50">
                  <Plus className="w-4 h-4 mr-1" /> Add name
                </Button>
              </div>
            </Field>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Task Checklist <span className="text-red-500 normal-case">*</span></p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-4">
                {taskChecklist.map((t) =>
                <label key={t.key} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={form[t.key]} onCheckedChange={(c) => set(t.key, c === true)} />
                    <span className="text-sm text-slate-700">{t.label}</span>
                  </label>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Work Segments & Yield <span className="text-red-500 normal-case">*</span></p>
              <div className="border border-slate-200 rounded-lg overflow-x-auto">
                <table className="w-full text-sm min-w-[860px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">Segment</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600 w-28">Start</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600 w-28">End</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600 w-20">Hours</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600 w-32">
                        <div className="flex flex-col items-end gap-1">
                          <span>Actual Output</span>
                          <div className="inline-flex rounded-md border border-slate-200 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setOutputUnit("units")}
                              className={`px-2 py-0.5 text-[10px] font-semibold transition-colors ${outputUnit === "units" ? "bg-sky-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
                            >
                              Units
                            </button>
                            <button
                              type="button"
                              onClick={() => setOutputUnit("carton")}
                              className={`px-2 py-0.5 text-[10px] font-semibold transition-colors ${outputUnit === "carton" ? "bg-sky-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
                            >
                              Carton
                            </button>
                          </div>
                        </div>
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600 w-24">Rejected Qty <span className="text-slate-400 font-normal">(optional)</span></th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600 w-24">Actual UPM</th>
                      <th className="px-3 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {timeRows.map((row, i) =>
                    <tr key={i}>
                        <td className="px-3 py-1.5 text-slate-700">Segment {i + 1}</td>
                        <td className="px-2 py-1.5"><Input type="time" value={row.start} onChange={(e) => updateTimeRow(i, "start", e.target.value)} className="h-8" /></td>
                        <td className="px-2 py-1.5"><Input type="time" value={row.end} onChange={(e) => updateTimeRow(i, "end", e.target.value)} className="h-8" /></td>
                        <td className="px-3 py-1.5 text-right text-slate-700">{calcHours(row.start, row.end).toFixed(2)}</td>
                        <td className="px-2 py-1.5"><Input type="number" value={row.actual_output} onChange={(e) => updateTimeRow(i, "actual_output", e.target.value)} className="h-8 text-right" placeholder="0" /></td>
                        <td className="px-2 py-1.5"><Input type="number" value={row.rejected_qty} onChange={(e) => updateTimeRow(i, "rejected_qty", e.target.value)} className="h-8 text-right" placeholder="0" /></td>
                        <td className="px-3 py-1.5 text-right text-slate-700">{calcUpm(row.start, row.end, row.actual_output).toFixed(2)}</td>
                        <td className="px-2 py-1.5">
                          {timeRows.length > 1 &&
                        <Button variant="ghost" size="icon" onClick={() => removeTimeRow(i)} className="text-red-400 hover:text-red-600 h-8 w-8">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                        }
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                    <tr>
                      <td className="px-3 py-2 font-semibold text-slate-700" colSpan={3}>Gross Duration</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-700">{grossHours.toFixed(2)} hrs</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-700">{totalActual.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-semibold text-red-500">{totalRejected.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-700">{(grossHours > 0 ? totalActual / grossHours / 60 : 0).toFixed(2)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <Button variant="outline" size="sm" onClick={addTimeRow} className="text-sky-600 border-sky-200 hover:bg-sky-50 mt-2">
                <Plus className="w-4 h-4 mr-1" /> Add segment
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <Field label="Overtime (auto)">
                <div className="relative">
                  <Timer className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                  <Input value={otHours > 0 ? `${otHours.toFixed(2)} hrs` : "0 hrs"} readOnly className={`pl-9 font-semibold ${otHours > 0 ? "text-amber-600 bg-amber-50" : "text-slate-500 bg-slate-50"}`} />
                </div>
              </Field>
            </div>
          </div>
        </section>

        {/* SECTION 2 */}
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 bg-slate-900 text-white flex items-center gap-2">
            <span className="bg-amber-500 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">2</span>
            <h2 className="text-sm font-semibold [font-family:'Bungee',_system-ui]">DOWNTIME RECORD</h2>
            <span className="text-slate-400 text-xs">/ Catatan Downtime / डाउनटाइम रिकॉर्ड</span>
          </div>
          <div className="p-5">
            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 w-10">#</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">Reason / Cause</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 w-32">Start</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 w-32">End</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600 w-24">Minutes</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 w-48">Remarks</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {downtimeRows.map((row, i) =>
                  <tr key={i}>
                      <td className="px-3 py-1.5 text-slate-500">{i + 1}</td>
                      <td className="px-2 py-1.5">
                        <Select value={row.reason} onValueChange={(v) => updateDowntime(i, "reason", v)}>
                          <SelectTrigger className="h-8"><SelectValue placeholder="Select reason" /></SelectTrigger>
                          <SelectContent>
                            {downtimeReasons.map((r) => <SelectItem key={r.label} value={r.label}>{r.label} — {r.hint}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1.5"><Input type="time" value={row.start} onChange={(e) => updateDowntime(i, "start", e.target.value)} className="h-8" /></td>
                      <td className="px-2 py-1.5"><Input type="time" value={row.end} onChange={(e) => updateDowntime(i, "end", e.target.value)} className="h-8" /></td>
                      <td className="px-3 py-1.5 text-right text-slate-700">{calcMinutes(row.start, row.end)}</td>
                      <td className="px-2 py-1.5"><Input value={row.remarks} onChange={(e) => updateDowntime(i, "remarks", e.target.value)} className="h-8" placeholder="Remarks" /></td>
                      <td className="px-2 py-1.5">
                        {downtimeRows.length > 1 &&
                      <Button variant="ghost" size="icon" onClick={() => removeDowntime(i)} className="text-red-400 hover:text-red-600 h-8 w-8">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                      }
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                  <tr>
                    <td className="px-3 py-2 font-semibold text-slate-700" colSpan={4}>Total Downtime</td>
                    <td className="px-3 py-2 text-right font-semibold text-amber-600">{totalDowntime} min</td>
                    <td></td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <Button variant="outline" size="sm" onClick={addDowntime} className="text-amber-600 border-amber-200 hover:bg-amber-50 mt-2">
              <Plus className="w-4 h-4 mr-1" /> Add downtime entry
            </Button>
          </div>
        </section>

        {/* SECTION 3 */}
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 bg-slate-900 text-white flex items-center gap-2">
            <span className="bg-rose-500 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">3</span>
            <h2 className="text-sm font-semibold [font-family:'Bungee',_system-ui]">PACKAGING MATERIAL TRACEABILITY / WASTAGE</h2>
            <span className="text-slate-400 text-xs">/ ट्रेसेबिलिटी</span>
          </div>
          <div className="p-5">
            <p className="text-xs text-red-500 mb-3">* At least 1 component (Used or Wasted) must be filled.</p>
            <div className="mb-3 max-w-xs">
              <Field label="Product Type / Size">
                <Input value={form.product_type} onChange={(e) => set("product_type", e.target.value)} placeholder="e.g. 1L, 200g" />
              </Field>
            </div>
            <div className="space-y-3">
              <WastagePickerRow
                title="Primary Container"
                options={wasteComponents.filter((c) => primaryContainers.includes(c.key))}
                value={primaryContainer}
                onValueChange={changePrimary}
                usedValue={primaryContainer ? form[`${primaryContainer}_used`] : 0}
                wasteValue={primaryContainer ? form[`${primaryContainer}_waste`] : 0}
                onWasteChange={(v) => set(`${primaryContainer}_waste`, v)}
                placeholder="Select container"
              />
              <WastagePickerRow
                title="Closure"
                options={wasteComponents.filter((c) => closures.includes(c.key))}
                value={closure}
                onValueChange={changeClosure}
                usedValue={closure ? form[`${closure}_used`] : 0}
                wasteValue={closure ? form[`${closure}_waste`] : 0}
                onWasteChange={(v) => set(`${closure}_waste`, v)}
                placeholder="Select closure"
              />
              <WastageGroupTable
                title="Labeling & Carton"
                components={remainingComponents}
                form={form}
                set={set}
              />
              <div className="flex items-center justify-end gap-6 text-sm bg-slate-50 border border-slate-200 rounded-lg px-4 py-2">
                <span className="text-slate-600">Total Used: <span className="font-semibold text-slate-700">{totalUsed.toLocaleString()}</span></span>
                <span className="text-slate-600">Total Wasted: <span className="font-semibold text-red-500">{totalWaste.toLocaleString()}</span></span>
              </div>
            </div>
          </div>
        </section>

        {/* SUMMARY */}
        <div className="bg-slate-900 rounded-xl px-5 py-4 flex items-center gap-6 text-sm flex-wrap text-white">
          <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-sky-400" /> Achieve: <span className="font-bold text-sky-400">{achieveRate}%</span></span>
          <span className="flex items-center gap-1"><Recycle className="w-4 h-4 text-rose-400" /> Waste: <span className="font-bold text-rose-400">{totalWaste.toLocaleString()} pcs</span></span>
          <span className="flex items-center gap-1"><Timer className="w-4 h-4 text-amber-400" /> OT: <span className="font-bold text-amber-400">{otHours.toFixed(2)} hrs</span></span>
          <span>OT Spend: <span className="font-bold text-orange-400">RM {otSpend.toFixed(2)}</span></span>
          <span className="flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-amber-400" /> Downtime: <span className="font-bold text-amber-400">{totalDowntime} min</span></span>
          <span className="flex items-center gap-1"><Gauge className="w-4 h-4 text-violet-400" /> UPM: <span className="font-bold text-violet-400">{totalUpm.toFixed(2)}</span></span>
        </div>
      </main>
    </div>);

}

function Field({ label, children, required }) {
  return (
    <div>
      <Label className="block text-xs font-medium text-slate-500 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>);

}