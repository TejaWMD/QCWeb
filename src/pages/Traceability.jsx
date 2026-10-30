import React, { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, FlaskConical } from "lucide-react";
import LabelPreview from "@/components/labels/LabelPreview";
import BatchDowntimeList from "@/components/labels/BatchDowntimeList";
import BatchLotLinks from "@/components/labels/BatchLotLinks";
import LotForwardTrace from "@/components/labels/LotForwardTrace";
import ReworkTraceList from "@/components/yieldloss/ReworkTraceList";
import useBatchTrace from "@/hooks/useBatchTrace";
import { fmtDay, layoutOfRecord } from "@/lib/labels";
import { fmtDateTime, fmtQty } from "@/lib/production";
import { panelClass, labelClass, subtleButton } from "@/components/planning/styles";
import { Button } from "@/components/ui/button";

// Opened by scanning a label QR code (batch) or from a lot chip (supplier lot).
export default function Traceability() {
  const [params] = useSearchParams();
  const batch = (params.get("batch") || "").trim();
  const lot = (params.get("lot") || "").trim();
  const { loading, record, order, downtimes, lots, packaging, lotMatches, lotInfo } = useBatchTrace(batch, lot);

  const lotMissing = !!lot && !batch && lotMatches.length === 0 && lotInfo.receipts.length === 0 && lotInfo.movements.length === 0;
  const missing = lot ? lotMissing : !record;

  useEffect(() => {
    if (loading || !missing) return undefined;
    const meta = document.createElement("meta");
    meta.name = "prerender-status-code";
    meta.content = "404";
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, [loading, missing]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e17] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#1e2740] border-t-[#00e5ff] rounded-full animate-spin" />
      </div>
    );
  }

  const facts = record ? [
    ["Product code", record.product_code || "—"],
    ["Production date", fmtDay(record.production_date)],
    ["Expiry date", fmtDay(record.expiry_date)],
    ["Quantity", `${fmtQty(record.quantity_cartons)} cartons`],
    ["Machine", record.machine || "—"],
    ["Production order", record.order_number || order?.order_number || "—"],
    ["Created by", `${record.created_by_name || "—"} · ${fmtDateTime(record.created_date)}`],
  ] : [];

  return (
    <div className="min-h-screen bg-[#0a0e17] p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-white text-lg font-semibold">{lot && !batch ? "Lot Traceability" : "Batch Traceability"}</h2>
          <p className="text-[#a0aec0] text-sm mt-1">
            {lot && !batch ? "Supplier lot:" : "Scanned batch:"} <span className="text-[#00e5ff] font-semibold">{batch || lot || "—"}</span>
          </p>
        </div>
        <Button asChild variant="outline" className={subtleButton}>
          <Link to="/batch-records"><ArrowLeft className="w-4 h-4 mr-1.5" /> Batch Records</Link>
        </Button>
      </div>

      {missing ? (
        <div className={`${panelClass} p-6 max-w-xl`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h3 className="text-white font-semibold">{lot ? "Lot not found" : "Batch not found"}</h3>
          </div>
          <p className="text-sm text-[#a0aec0]">
            {batch || lot
              ? `Nothing matches "${batch || lot}".`
              : "No batch number or lot was given in the link."} Check the label or open Batch Records.
          </p>
        </div>
      ) : lot && !batch ? (
        <LotForwardTrace lot={lot} matches={lotMatches} lotInfo={lotInfo} />
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.7fr] gap-4 items-start">
            <div className="space-y-4">
              <div className={`${panelClass} p-4 space-y-4`}>
                <div>
                  <h3 className="text-white text-base font-semibold">{record.product_name}</h3>
                  <p className="text-xs text-[#5f6b7f]">Batch {record.batch_number}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {facts.map(([label, value]) => (
                    <div key={label}>
                      <p className={labelClass}>{label}</p>
                      <p className="text-sm text-white mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>

                {record.expiry_overridden && (
                  <div className="rounded-lg border border-[#ff9f43]/40 bg-[#ff9f43]/10 px-3 py-2">
                    <p className="text-[11px] text-[#ff9f43] font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Expiry date overridden by {record.expiry_override_by || "Admin"}
                    </p>
                    <p className="text-[11px] text-[#a0aec0] mt-0.5">{record.expiry_override_reason || "No reason recorded."}</p>
                  </div>
                )}

                {order && (
                  <div className="border-t border-[#1e2740] pt-3">
                    <p className={`${labelClass} mb-1`}>Scheduled production</p>
                    <p className="text-sm text-white">{order.order_number} · {order.status}</p>
                    <p className="text-xs text-[#a0aec0] mt-0.5">
                      {order.machine || "—"} · planned {fmtDateTime(order.planned_start)}
                      {order.actual_start ? ` · actual ${fmtDateTime(order.actual_start)}` : ""}
                    </p>
                    <p className="text-xs text-[#a0aec0] mt-1">
                      Produced <span className="text-[#00ff9d] font-semibold">{fmtQty(order.produced_cartons)}</span> of {fmtQty(order.quantity_cartons)} cartons
                      {" · "}{(order.recorded_batches || []).length} batch{ (order.recorded_batches || []).length === 1 ? "" : "es"} recorded
                    </p>
                  </div>
                )}

                <div className="border-t border-[#1e2740] pt-3">
                  <p className={`${labelClass} mb-1 flex items-center gap-1`}><FlaskConical className="w-3 h-3" /> Reprint history</p>
                  {(record.reprints || []).length === 0 ? (
                    <p className="text-xs text-[#5f6b7f]">Printed once when the batch was created ({record.print_count || 0} label(s)).</p>
                  ) : (
                    <ul className="space-y-1">
                      {record.reprints.map((entry, index) => (
                        <li key={index} className="text-xs text-[#a0aec0]">
                          {entry.user_name || "—"} · {fmtDateTime(entry.date)} · {entry.copies || 1} label(s)
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <BatchDowntimeList events={downtimes} />
            </div>

            <div className={`${panelClass} p-4 space-y-2`}>
              <p className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Label as printed</p>
              <div className="overflow-x-auto pb-1">
                <div className="inline-block shadow-lg">
                  <LabelPreview
                    layout={layoutOfRecord(record)}
                    data={{
                      productName: record.product_name,
                      productCode: record.product_code,
                      batchNumber: record.batch_number,
                      productionDate: record.production_date,
                      expiryDate: record.expiry_date,
                    }}
                  />
                </div>
              </div>
              <p className="text-[11px] text-[#5f6b7f]">{record.label_layout_name || "Saved layout"}</p>
            </div>
          </div>

          <BatchLotLinks lots={lots} packaging={packaging} />
          <ReworkTraceList batchNumber={record.batch_number} />
        </>
      )}
    </div>
  );
}