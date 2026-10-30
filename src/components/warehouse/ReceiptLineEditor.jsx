import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";

const FIELD = "bg-[#0e131d] border-[#1e2740] text-white";

const Field = ({ label, children, className = "" }) => (
  <div className={`space-y-1 ${className}`}>
    <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">{label}</label>
    {children}
  </div>
);

// One item line on a goods receipt. Item code drives the description auto-fill.
export default function ReceiptLineEditor({ index, line, items, units, racks, onItemCode, onChange, onRemove, onAddItem, removable }) {
  const code = (line.item_code || "").trim();
  const known = items.some((i) => (i.item_code || "").toLowerCase() === code.toLowerCase());

  return (
    <div className="rounded-lg border border-[#1e2740] bg-[#0e131d]/60 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-widest text-[#5f6b7f]">ITEM {index + 1}</p>
        {removable && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="h-8 text-[#ff4d4d] hover:bg-white/5 hover:text-[#ff4d4d]">
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Remove</span>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Field label="Item Code *">
          <Input
            value={line.item_code}
            onChange={(e) => onItemCode(e.target.value)}
            list="warehouse-item-codes"
            placeholder="Scan or type code"
            className={FIELD}
          />
          {line.product_id && (
            <p className="mt-1 text-[11px] text-[#00e5ff]">
              Product Master · {line.product_code}
              {line.product_recipe ? ` · ${line.product_recipe}` : ""}
            </p>
          )}
          {code && !known && !line.product_id && (
            <button
              type="button"
              onClick={() => onAddItem(line)}
              className="text-[11px] text-[#00e5ff] hover:underline mt-1"
            >
              Unknown item — add “{code}” to the item list
            </button>
          )}
        </Field>

        <Field label="Product Description *" className="sm:col-span-2">
          <Input
            value={line.product_description}
            onChange={(e) => onChange({ product_description: e.target.value })}
            placeholder="Auto-fills from the item code"
            className={FIELD}
          />
        </Field>

        <Field label="Batch Number *">
          <Input
            value={line.batch_number}
            onChange={(e) => onChange({ batch_number: e.target.value })}
            placeholder="Batch / lot"
            className={FIELD}
          />
        </Field>

        <Field label="Quantity Received *">
          <Input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={line.quantity}
            onChange={(e) => onChange({ quantity: e.target.value })}
            placeholder="0"
            className={FIELD}
          />
        </Field>

        <Field label="Unit *">
          <Select value={line.unit || undefined} onValueChange={(v) => onChange({ unit: v })}>
            <SelectTrigger className={FIELD}><SelectValue placeholder="Select unit" /></SelectTrigger>
            <SelectContent>
              {units.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Rack Location *">
          <Select value={line.rack_location || undefined} onValueChange={(v) => onChange({ rack_location: v })}>
            <SelectTrigger className={FIELD}><SelectValue placeholder={racks.length ? "Select rack" : "No active racks"} /></SelectTrigger>
            <SelectContent>
              {racks.map((r) => <SelectItem key={r.id} value={r.rack_code}>{r.rack_code}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Expiry Date">
          <Input
            type="date"
            value={line.expiry_date}
            onChange={(e) => onChange({ expiry_date: e.target.value })}
            className={FIELD}
          />
        </Field>

        <Field label="Remarks" className="sm:col-span-2 lg:col-span-4">
          <Input
            value={line.remarks}
            onChange={(e) => onChange({ remarks: e.target.value })}
            placeholder="Optional notes for this item"
            className={FIELD}
          />
        </Field>
      </div>
    </div>
  );
}