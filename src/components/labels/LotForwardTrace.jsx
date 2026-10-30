import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, PackageSearch } from "lucide-react";
import { fmtDay } from "@/lib/labels";
import { fmtQty } from "@/lib/production";
import { panelClass, labelClass } from "@/components/planning/styles";

// Forward trace from a supplier lot: what was received under it and which
// finished batches used it.
export default function LotForwardTrace({ lot, matches = [], lotInfo = { receipts: [], movements: [] } }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.2fr] gap-4 items-start">
      <div className={`${panelClass} p-4 space-y-3`}>
        <div>
          <p className={labelClass}>Supplier lot</p>
          <p className="text-white text-base font-semibold break-all mt-0.5">{lot}</p>
        </div>

        <div>
          <p className={`${labelClass} mb-1`}>Goods received under this lot</p>
          {lotInfo.receipts.length === 0 ? (
            <p className="text-xs text-[#5f6b7f]">No goods receipt uses this lot number.</p>
          ) : (
            <ul className="space-y-1">
              {lotInfo.receipts.map((r) => (
                <li key={r.id} className="text-xs text-[#a0aec0]">
                  <span className="text-white">{r.product_description || r.item_code}</span> · {fmtQty(r.quantity)} {r.unit || ""}
                  <span className="block text-[10px] text-[#5f6b7f]">
                    {r.supplier || "supplier not set"} · received {fmtDay(r.date_received)}
                    {r.expiry_date ? ` · exp ${fmtDay(r.expiry_date)}` : ""}{r.rack_location ? ` · ${r.rack_location}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className={`${labelClass} mb-1`}>Packaging issued under this lot</p>
          {lotInfo.movements.length === 0 ? (
            <p className="text-xs text-[#5f6b7f]">No stock movement uses this lot number.</p>
          ) : (
            <ul className="space-y-1">
              {lotInfo.movements.map((m) => (
                <li key={m.id} className="text-xs text-[#a0aec0]">
                  <span className="text-white">{m.item_name || m.item_code}</span> · {fmtQty(m.quantity)} {m.unit || ""}
                  <span className="block text-[10px] text-[#5f6b7f]">
                    {m.type} · {m.production_order || m.production_line || "no order"} · {fmtDay(m.movement_date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={`${panelClass} p-4`}>
        <p className={`${labelClass} flex items-center gap-1 mb-2`}>
          <PackageSearch className="w-3 h-3" /> Finished batches that used this lot ({matches.length})
        </p>
        {matches.length === 0 ? (
          <p className="text-xs text-[#5f6b7f]">No finished batch has been traced back to this lot yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {matches.map(({ record, via }) => (
              <li key={record.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs border-b border-[#131926] last:border-0 pb-1.5 last:pb-0">
                <Link to={`/traceability?batch=${encodeURIComponent(record.batch_number)}`} className="text-[#00e5ff] font-semibold hover:underline flex items-center gap-1">
                  {record.batch_number} <ArrowUpRight className="w-3 h-3" />
                </Link>
                <span className="text-white">{record.product_name}</span>
                <span className="text-[#5f6b7f]">{fmtDay(record.production_date)}</span>
                <span className="text-[#a0aec0]">{fmtQty(record.quantity_cartons)} cartons</span>
                <span className="text-[10px] text-[#5f6b7f] flex-1 min-w-[140px]">{via}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}