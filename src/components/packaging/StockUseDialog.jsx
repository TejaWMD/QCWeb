import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { productionLines } from "@/lib/shiftLogConstants";
import { fefoBatch, fmtQty, loadItemBatches, submitStockUse } from "@/lib/packaging";

const FIELD = "bg-[#0e131d] border-[#1e2740] text-white";

export default function StockUseDialog({ open, item, user, orders = [], threshold = 0, onClose, onSaved }) {
  const [rows, setRows] = useState([]);
  const [batchKey, setBatchKey] = useState("none");
  const [form, setForm] = useState({ quantity: "", production_order: "", production_line: "", remarks: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !item) return;
    setForm({ quantity: "", production_order: "", production_line: "", remarks: "" });
    setError("");
    setLoading(true);
    loadItemBatches(item.id)
      .then((result) => {
        setRows(result);
        const suggested = fefoBatch(result);
        setBatchKey(suggested ? suggested.key : "none");
      })
      .finally(() => setLoading(false));
  }, [open, item?.id]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const chosen = rows.find((r) => r.key === batchKey) || null;
  const qty = Number(form.quantity) || 0;
  const needsApproval = threshold > 0 && qty > threshold;
  const available = Number(item?.quantity) || 0;

  const save = async () => {
    if (!(qty > 0)) return setError("Quantity must be greater than zero.");
    if (qty > available) return setError(`Only ${fmtQty(available)} ${item.unit || ""} in stock.`);
    setError("");
    setSaving(true);
    try {
      const result = await submitStockUse({
        item,
        quantity: qty,
        user,
        threshold,
        extras: {
          batch_number: chosen?.batch_number || "",
          rack_location: chosen?.rack_location || "",
          production_order: form.production_order,
          production_line: form.production_line,
          remarks: form.remarks,
          source: "Stock use",
        },
      });
      onSaved?.(result);
      onClose?.();
    } catch (e) {
      setError(e?.message || "Could not record the stock use.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="bg-[#131926] border-[#1e2740] text-white max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Use stock</DialogTitle>
          <DialogDescription className="text-[#a0aec0] text-sm">
            {item ? `${item.item_code} · available ${fmtQty(available)} ${item.unit || ""}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Quantity *</label>
            <Input type="number" min="0" step="0.001" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} placeholder="0" className={FIELD} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Batch</label>
            <Select value={batchKey} onValueChange={setBatchKey} disabled={loading}>
              <SelectTrigger className={FIELD}>
                <SelectValue placeholder={loading ? "Loading..." : "No batch"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No batch</SelectItem>
                {rows.filter((r) => r.quantity > 0 && r.batch_number).map((r) => (
                  <SelectItem key={r.key} value={r.key}>
                    {r.batch_number} · {fmtQty(r.quantity)} left{r.expiry_date ? ` · exp ${r.expiry_date}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Production Order</label>
            <Select value={form.production_order || "none"} onValueChange={(v) => set("production_order", v === "none" ? "" : v)}>
              <SelectTrigger className={FIELD}><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {orders.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Line</label>
            <Select value={form.production_line || "none"} onValueChange={(v) => set("production_line", v === "none" ? "" : v)}>
              <SelectTrigger className={FIELD}><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {productionLines.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Remarks</label>
            <Input value={form.remarks} onChange={(e) => set("remarks", e.target.value)} placeholder="Optional" className={FIELD} />
          </div>
        </div>

        {chosen?.expiry_date && (
          <p className="text-[11px] text-[#00ff9d]">Suggested by earliest expiry (FEFO): batch {chosen.batch_number} · {chosen.expiry_date}</p>
        )}
        {needsApproval && (
          <p className="text-[11px] text-[#ff9f43]">
            {fmtQty(qty)} is above the {fmtQty(threshold)} approval threshold — this issue will be sent to approvals instead of being deducted.
          </p>
        )}
        {error && <p className="text-xs text-[#ff4d4d]">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-[#a0aec0] hover:bg-white/5 hover:text-white">Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-[#00e5ff] hover:bg-[#00c3d7] text-[#0a0e17] font-semibold">
            {saving ? "Saving..." : needsApproval ? "Send for approval" : "Record use"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}