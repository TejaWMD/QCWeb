import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const humanize = (key) => key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Maps each entity field to a CSV column (auto-matched fields first). Unmapped
// fields are simply not imported.
export default function FieldMappingList({ fields, headers, mapping, required, onChange, disabled }) {
  const requiredSet = new Set(required);
  const ordered = [...fields].sort((a, b) => (mapping[b.key] ? 1 : 0) - (mapping[a.key] ? 1 : 0));
  const mappedCount = fields.filter((f) => mapping[f.key]).length;

  const typeLabel = (f) => {
    const t = f.type || "text";
    if (t === "enum" && f.options) return `one of: ${f.options.slice(0, 4).join(" / ")}${f.options.length > 4 ? "…" : ""}`;
    if (t === "boolean") return "true / false";
    return t;
  };

  return (
    <div>
      <p className="text-xs text-[#a0aec0] mb-2">
        {mappedCount} of {fields.length} fields matched to columns — adjust any mapping below; unmapped fields are skipped.
      </p>
      <div className="max-h-[360px] overflow-y-auto pr-1 space-y-1.5">
        {ordered.map((f) => (
          <div key={f.key} className="grid grid-cols-1 md:grid-cols-[1fr_230px] gap-2 items-center bg-[#0e131d] border border-[#1e2740] rounded-lg px-3 py-2">
            <div className="min-w-0">
              <span className="text-sm text-white">{humanize(f.key)}</span>
              {requiredSet.has(f.key) && <span className="text-[#ff4d4d] ml-1" title="Required">*</span>}
              <span className="block text-[10px] text-[#5f6b7f] truncate">{f.key} · {typeLabel(f)}</span>
            </div>
            <Select
              value={mapping[f.key] || "none"}
              onValueChange={(v) => onChange({ ...mapping, [f.key]: v === "none" ? "" : v })}
              disabled={disabled}
            >
              <SelectTrigger className="h-8 bg-[#101828] border-[#1e2740] text-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Not imported —</SelectItem>
                {headers.map((h) => (
                  <SelectItem key={h} value={h}>{h}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}