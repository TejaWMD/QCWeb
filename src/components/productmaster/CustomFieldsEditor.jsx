import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { inputClass, subtleButton } from "@/components/planning/styles";

// Extra file columns the Admin chose to keep on the product.
export default function CustomFieldsEditor({ value = [], onChange, disabled }) {
  const rows = value || [];
  const update = (index, patch) => onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const remove = (index) => onChange(rows.filter((_, i) => i !== index));

  return (
    <div className="space-y-2">
      {rows.length === 0 ? (
        <p className="text-xs text-[#5f6b7f]">No custom fields.</p>
      ) : (
        rows.map((row, index) => (
          <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr_32px] gap-2 items-center">
            <Input value={row.label || ""} disabled={disabled} onChange={(e) => update(index, { label: e.target.value })} placeholder="Field name" className={inputClass} />
            <Input value={row.value || ""} disabled={disabled} onChange={(e) => update(index, { value: e.target.value })} placeholder="Value" className={inputClass} />
            {!disabled && (
              <Button variant="ghost" size="icon" onClick={() => remove(index)} className="text-[#5f6b7f] hover:text-[#ff4d4d] hover:bg-[#ff4d4d]/10">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))
      )}
      {!disabled && (
        <Button variant="outline" onClick={() => onChange([...rows, { label: "", value: "" }])} className={subtleButton}>
          <Plus className="w-4 h-4 mr-1.5" /> Add field
        </Button>
      )}
    </div>
  );
}