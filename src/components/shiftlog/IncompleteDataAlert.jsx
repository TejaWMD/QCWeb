import React, { useState } from "react";
import { AlertTriangle, Trash2, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import IncompleteRecordEditModal from "./IncompleteRecordEditModal";

const TASK_CHECKLIST = [
  { key: "task_filled_packed", label: "Filled & Packed" },
  { key: "task_capped", label: "Capped" },
  { key: "task_label_applied", label: "Label Applied" },
  { key: "task_carton_packed", label: "Carton Packed" },
];

// Returns an array of human-readable missing-field labels for a stored ShiftLog record.
export const findMissingFields = (r) => {
  const missing = [];
  if (!r.product_name) missing.push("Product");
  if (!r.batch_number?.trim()) missing.push("Lot # (Batch)");
  if (!r.staff_count || r.staff_count < 1) missing.push("Staff Count");
  const hasStaffName = (r.staff_name && r.staff_name.trim()) || (Array.isArray(r.staff_names) && r.staff_names.filter(Boolean).length);
  if (!hasStaffName) missing.push("Staff Names");
  if (!r.start_time) missing.push("Start Time");
  if (!r.end_time) missing.push("End Time");
  if (!r.planned_qty) missing.push("Planned Qty");
  if (!r.actual_output) missing.push("Actual Output");
  const checkedBoxes = TASK_CHECKLIST.filter((t) => r[t.key]).length;
  if (checkedBoxes === 0) missing.push("Task Checklist");
  return missing;
};

export default function IncompleteDataAlert({ records, onDelete, onSaved }) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editing, setEditing] = useState(null);

  const within = (r) => {
    const d = r.shift_date;
    if (!d) return true;
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  };

  const incomplete = records
    .filter(within)
    .map((record) => ({ record, missing: findMissingFields(record) }))
    .filter((x) => x.missing.length > 0);

  if (incomplete.length === 0 && !dateFrom && !dateTo) return null;

  return (
    <section className="bg-red-50 border-2 border-red-300 rounded-xl overflow-hidden">
      <div className="px-5 py-3 bg-red-600 text-white flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <h2 className="text-sm font-semibold [font-family:'Bungee',_system-ui]">
          INCOMPLETE DATA — {incomplete.length} RECORD{incomplete.length === 1 ? "" : "S"} NEED ATTENTION
        </h2>
        <span className="ml-auto text-xs font-semibold bg-white/20 px-2.5 py-1 rounded-full flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Incomplete
        </span>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-xs font-medium text-red-800">Filter by date:</span>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40 h-8" />
          <span className="text-red-700 text-xs">to</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40 h-8" />
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }} className="h-8 text-red-700 hover:bg-red-100">
              Clear
            </Button>
          )}
        </div>
        {incomplete.length === 0 ? (
          <p className="text-xs text-red-700">No incomplete records in the selected range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[560px]">
              <thead className="border-b border-red-200">
                <tr className="text-left text-red-800">
                  <th className="px-2 py-1 font-semibold">Date</th>
                  <th className="px-2 py-1 font-semibold">Line</th>
                  <th className="px-2 py-1 font-semibold">Product</th>
                  <th className="px-2 py-1 font-semibold">Missing Fields</th>
                  <th className="px-2 py-1 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100">
                {incomplete.map(({ record, missing }) => (
                  <tr key={record.id} className="hover:bg-red-100/50">
                    <td className="px-2 py-1 text-slate-700 whitespace-nowrap">{record.shift_date || "—"}</td>
                    <td className="px-2 py-1 text-slate-700 whitespace-nowrap">{record.production_line || "—"}</td>
                    <td className="px-2 py-1 text-slate-700">{record.product_name || "—"}</td>
                    <td className="px-2 py-1">
                      <div className="flex flex-wrap gap-1">
                        {missing.map((m) => (
                          <span key={m} className="inline-flex items-center text-[10px] leading-none font-medium text-red-700 bg-red-100 border border-red-300 px-1.5 py-0.5 rounded">
                            {m}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-1">
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditing(record)}
                          className="text-sky-500 hover:text-sky-700 hover:bg-sky-100 h-7 w-7"
                          title="Edit this record">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete && onDelete(record)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-100 h-7 w-7"
                          title="Delete this incomplete record">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <IncompleteRecordEditModal
        record={editing}
        open={!!editing}
        onClose={() => setEditing(null)}
        onSaved={(updated) => {
          onSaved && onSaved(updated);
          setEditing(null);
        }}
      />
    </section>
  );
}