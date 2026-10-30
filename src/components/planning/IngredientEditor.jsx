import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { num } from "@/lib/planning";
import { inputClass, selectClass } from "@/components/planning/styles";

// Ingredient rows for a recipe. Materials come from the warehouse item list when
// it has any; otherwise the ingredient name is typed in.
export default function IngredientEditor({ value = [], onChange, materials = [] }) {
  const update = (idx, patch) => onChange(value.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  const remove = (idx) => onChange(value.filter((_, i) => i !== idx));
  const add = () => onChange([...value, { material_id: "", item_code: "", material_name: "", unit: "kg", quantity_per_batch: "" }]);

  const pickMaterial = (idx, materialId) => {
    const m = materials.find((x) => x.id === materialId);
    if (!m) return;
    update(idx, { material_id: m.id, item_code: m.item_code, material_name: m.description || m.item_code, unit: m.unit || "" });
  };

  return (
    <div className="space-y-2">
      {value.length === 0 && <p className="text-xs text-[#5f6b7f]">No ingredients yet.</p>}
      {value.map((row, idx) => (
        <div key={idx} className="grid grid-cols-[1fr_96px_68px_36px] gap-2 items-center">
          {materials.length > 0 ? (
            <Select value={row.material_id || undefined} onValueChange={(v) => pickMaterial(idx, v)}>
              <SelectTrigger className={selectClass}><SelectValue placeholder="Select material" /></SelectTrigger>
              <SelectContent>
                {materials.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.item_code} · {m.description}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={row.material_name}
              onChange={(e) => update(idx, { material_name: e.target.value })}
              className={inputClass}
              placeholder="Ingredient name"
            />
          )}
          <Input
            type="number"
            min="0"
            step="any"
            value={row.quantity_per_batch}
            onChange={(e) => update(idx, { quantity_per_batch: num(e.target.value) })}
            className={inputClass}
            placeholder="Qty / batch"
          />
          <Input value={row.unit} onChange={(e) => update(idx, { unit: e.target.value })} className={inputClass} placeholder="Unit" />
          <Button variant="ghost" size="icon" onClick={() => remove(idx)} className="text-[#5f6b7f] hover:text-[#ff4d4d] hover:bg-[#ff4d4d]/10">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" onClick={add} className="w-full border-dashed border-[#1e2740] bg-transparent text-[#a0aec0] hover:bg-white/5 hover:text-white">
        <Plus className="w-4 h-4" /> Add ingredient
      </Button>
    </div>
  );
}