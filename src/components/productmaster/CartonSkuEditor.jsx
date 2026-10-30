import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { cartonUnitsFromDescription } from "@/lib/productMaster";
import { inputClass, subtleButton, labelClass } from "@/components/planning/styles";

// Carton options for one product: a product can have several cartons.
export default function CartonSkuEditor({ value = [], onChange, disabled }) {
  const rows = value.length ? value : [];

  const update = (index, patch) => {
    const next = rows.map((row, i) => {
      if (i !== index) return row;
      const merged = { ...row, ...patch };
      // Units per carton are read from the end of the description when present.
      if (patch.description !== undefined && !patch.units_per_carton) {
        const parsed = cartonUnitsFromDescription(patch.description);
        if (parsed) merged.units_per_carton = parsed;
      }
      return merged;
    });
    onChange(next);
  };

  const add = () => onChange([...rows, { description: "", item_code: "", barcode: "", units_per_carton: 0 }]);
  const remove = (index) => onChange(rows.filter((_, i) => i !== index));

  return (
    <div className="space-y-2">
      {rows.length === 0 ? (
        <p className="text-xs text-[#5f6b7f]">No carton options yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div key={index} className="grid grid-cols-1 sm:grid-cols-[1.6fr_1fr_1fr_70px_32px] gap-2 items-center">
              <Input
                value={row.description || ""}
                disabled={disabled}
                onChange={(e) => update(index, { description: e.target.value })}
                placeholder="Carton description, e.g. X 24"
                className={inputClass}
              />
              <Input
                value={row.item_code || ""}
                disabled={disabled}
                onChange={(e) => update(index, { item_code: e.target.value })}
                placeholder="Item code"
                className={inputClass}
              />
              <Input
                value={row.barcode || ""}
                disabled={disabled}
                onChange={(e) => update(index, { barcode: e.target.value })}
                placeholder="Carton barcode"
                className={inputClass}
              />
              <Input
                type="number"
                min="0"
                value={row.units_per_carton || ""}
                disabled={disabled}
                onChange={(e) => update(index, { units_per_carton: Number(e.target.value) })}
                placeholder="Units"
                className={inputClass}
              />
              {!disabled && (
                <Button variant="ghost" size="icon" onClick={() => remove(index)} className="text-[#5f6b7f] hover:text-[#ff4d4d] hover:bg-[#ff4d4d]/10">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      {!disabled && (
        <Button variant="outline" onClick={add} className={subtleButton}>
          <Plus className="w-4 h-4 mr-1.5" /> Add carton
        </Button>
      )}
      <p className={labelClass}>Units per carton are read from the end of the description, e.g. “Sambal 500g X 24”.</p>
    </div>
  );
}