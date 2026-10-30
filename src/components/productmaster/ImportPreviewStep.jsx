import React from "react";
import { AlertTriangle, CheckCircle2, Copy, SkipForward, XCircle } from "lucide-react";
import { panelClass, labelClass } from "@/components/planning/styles";

const ACTION_STYLE = {
  create: "bg-[#00ff9d]/10 text-[#00ff9d] border-[#00ff9d]/30",
  update: "bg-[#00e5ff]/10 text-[#00e5ff] border-[#00e5ff]/30",
  error: "bg-[#ff4d4d]/10 text-[#ff4d4d] border-[#ff4d4d]/40",
};

const badge = (label, value, icon) => (
  <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border border-[#1e2740] text-[#a0aec0]">
    {icon}{value} {label}
  </span>
);

// Row-level preview: what will be created, updated or rejected.
export default function ImportPreviewStep({ preview }) {
  const { counts, entries = [], recipesToCreate = [] } = preview;
  const failed = entries.filter((entry) => entry.action === "error");
  const warned = entries.filter((entry) => entry.action !== "error" && entry.warnings.length);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {badge("new", counts.create, <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff9d]" />)}
        {badge("to update", counts.update, <Copy className="w-3.5 h-3.5 text-[#00e5ff]" />)}
        {badge("error(s)", counts.errors, <XCircle className="w-3.5 h-3.5 text-[#ff4d4d]" />)}
        {badge("warning(s)", counts.warnings, <AlertTriangle className="w-3.5 h-3.5 text-[#ff9f43]" />)}
        {badge("recipe(s) to create", counts.recipes, <SkipForward className="w-3.5 h-3.5 text-[#a0aec0]" />)}
      </div>

      {failed.length > 0 && (
        <div className={`${panelClass} p-3 space-y-1`}>
          <p className={`${labelClass} text-[#ff4d4d]`}>Rejected rows</p>
          {failed.map((entry) => (
            <p key={entry.row} className="text-xs text-[#ff9f43]">Row {entry.row} · {entry.label}: {entry.errors.join("; ")}</p>
          ))}
        </div>
      )}

      {warned.length > 0 && (
        <div className={`${panelClass} p-3 space-y-1`}>
          <p className={`${labelClass} text-[#ff9f43]`}>Warnings (row is still imported)</p>
          {warned.map((entry) => (
            <p key={entry.row} className="text-xs text-[#a0aec0]">Row {entry.row} · {entry.label}: {entry.warnings.join("; ")}</p>
          ))}
        </div>
      )}

      {recipesToCreate.length > 0 && (
        <div className={`${panelClass} p-3 space-y-1`}>
          <p className={labelClass}>Recipe Master records to create</p>
          <p className="text-xs text-[#a0aec0]">{recipesToCreate.join(" · ")}</p>
        </div>
      )}

      <div className={`${panelClass} overflow-x-auto max-h-[38vh]`}>
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#0e131d]">
            <tr className="text-[10px] uppercase tracking-widest text-[#5f6b7f] border-b border-[#1e2740]">
              <th className="text-left font-semibold px-2 py-2">Row</th>
              <th className="text-left font-semibold px-2 py-2">Item Code</th>
              <th className="text-left font-semibold px-2 py-2">Carton Description</th>
              <th className="text-right font-semibold px-2 py-2">Pcs</th>
              <th className="text-right font-semibold px-2 py-2">Net Wt</th>
              <th className="text-right font-semibold px-2 py-2">Net Fill</th>
              <th className="text-right font-semibold px-2 py-2">Ctn/Batch</th>
              <th className="text-left font-semibold px-2 py-2">Customer</th>
              <th className="text-left font-semibold px-2 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.row} className="border-b border-[#131926]">
                <td className="px-2 py-1.5 text-[#5f6b7f]">{entry.row}</td>
                <td className="px-2 py-1.5 text-white whitespace-nowrap">{entry.record.product_code || "—"}</td>
                <td className="px-2 py-1.5 text-[#a0aec0] max-w-[260px] truncate" title={entry.record.product_name}>{entry.record.product_name || "—"}</td>
                <td className="px-2 py-1.5 text-right text-[#a0aec0]">{entry.record.carton_size || "—"}</td>
                <td className="px-2 py-1.5 text-right text-[#a0aec0]">{entry.record.net_weight_kg || "—"}</td>
                <td className="px-2 py-1.5 text-right text-[#00e5ff]">{entry.record.net_filling_kg || "—"}</td>
                <td className="px-2 py-1.5 text-right text-[#00e5ff]">{entry.record.cartons_per_batch || "—"}</td>
                <td className="px-2 py-1.5 text-[#a0aec0] whitespace-nowrap">{entry.record.customer || "—"}</td>
                <td className="px-2 py-1.5">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ACTION_STYLE[entry.action]}`}>
                    {entry.action}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}