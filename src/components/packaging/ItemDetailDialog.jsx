import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fefoBatch, fmtQty, loadItemBatches } from "@/lib/packaging";

// Batch and rack breakdown for one item, with expiry dates and the FEFO pick.
export default function ItemDetailDialog({ open, item, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    setLoading(true);
    loadItemBatches(item.id).then(setRows).finally(() => setLoading(false));
  }, [open, item?.id]);

  const suggested = fefoBatch(rows);
  const total = rows.reduce((s, r) => s + r.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="bg-[#131926] border-[#1e2740] text-white max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">{item?.item_code} · stock by batch &amp; rack</DialogTitle>
          <DialogDescription className="text-[#a0aec0] text-sm">
            {item?.description} · {fmtQty(total)} {item?.unit || ""} across {rows.filter((r) => r.quantity > 0).length} batch location(s)
          </DialogDescription>
        </DialogHeader>

        {suggested && (
          <p className="text-[11px] text-[#00ff9d]">
            FEFO suggestion: batch {suggested.batch_number}
            {suggested.expiry_date ? ` (expiry ${suggested.expiry_date})` : ""} at rack {suggested.rack_location || "—"}
          </p>
        )}

        <div className="rounded-lg border border-[#1e2740] overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[#1e2740] hover:bg-transparent">
                <TableHead className="text-[#5f6b7f]">Batch</TableHead>
                <TableHead className="text-[#5f6b7f]">Rack</TableHead>
                <TableHead className="text-[#5f6b7f]">Expiry</TableHead>
                <TableHead className="text-[#5f6b7f] text-right">Quantity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={4} className="text-[#a0aec0] text-center py-4">Loading…</TableCell></TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-[#5f6b7f] text-center py-4">No movements recorded yet.</TableCell></TableRow>
              )}
              {!loading && rows.map((r) => (
                <TableRow key={r.key} className="border-[#1e2740] hover:bg-white/5">
                  <TableCell className="text-white">{r.batch_number || "—"}</TableCell>
                  <TableCell className="text-[#a0aec0]">{r.rack_location || "—"}</TableCell>
                  <TableCell className="text-[#a0aec0]">{r.expiry_date || "—"}</TableCell>
                  <TableCell className={`text-right font-medium ${r.quantity > 0 ? "text-white" : "text-[#5f6b7f]"}`}>
                    {fmtQty(r.quantity)} {item?.unit || ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}