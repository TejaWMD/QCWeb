import React from "react";
import { CheckCircle2, XCircle, AlertTriangle, BookOpen } from "lucide-react";
import { panelClass, labelClass } from "@/components/planning/styles";

const Stat = ({ label, value, tone }) => (
  <div className={`${panelClass} p-3`}>
    <p className={labelClass}>{label}</p>
    <p className={`text-xl font-semibold ${tone}`}>{value}</p>
  </div>
);

// The import report shown once the rows have been saved.
export default function ProductImportReport({ report }) {
  if (!report) return null;
  const { fileName, entries = [], created = 0, updated = 0, errors = 0, warnings = 0, recipes = [] } = report;
  const errorRows = entries.filter((entry) => entry.action === "error");
  const warnRows = entries.filter((entry) => entry.action !== "error" && entry.warnings.length);
  const imported = entries.filter((entry) => entry.action !== "error");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-white">
        <CheckCircle2 className="w-4 h-4 text-[#00ff9d]" /> {fileName} imported
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Stat label="Rows imported" value={created + updated} tone="text-[#00ff9d]" />
        <Stat label="Created" value={created} tone="text-white" />
        <Stat label="Updated" value={updated} tone="text-[#00e5ff]" />
        <Stat label="Warnings" value={warnings} tone="text-[#ff9f43]" />
        <Stat label="Errors" value={errors} tone="text-[#ff4d4d]" />
      </div>

      <div className={`${panelClass} p-3 space-y-1`}>
        <p className={`${labelClass} flex items-center gap-1.5`}><BookOpen className="w-3.5 h-3.5 text-[#00e5ff]" /> Recipes created ({recipes.length})</p>
        <p className="text-xs text-[#a0aec0]">{recipes.length ? recipes.join(" · ") : "No new recipe was needed — every recipe already existed."}</p>
      </div>

      {warnRows.length > 0 && (
        <div className={`${panelClass} p-3 space-y-1`}>
          <p className={`${labelClass} flex items-center gap-1.5 text-[#ff9f43]`}><AlertTriangle className="w-3.5 h-3.5" /> Warnings</p>
          {warnRows.map((entry) => (
            <p key={entry.row} className="text-xs text-[#a0aec0]">Row {entry.row} · {entry.label}: {entry.warnings.join("; ")}</p>
          ))}
        </div>
      )}

      {errorRows.length > 0 && (
        <div className={`${panelClass} p-3 space-y-1`}>
          <p className={`${labelClass} flex items-center gap-1.5 text-[#ff4d4d]`}><XCircle className="w-3.5 h-3.5" /> Rejected rows</p>
          {errorRows.map((entry) => (
            <p key={entry.row} className="text-xs text-[#a0aec0]">Row {entry.row} · {entry.label}: {entry.errors.join("; ")}</p>
          ))}
        </div>
      )}

      <div className={`${panelClass} overflow-x-auto max-h-[32vh]`}>
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#0e131d]">
            <tr className="text-[10px] uppercase tracking-widest text-[#5f6b7f] border-b border-[#1e2740]">
              <th className="text-left font-semibold px-2 py-2">Row</th>
              <th className="text-left font-semibold px-2 py-2">Item Code</th>
              <th className="text-left font-semibold px-2 py-2">Carton Description</th>
              <th className="text-right font-semibold px-2 py-2">Net Fill</th>
              <th className="text-right font-semibold px-2 py-2">Ctn/Batch</th>
              <th className="text-left font-semibold px-2 py-2">Result</th>
            </tr>
          </thead>
          <tbody>
            {imported.map((entry) => (
              <tr key={entry.row} className="border-b border-[#131926]">
                <td className="px-2 py-1.5 text-[#5f6b7f]">{entry.row}</td>
                <td className="px-2 py-1.5 text-white whitespace-nowrap">{entry.record.product_code}</td>
                <td className="px-2 py-1.5 text-[#a0aec0] max-w-[280px] truncate" title={entry.record.product_name}>{entry.record.product_name}</td>
                <td className="px-2 py-1.5 text-right text-[#00e5ff]">{entry.record.net_filling_kg}</td>
                <td className="px-2 py-1.5 text-right text-[#00e5ff]">{entry.record.cartons_per_batch}</td>
                <td className="px-2 py-1.5 text-[#00ff9d]">{entry.action === "create" ? "created" : "updated"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}