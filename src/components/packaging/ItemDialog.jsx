import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const FIELD = "bg-[#0e131d] border-[#1e2740] text-white";

const empty = (categories, units) => ({
  item_code: "",
  description: "",
  category: categories[0] || "",
  unit: units[0] || "",
  min_level: "",
  default_rack: "",
  supplier: "",
  active: true,
  linked_product: "",
  qty_per_unit: "",
});

export default function ItemDialog({ open, item, categories, units, racks, onClose, onSaved }) {
  const [form, setForm] = useState(empty(categories, units));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm(
      item
        ? {
            item_code: item.item_code || "",
            description: item.description || "",
            category: item.category || "",
            unit: item.unit || "",
            min_level: item.min_level != null ? String(item.min_level) : "",
            default_rack: item.default_rack || "",
            supplier: item.supplier || "",
            active: item.active !== false,
            linked_product: item.linked_product || "",
            qty_per_unit: item.qty_per_unit != null ? String(item.qty_per_unit) : "",
          }
        : empty(categories, units)
    );
  }, [open, item]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.item_code.trim()) return setError("Item code is required.");
    setSaving(true);
    setError("");
    try {
      if (!item) {
        const page = await base44.entities.PackagingItem.filter({ item_code: form.item_code.trim() }, { limit: 1 });
        if ((page.items || []).length) throw new Error(`${form.item_code.trim()} is already in the packaging stock list.`);
      }
      const payload = {
        item_code: form.item_code.trim(),
        description: form.description.trim(),
        category: form.category,
        unit: form.unit,
        min_level: Number(form.min_level) || 0,
        default_rack: form.default_rack,
        supplier: form.supplier.trim(),
        active: form.active,
        linked_product: form.linked_product.trim(),
        qty_per_unit: Number(form.qty_per_unit) || 0,
      };
      const saved = item
        ? await base44.entities.PackagingItem.update(item.id, payload)
        : await base44.entities.PackagingItem.create({ ...payload, quantity: 0 });
      onSaved?.(saved);
      onClose?.();
    } catch (err) {
      setError(err?.message || "Could not save the item.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="bg-[#131926] border-[#1e2740] text-white max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-white">{item ? "Edit packaging item" : "Add packaging item"}</DialogTitle>
          <DialogDescription className="text-[#a0aec0] text-sm">
            Quantities change only through In, Use and Check so every movement stays traceable.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Item Code *</label>
              <Input value={form.item_code} onChange={(e) => set("item_code", e.target.value)} placeholder="e.g. LBL-250" className={FIELD} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Description</label>
              <Input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Item name" className={FIELD} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Category</label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger className={FIELD}><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Unit of Measure</label>
              <Select value={form.unit} onValueChange={(v) => set("unit", v)}>
                <SelectTrigger className={FIELD}><SelectValue placeholder="Select unit" /></SelectTrigger>
                <SelectContent>
                  {units.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Minimum Level</label>
              <Input type="number" min="0" value={form.min_level} onChange={(e) => set("min_level", e.target.value)} placeholder="Low stock at or below this" className={FIELD} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Default Rack</label>
              <Select value={form.default_rack || "none"} onValueChange={(v) => set("default_rack", v === "none" ? "" : v)}>
                <SelectTrigger className={FIELD}><SelectValue placeholder="Select rack" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No default rack</SelectItem>
                  {racks.map((r) => <SelectItem key={r.id} value={r.rack_code}>{r.rack_code}{r.zone ? ` · ${r.zone}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Supplier</label>
              <Input value={form.supplier} onChange={(e) => set("supplier", e.target.value)} placeholder="Optional" className={FIELD} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Linked Product</label>
              <Input value={form.linked_product} onChange={(e) => set("linked_product", e.target.value)} placeholder="Product this packs (optional)" className={FIELD} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Qty per Finished Unit</label>
              <Input type="number" min="0" step="0.001" value={form.qty_per_unit} onChange={(e) => set("qty_per_unit", e.target.value)} placeholder="e.g. 1" className={FIELD} />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Checkbox id="packaging-active" checked={form.active} onCheckedChange={(v) => set("active", v === true)} />
            <Label htmlFor="packaging-active" className="text-sm text-[#a0aec0]">Active</Label>
          </div>

          {error && <p className="text-xs text-[#ff4d4d]">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose} className="text-[#a0aec0] hover:bg-white/5 hover:text-white">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="bg-[#00e5ff] hover:bg-[#00c3d7] text-[#0a0e17] font-semibold">
              {saving ? "Saving..." : "Save item"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}