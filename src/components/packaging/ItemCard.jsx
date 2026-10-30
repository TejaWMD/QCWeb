import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowDownToLine, ArrowUpFromLine, ClipboardCheck, Pencil, Trash2, Layers } from "lucide-react";
import { fmtQty } from "@/lib/packaging";

const STATUS_STYLES = {
  "Low stock": "bg-[#ff9f43]/15 text-[#ff9f43] border-[#ff9f43]/40",
  "Pending approval": "bg-[#00e5ff]/15 text-[#00e5ff] border-[#00e5ff]/40",
  "No stock": "bg-[#ff4d4d]/15 text-[#ff4d4d] border-[#ff4d4d]/40",
  "In stock": "bg-[#00ff9d]/10 text-[#00ff9d] border-[#00ff9d]/30",
};

export default function ItemCard({ item, status, canEdit, canDelete, onIn, onUse, onCheck, onEdit, onDelete, onDetail }) {
  const inactive = item.active === false;
  return (
    <div className={`rounded-xl border border-[#1e2740] bg-[#0e131d] p-3 flex flex-col gap-3 ${inactive ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-white text-sm font-semibold truncate">{item.description || item.item_code}</p>
          <p className="text-[11px] text-[#5f6b7f] mt-0.5 truncate">
            {item.item_code}
            {item.category ? ` · ${item.category}` : ""}
            {inactive ? " · inactive" : ""}
          </p>
        </div>
        <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[status] || STATUS_STYLES["In stock"]}`}>
          {status}
        </span>
      </div>

      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-2xl text-white font-semibold leading-none">
            {fmtQty(item.quantity)} <span className="text-xs text-[#a0aec0] font-normal">{item.unit || ""}</span>
          </p>
          <p className="text-[11px] text-[#5f6b7f] mt-1">
            Min {fmtQty(item.min_level)} · Rack {item.default_rack || "—"}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onDetail} className="text-[#a0aec0] hover:bg-white/5 hover:text-white" title="Batches & racks">
          <Layers className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button size="sm" onClick={onIn} className="bg-[#00ff9d] hover:bg-[#00e08a] text-[#0a0e17] font-semibold">
          <ArrowDownToLine className="w-3.5 h-3.5" /> In
        </Button>
        <Button size="sm" onClick={onUse} className="bg-[#00e5ff] hover:bg-[#00c3d7] text-[#0a0e17] font-semibold">
          <ArrowUpFromLine className="w-3.5 h-3.5" /> Use
        </Button>
        <Button size="sm" onClick={onCheck} className="bg-[#ff9f43] hover:bg-[#f58a1f] text-[#0a0e17] font-semibold">
          <ClipboardCheck className="w-3.5 h-3.5" /> Check
        </Button>
      </div>

      <div className="flex items-center justify-end gap-1 border-t border-[#1e2740] pt-2">
        {canEdit && (
          <Button variant="ghost" size="sm" onClick={onEdit} className="text-[#a0aec0] hover:bg-white/5 hover:text-white">
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Button>
        )}
        {canDelete && (
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-[#ff4d4d] hover:bg-[#ff4d4d]/10">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}