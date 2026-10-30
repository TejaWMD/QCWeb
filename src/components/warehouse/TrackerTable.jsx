import React from "react";
import { Pencil, Lock } from "lucide-react";
import { canEditReceipt } from "@/lib/warehouse";

const th = "text-left px-3 py-2 text-[10px] uppercase tracking-widest font-semibold text-[#5f6b7f] whitespace-nowrap";

const EditAction = ({ record, user, onEdit }) => {
  if (canEditReceipt(user, record)) {
    return (
      <button
        type="button"
        onClick={() => onEdit(record)}
        title="Edit entry"
        className="text-[#00e5ff] hover:bg-white/5 p-2 rounded-md"
      >
        <Pencil className="w-4 h-4" />
      </button>
    );
  }
  return (
    <span title="Editing closed — 24 hours passed, supervisor only" className="text-[#3a465c] p-2 inline-flex">
      <Lock className="w-4 h-4" />
    </span>
  );
};

// Goods log: a table on desktop and cards on phones and tablets.
export default function TrackerTable({ rows, user, onEdit, loading }) {
  if (loading) {
    return <p className="py-10 text-center text-sm text-[#5f6b7f]">Loading goods…</p>;
  }
  if (!rows.length) {
    return <p className="py-10 text-center text-sm text-[#5f6b7f]">No received goods match these filters.</p>;
  }

  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="border-b border-[#1e2740]">
              <th className={th}>Date</th>
              <th className={th}>Item Code</th>
              <th className={th}>Description</th>
              <th className={th}>Batch</th>
              <th className={th}>Qty Received</th>
              <th className={th}>Rack</th>
              <th className={th}>Received By</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-[#131926] hover:bg-white/[0.03]">
                <td className="px-3 py-2.5 text-[#a0aec0] whitespace-nowrap">{row.date_received}</td>
                <td className="px-3 py-2.5 text-white font-medium whitespace-nowrap">
                  {row.item_code}
                  {row.product_id && (
                    <span className="block text-[10px] text-[#00e5ff]">Product Master · {row.product_code}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-[#a0aec0] max-w-[260px] truncate">{row.product_description || "—"}</td>
                <td className="px-3 py-2.5 text-[#a0aec0] whitespace-nowrap">{row.batch_number}</td>
                <td className="px-3 py-2.5 text-white whitespace-nowrap">
                  {row.quantity} <span className="text-[#5f6b7f] text-xs">{row.unit || ""}</span>
                </td>
                <td className="px-3 py-2.5 text-[#a0aec0] whitespace-nowrap">{row.rack_location || "—"}</td>
                <td className="px-3 py-2.5 text-[#a0aec0] whitespace-nowrap max-w-[160px] truncate">{row.received_by || "—"}</td>
                <td className="px-3 py-2.5 text-right"><EditAction record={row} user={user} onEdit={onEdit} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="rounded-lg border border-[#1e2740] bg-[#0e131d] p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{row.item_code}</p>
                <p className="text-xs text-[#a0aec0] truncate">{row.product_description || "—"}</p>
                {row.product_id && <p className="text-[10px] text-[#00e5ff]">Product Master · {row.product_code}</p>}
              </div>
              <EditAction record={row} user={user} onEdit={onEdit} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <p className="text-[#5f6b7f]">Date <span className="text-[#a0aec0]">{row.date_received}</span></p>
              <p className="text-[#5f6b7f]">Batch <span className="text-[#a0aec0]">{row.batch_number}</span></p>
              <p className="text-[#5f6b7f]">Qty <span className="text-white">{row.quantity} {row.unit || ""}</span></p>
              <p className="text-[#5f6b7f]">Rack <span className="text-[#a0aec0]">{row.rack_location || "—"}</span></p>
              <p className="text-[#5f6b7f] col-span-2">Received by <span className="text-[#a0aec0]">{row.received_by || "—"}</span></p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}