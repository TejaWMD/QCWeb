import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { num } from "@/lib/planning";
import { inputClass, selectClass } from "@/components/planning/styles";

// Packaging items used per carton, picked from the Packaging Stock item list.
export default function PackagingPerCartonEditor({ value = [], onChange, items = [] }) {
  const update = (idx, patch) => onChange(value.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  const remove = (idx) => onChange(value.filter((_, i) => i !== idx));

  const pick = (idx, itemId) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    update(idx, {
      item_id: item.id,
      item_code: item.item_code,
      item_name: item.description || item.item_code,
      unit: item.unit || "",
    });
  };

  const add = () =>
    onChange([...value, { item_id: "", item_code: "", item_name: "", unit: "", quantity: 1 }]);

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <p className="text-xs text-[#5f6b7f]">No packaging items yet. Stock warnings for this product use these quantities.</p>
      )}
      {value.map((row, idx) => (
        <div key={idx} className="grid grid-cols-[1fr_88px_56px_36px] gap-2 items-center">
          <Select value={row.item_id || undefined} onValueChange={(v) => pick(idx, v)}>
            <SelectTrigger className={selectClass}><SelectValue placeholder="Select packaging item" /></SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.item_code} · {item.description}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            min="0"
            step="any"
            value={row.quantity}
            onChange={(e) => update(idx, { quantity: num(e.target.value) })}
            className={inputClass}
            placeholder="Qty"
          />
          <span className="text-[11px] text-[#5f6b7f] truncate">{row.unit || "—"}</span>
          <Button variant="ghost" size="icon" onClick={() => remove(idx)} className="text-[#5f6b7f] hover:text-[#ff4d4d] hover:bg-[#ff4d4d]/10">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" onClick={add} className="w-full border-dashed border-[#1e2740] bg-transparent text-[#a0aec0] hover:bg-white/5 hover:text-white">
        <Plus className="w-4 h-4" /> Add packaging item
      </Button>
    </div>
  );
}