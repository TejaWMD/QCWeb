import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { fmtQty, requestAdjustment } from "@/lib/packaging";

export default function StockCheckDialog({ open, item, user, onClose, onSaved }) {
  const [counted, setCounted] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setCounted("");
    setReason("");
    setError("");
  }, [open, item?.id]);

  const system = Number(item?.quantity) || 0;
  const difference = counted === "" ? 0 : (Number(counted) || 0) - system;

  const save = async () => {
    if (counted === "") return setError("Enter the counted quantity.");
    if (difference === 0) return setError("The counted quantity matches the system quantity — no adjustment needed.");
    setError("");
    setSaving(true);
    try {
      await requestAdjustment({ item, counted: Number(counted), user, reason });
      onSaved?.();
      onClose?.();
    } catch (e) {
      setError(e?.message || "Could not raise the adjustment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="bg-[#131926] border-[#1e2740] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Stock count</DialogTitle>
          <DialogDescription className="text-[#a0aec0] text-sm">
            {item ? `${item.item_code} · system quantity ${fmtQty(system)} ${item.unit || ""}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Counted Quantity *</label>
            <Input type="number" min="0" step="0.001" value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="0" className="bg-[#0e131d] border-[#1e2740] text-white" />
          </div>

          <div className={`rounded-lg border px-3 py-2 text-sm ${difference === 0 ? "border-[#1e2740] bg-[#0e131d] text-[#a0aec0]" : "border-[#ff9f43]/40 bg-[#ff9f43]/10 text-[#ff9f43]"}`}>
            Difference: {difference > 0 ? "+" : ""}{fmtQty(difference)} {item?.unit || ""}
            {difference !== 0 && <span className="block text-[11px] mt-0.5">A stock adjustment request will be sent for approval.</span>}
          </div>

          {difference !== 0 && (
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Reason *</label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why the count differs" className="bg-[#0e131d] border-[#1e2740] text-white" />
            </div>
          )}

          {error && <p className="text-xs text-[#ff4d4d]">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-[#a0aec0] hover:bg-white/5 hover:text-white">Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-[#ff9f43] hover:bg-[#f58a1f] text-[#0a0e17] font-semibold">
            {saving ? "Saving..." : "Send for approval"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}