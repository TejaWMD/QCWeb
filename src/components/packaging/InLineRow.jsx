import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";

const FIELD = "bg-[#0e131d] border-[#1e2740] text-white";

// One stock-in line: item, quantity, batch, rack, expiry.
export default function InLineRow({ line, items, racks, defaultRack, onChange, onRemove, removable }) {
  const item = items.find((i) => i.id === line.item_id);
  return (
    <div className="rounded-lg border border-[#1e2740] bg-[#0a0e17] p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Line</p>
        {removable && (
          <Button variant="ghost" size="sm" onClick={onRemove} className="text-[#ff4d4d] hover:bg-[#ff4d4d]/10">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="col-span-2 sm:col-span-3 space-y-1">
          <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Item *</label>
          <Select
            value={line.item_id || ""}
            onValueChange={(v) => {
              const picked = items.find((i) => i.id === v);
              onChange({ item_id: v, rack_location: line.rack_location || picked?.default_rack || defaultRack || "" });
            }}
          >
            <SelectTrigger className={FIELD}><SelectValue placeholder="Select item" /></SelectTrigger>
            <SelectContent>
              {items.map((i) => (
                <SelectItem key={i.id} value={i.id}>{i.item_code} · {i.description || "—"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Qty {item?.unit ? `(${item.unit})` : ""} *</label>
          <Input type="number" min="0" step="0.001" value={line.quantity} onChange={(e) => onChange({ quantity: e.target.value })} placeholder="0" className={FIELD} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Batch No. *</label>
          <Input value={line.batch_number} onChange={(e) => onChange({ batch_number: e.target.value })} placeholder="Batch" className={FIELD} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Rack *</label>
          <Select value={line.rack_location || ""} onValueChange={(v) => onChange({ rack_location: v })}>
            <SelectTrigger className={FIELD}><SelectValue placeholder="Select rack" /></SelectTrigger>
            <SelectContent>
              {racks.map((r) => <SelectItem key={r.id} value={r.rack_code}>{r.rack_code}{r.zone ? ` · ${r.zone}` : ""}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Expiry</label>
          <Input type="date" value={line.expiry_date} onChange={(e) => onChange({ expiry_date: e.target.value })} className={FIELD} />
        </div>
        <div className="col-span-2 space-y-1">
          <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Remarks</label>
          <Input value={line.remarks} onChange={(e) => onChange({ remarks: e.target.value })} placeholder="Optional" className={FIELD} />
        </div>
      </div>
    </div>
  );
}