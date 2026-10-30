import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtQty } from "@/lib/planning";
import { dialogClass } from "@/components/planning/styles";

const STATUS_STYLES = {
  Active: "bg-[#00ff9d]/10 text-[#00ff9d] border-[#00ff9d]/30",
  Superseded: "bg-[#3a4560]/20 text-[#a0aec0] border-[#3a4560]",
};

// History of one shared recipe: every item code that uses it is shown in the
// subtitle, and each saved version is listed newest first.
export default function RecipeHistoryDialog({ open, onClose, title, subtitle, versions = [] }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={dialogClass}>
        <DialogHeader>
          <DialogTitle className="text-white">Recipe history — {title}</DialogTitle>
          <p className="text-xs text-[#5f6b7f]">{subtitle}</p>
        </DialogHeader>

        <div className="space-y-2">
          {versions.length === 0 && <p className="text-sm text-[#5f6b7f]">No versions stored yet.</p>}
          {versions.map((v) => (
            <div key={v.id} className="rounded-lg border border-[#1e2740] bg-[#0e131d] p-3 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-white font-semibold">
                  Version {v.version}
                  <span className="text-[#5f6b7f] font-normal"> · {fmtQty(v.batch_cartons)} cartons / batch</span>
                </p>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[v.status] || ""}`}>{v.status}</span>
              </div>
              <p className="text-[11px] text-[#5f6b7f]">
                {v.created_by || "—"} · {(v.effective_date || v.created_date || "").slice(0, 10)}
                {v.standard_yield_pct ? ` · std yield ${fmtQty(v.standard_yield_pct)}%` : ""}
              </p>
              <ul className="text-xs text-[#a0aec0] space-y-0.5">
                {(v.ingredients || []).map((i, idx) => (
                  <li key={idx}>
                    {i.material_name || i.item_code || "Ingredient"} — {fmtQty(i.quantity_per_batch)} {i.unit || ""}
                  </li>
                ))}
              </ul>
              {v.notes && <p className="text-[11px] text-[#5f6b7f]">{v.notes}</p>}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}