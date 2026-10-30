import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Check, Plus, X } from "lucide-react";
import ReworkDialog from "@/components/yieldloss/ReworkDialog";
import { panelClass, primaryButton, labelClass } from "@/components/planning/styles";
import { actingUserName } from "@/lib/permissions";
import { loadProducts } from "@/lib/planning";
import { loadBatchRecords, fmtDay } from "@/lib/labels";
import { canApproveRework, canEnterYieldLoss, fmtKg, loadBatchYields, loadReworks, logYieldAudit } from "@/lib/yieldLoss";

export default function ReworkTab({ settings }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState({ reworks: [], records: [], products: [], yields: [] });
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const [reworks, records, products, yields] = await Promise.all([loadReworks(), loadBatchRecords(), loadProducts(), loadBatchYields()]);
    setData({ reworks, records, products, yields });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const decide = async (record, decision) => {
    await base44.entities.ReworkRecord.update(record.id, {
      qa_clearance: decision,
      qa_approved_by: actingUserName(user),
      qa_approved_date: new Date().toISOString(),
      status: "Closed",
    });
    await logYieldAudit({
      user,
      action: decision === "Cleared" ? "Verified" : "Updated",
      recordId: record.id,
      details: `Rework ${record.rework_lot_id} disposition ${decision.toLowerCase()} by QA (${record.disposition}${record.reused_batch ? ` → ${record.reused_batch}` : ""})`,
      oldValue: record.qa_clearance || "Pending",
      newValue: decision,
    });
    toast({ title: `Rework ${decision.toLowerCase()}`, description: record.rework_lot_id });
    load();
  };

  if (loading) return <div className={`${panelClass} p-8 text-center text-sm text-[#5f6b7f]`}>Loading rework records…</div>;

  const rows = data.reworks;
  const totalKg = rows.reduce((sum, r) => sum + (r.quantity_kg || 0), 0);
  const pendingQa = rows.filter((r) => r.qa_clearance === "Pending").length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#5f6b7f]">
          <span>{rows.length} record{rows.length === 1 ? "" : "s"} · {fmtKg(totalKg)} total</span>
          {pendingQa > 0 && <span className="text-[#ff9f43] font-semibold">{pendingQa} awaiting QA</span>}
          <span>max {settings.max_rework_pct}% per batch</span>
        </div>
        {canEnterYieldLoss(user) && (
          <Button onClick={() => setOpen(true)} className={primaryButton}><Plus className="w-4 h-4 mr-1" /> New rework</Button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className={`${panelClass} p-8 text-center`}>
          <p className="text-sm text-[#a0aec0]">No rework recorded yet.</p>
          <p className="text-xs text-[#5f6b7f] mt-1">Every rework gets its own lot ID, and a reused lot is linked to the new batch for traceability.</p>
        </div>
      ) : (
        <div className={`${panelClass} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#5f6b7f] text-[10px] uppercase tracking-widest">
                <th className="px-3 py-2 text-left font-semibold">Rework lot</th>
                <th className="px-3 py-2 text-left font-semibold">Date</th>
                <th className="px-3 py-2 text-left font-semibold">Source batch</th>
                <th className="px-3 py-2 text-right font-semibold">Qty kg</th>
                <th className="px-3 py-2 text-right font-semibold">Rework %</th>
                <th className="px-3 py-2 text-left font-semibold">Reason</th>
                <th className="px-3 py-2 text-left font-semibold">Disposition</th>
                <th className="px-3 py-2 text-left font-semibold">QA</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[#131926]">
                  <td className="px-3 py-2 text-[#00e5ff] font-semibold whitespace-nowrap">{r.rework_lot_id}</td>
                  <td className="px-3 py-2 text-white whitespace-nowrap">{fmtDay(r.rework_date)}</td>
                  <td className="px-3 py-2 text-[#a0aec0]">
                    {r.source_batch}
                    <span className="block text-[10px] text-[#5f6b7f]">{r.product_name}</span>
                  </td>
                  <td className="px-3 py-2 text-right text-[#e2e8f0]">{fmtKg(r.quantity_kg)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${r.exceeds_max ? "text-[#ff4d4d]" : "text-[#a0aec0]"}`}>{r.rework_pct ?? 0}%</td>
                  <td className="px-3 py-2 text-[#a0aec0]">{r.reason}</td>
                  <td className="px-3 py-2 text-[#a0aec0]">
                    {r.disposition}
                    {r.reused_batch && <span className="block text-[10px] text-[#00e5ff]">→ {r.reused_batch}{r.reused_qty_kg ? ` (${fmtKg(r.reused_qty_kg)})` : ""}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                      r.qa_clearance === "Cleared"
                        ? "text-[#00ff9d] border-[#00ff9d]/30 bg-[#00ff9d]/10"
                        : r.qa_clearance === "Rejected"
                          ? "text-[#ff4d4d] border-[#ff4d4d]/40 bg-[#ff4d4d]/10"
                          : "text-[#ff9f43] border-[#ff9f43]/30 bg-[#ff9f43]/10"
                    }`}>{r.qa_clearance || "Pending"}</span>
                    {(r.allergen_concern || r.halal_concern) && (
                      <span className="flex items-center gap-1 text-[10px] text-[#ff9f43] mt-1">
                        <AlertTriangle className="w-3 h-3" />
                        {[r.allergen_concern ? "allergen" : null, r.halal_concern ? "halal" : null].filter(Boolean).join(" + ")}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right space-x-1 whitespace-nowrap">
                    {canApproveRework(user) && r.qa_clearance === "Pending" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => decide(r, "Cleared")} className="border-[#00ff9d]/40 bg-transparent text-[#00ff9d] hover:bg-[#00ff9d]/10">
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => decide(r, "Rejected")} className="border-[#ff4d4d]/40 bg-transparent text-[#ff4d4d] hover:bg-[#ff4d4d]/10">
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className={labelClass}>Reused lots appear on the Traceability page of both the source and the receiving batch.</p>

      <ReworkDialog
        open={open}
        onClose={() => setOpen(false)}
        settings={settings}
        records={data.records}
        products={data.products}
        yields={data.yields}
        reworks={data.reworks}
        onSaved={load}
      />
    </div>
  );
}