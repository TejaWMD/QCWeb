import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import InLineRow from "@/components/packaging/InLineRow";
import { newGroupId, receiveStock } from "@/lib/packaging";
import { todayStr } from "@/lib/warehouse";

let seq = 0;
const blankLine = (item) => ({
  key: `in${++seq}`,
  item_id: item?.id || "",
  quantity: "",
  batch_number: "",
  rack_location: item?.default_rack || "",
  expiry_date: "",
  remarks: "",
});

export default function StockInDialog({ open, item, items, racks, user, onClose, onSaved }) {
  const [header, setHeader] = useState({ date: todayStr(), supplier: "", delivery_note: "" });
  const [lines, setLines] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setLines([blankLine(item)]);
    setHeader({ date: todayStr(), supplier: item?.supplier || "", delivery_note: "" });
  }, [open, item]);

  const setLine = (key, patch) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const save = async () => {
    for (let i = 0; i < lines.length; i += 1) {
      const l = lines[i];
      if (!l.item_id) return setError(`Line ${i + 1}: select an item.`);
      if (!(Number(l.quantity) > 0)) return setError(`Line ${i + 1}: quantity must be greater than zero.`);
      if (!(l.batch_number || "").trim()) return setError(`Line ${i + 1}: batch number is required.`);
      if (!l.rack_location) return setError(`Line ${i + 1}: select a rack location.`);
    }
    setError("");
    setSaving(true);
    const group = newGroupId("IN");
    try {
      for (const l of lines) {
        const live = await base44.entities.PackagingItem.get(l.item_id);
        await receiveStock({
          item: live,
          quantity: Number(l.quantity),
          user,
          extras: {
            movement_date: header.date,
            supplier: header.supplier,
            delivery_note: header.delivery_note,
            batch_number: l.batch_number.trim(),
            rack_location: l.rack_location,
            expiry_date: l.expiry_date,
            remarks: l.remarks,
            source: "Stock in",
            group_id: group,
          },
        });
      }
      await base44.entities.AuditLog.create({
        event_time: new Date().toISOString(),
        event_stamp: `${header.date}`,
        user_name: user?.full_name || user?.email || "",
        module: "Packaging Stock",
        action: "Created",
        record_id: group,
        details: `Stock in: ${lines.length} line${lines.length === 1 ? "" : "s"}${header.delivery_note ? ` on delivery note ${header.delivery_note}` : ""}`,
      }).catch(() => {});
      onSaved?.();
      onClose?.();
    } catch (e) {
      setError(e?.message || "Could not save the stock in.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="bg-[#131926] border-[#1e2740] text-white max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">Stock in</DialogTitle>
          <DialogDescription className="text-[#a0aec0] text-sm">
            Adds to stock on hand and logs an In movement. Several lines can share one delivery note.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Date</label>
            <Input type="date" value={header.date} onChange={(e) => setHeader((h) => ({ ...h, date: e.target.value }))} className="bg-[#0e131d] border-[#1e2740] text-white" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Supplier</label>
            <Input value={header.supplier} onChange={(e) => setHeader((h) => ({ ...h, supplier: e.target.value }))} placeholder="Optional" className="bg-[#0e131d] border-[#1e2740] text-white" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Delivery Note</label>
            <Input value={header.delivery_note} onChange={(e) => setHeader((h) => ({ ...h, delivery_note: e.target.value }))} placeholder="Optional" className="bg-[#0e131d] border-[#1e2740] text-white" />
          </div>
        </div>

        <div className="space-y-2">
          {lines.map((line) => (
            <InLineRow
              key={line.key}
              line={line}
              items={items}
              racks={racks}
              onChange={(patch) => setLine(line.key, patch)}
              onRemove={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
              removable={lines.length > 1}
            />
          ))}
        </div>

        <Button
          variant="outline"
          onClick={() => setLines((prev) => [...prev, blankLine(null)])}
          className="border-dashed border-[#1e2740] bg-transparent text-[#a0aec0] hover:bg-white/5 hover:text-white"
        >
          <Plus className="w-4 h-4" /> Add line
        </Button>

        {error && <p className="text-xs text-[#ff4d4d]">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-[#a0aec0] hover:bg-white/5 hover:text-white">Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-[#00ff9d] hover:bg-[#00e08a] text-[#0a0e17] font-semibold">
            {saving ? "Saving..." : "Record stock in"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}