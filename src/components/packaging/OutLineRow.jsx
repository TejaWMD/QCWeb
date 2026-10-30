import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { productionLines } from "@/lib/shiftLogConstants";
import { fmtQty } from "@/lib/packaging";
import ProductPicker from "@/components/labels/ProductPicker";

const FIELD = "bg-[#0e131d] border-[#1e2740] text-white";

// One stock-out line: item, quantity, batch consumed, the Product Master item it was
// issued for and the production order it went to.
export default function OutLineRow({ line, items, products = [], orders, onChange, onRemove, removable }) {
  const item = items.find((i) => i.id === line.item_id);
  return (
    <div className="rounded-lg border border-[#1e2740] bg-[#0a0e17] p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">
          {item ? `Available ${fmtQty(item.quantity)} ${item.unit || ""}` : "Line"}
        </p>
        {removable && (
          <Button variant="ghost" size="sm" onClick={onRemove} className="text-[#ff4d4d] hover:bg-[#ff4d4d]/10">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="col-span-2 sm:col-span-3 space-y-1">
          <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Item *</label>
          <Select value={line.item_id || ""} onValueChange={(v) => onChange({ item_id: v })}>
            <SelectTrigger className={FIELD}><SelectValue placeholder="Select item" /></SelectTrigger>
            <SelectContent>
              {items.map((i) => (
                <SelectItem key={i.id} value={i.id}>{i.item_code} · {i.description || "—"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 sm:col-span-3 space-y-1">
          <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Product (Product Master)</label>
          <ProductPicker
            products={products}
            value={line.product_id || ""}
            onChange={(product) => onChange({
              product_id: product?.id || "",
              product_code: product?.product_code || "",
              product_name: product?.product_name || "",
            })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Qty {item?.unit ? `(${item.unit})` : ""} *</label>
          <Input type="number" min="0" step="0.001" value={line.quantity} onChange={(e) => onChange({ quantity: e.target.value })} placeholder="0" className={FIELD} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Batch Used</label>
          <Input value={line.batch_number} onChange={(e) => onChange({ batch_number: e.target.value })} placeholder="Batch in stock" className={FIELD} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Production Order</label>
          <Select value={line.production_order || "none"} onValueChange={(v) => onChange({ production_order: v === "none" ? "" : v })}>
            <SelectTrigger className={FIELD}><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {orders.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Line</label>
          <Select value={line.production_line || "none"} onValueChange={(v) => onChange({ production_line: v === "none" ? "" : v })}>
            <SelectTrigger className={FIELD}><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {productionLines.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Remarks</label>
          <Input value={line.remarks} onChange={(e) => onChange({ remarks: e.target.value })} placeholder="Optional" className={FIELD} />
        </div>
      </div>
    </div>
  );
}