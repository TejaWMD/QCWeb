import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { actingUserName } from "@/lib/permissions";
import { canEditReceipt, eventStamp } from "@/lib/warehouse";

const FIELD = "bg-[#0e131d] border-[#1e2740] text-white";

const FIELDS = [
  ["item_code", "Item Code"],
  ["product_description", "Description"],
  ["batch_number", "Batch Number"],
  ["quantity", "Quantity"],
  ["unit", "Unit"],
  ["rack_location", "Rack"],
  ["expiry_date", "Expiry Date"],
  ["supplier", "Supplier"],
  ["delivery_note", "Delivery Note"],
  ["remarks", "Remarks"],
];

// Edits one received line. Every edit is written to the Audit Trail.
export default function EditReceiptDialog({ record, user, units, racks, onClose, onSaved }) {
  const [values, setValues] = useState({ ...record });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const editable = canEditReceipt(user, record);

  const set = (key, value) => setValues((v) => ({ ...v, [key]: value }));

  const save = async () => {
    if (!editable) return setError("This entry is past its 24-hour edit window. Ask a supervisor to change it.");
    if (!(Number(values.quantity) > 0)) return setError("Quantity must be greater than zero.");
    setSaving(true);
    setError("");
    try {
      const page = await base44.entities.GoodsReceipt.filter(
        { date_received: values.date_received, batch_number: values.batch_number },
        { limit: 20 }
      );
      const clash = (page.items || []).find(
        (r) => r.id !== record.id && (r.item_code || "").toLowerCase() === (values.item_code || "").toLowerCase()
      );
      if (clash) throw new Error("This item code and batch number was already received today.");

      const changed = FIELDS.filter(([key]) => String(record[key] ?? "") !== String(values[key] ?? "")).map(([, label]) => label);
      const payload = {
        item_code: values.item_code,
        product_description: values.product_description,
        batch_number: values.batch_number,
        quantity: Number(values.quantity),
        unit: values.unit,
        rack_location: values.rack_location,
        expiry_date: values.expiry_date,
        supplier: values.supplier,
        delivery_note: values.delivery_note,
        remarks: values.remarks,
        edited_by: actingUserName(user),
        edited_date: new Date().toISOString(),
      };
      await base44.entities.GoodsReceipt.update(record.id, payload);
      try {
        await base44.entities.AuditLog.create({
          event_time: new Date().toISOString(),
          event_stamp: eventStamp(),
          user_name: actingUserName(user),
          module: "Warehouse Goods Tracker",
          action: "Updated",
          record_id: record.id,
          details: changed.length
            ? `Edited received goods ${values.item_code} / batch ${values.batch_number}: ${changed.join(", ")}`
            : `Edited received goods ${values.item_code} / batch ${values.batch_number} (no field changed)`,
          old_value: `${record.quantity ?? ""} ${record.unit || ""}`.trim(),
          new_value: `${values.quantity ?? ""} ${values.unit || ""}`.trim(),
        });
      } catch {
        // An audit write must never block the edit itself.
      }
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e?.message || "Could not save the changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#131926] border-[#1e2740] text-white max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">Edit received goods</DialogTitle>
          <DialogDescription className="text-[#a0aec0] text-sm">
            {record.item_code} · batch {record.batch_number} · received {record.date_received}
          </DialogDescription>
        </DialogHeader>

        {!editable && (
          <p className="text-xs text-[#ff9f43]">
            The 24-hour edit window for this entry has closed. Only an Admin or Warehouse Supervisor can change it.
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Item Code</label>
            <Input value={values.item_code || ""} onChange={(e) => set("item_code", e.target.value)} className={FIELD} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Description</label>
            <Input value={values.product_description || ""} onChange={(e) => set("product_description", e.target.value)} className={FIELD} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Batch Number</label>
            <Input value={values.batch_number || ""} onChange={(e) => set("batch_number", e.target.value)} className={FIELD} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Quantity</label>
            <Input type="number" min="0" step="any" value={values.quantity ?? ""} onChange={(e) => set("quantity", e.target.value)} className={FIELD} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Unit</label>
            <Select value={values.unit || undefined} onValueChange={(v) => set("unit", v)}>
              <SelectTrigger className={FIELD}><SelectValue placeholder="Select unit" /></SelectTrigger>
              <SelectContent>{units.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Rack</label>
            <Select value={values.rack_location || undefined} onValueChange={(v) => set("rack_location", v)}>
              <SelectTrigger className={FIELD}><SelectValue placeholder="Select rack" /></SelectTrigger>
              <SelectContent>{racks.map((r) => <SelectItem key={r.id} value={r.rack_code}>{r.rack_code}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Expiry Date</label>
            <Input type="date" value={values.expiry_date || ""} onChange={(e) => set("expiry_date", e.target.value)} className={FIELD} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Supplier</label>
            <Input value={values.supplier || ""} onChange={(e) => set("supplier", e.target.value)} className={FIELD} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Delivery Note</label>
            <Input value={values.delivery_note || ""} onChange={(e) => set("delivery_note", e.target.value)} className={FIELD} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Remarks</label>
            <Input value={values.remarks || ""} onChange={(e) => set("remarks", e.target.value)} className={FIELD} />
          </div>
        </div>

        {error && <p className="text-xs text-[#ff4d4d]">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-[#a0aec0] hover:bg-white/5 hover:text-white">Cancel</Button>
          <Button onClick={save} disabled={saving || !editable} className="bg-[#00e5ff] hover:bg-[#00c3d7] text-[#0a0e17]">
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}