import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Plus, ShieldCheck } from "lucide-react";
import FillCheckDialog from "@/components/yieldloss/FillCheckDialog";
import { panelClass, primaryButton, labelClass } from "@/components/planning/styles";
import { actingUserName } from "@/lib/permissions";
import { loadProducts } from "@/lib/planning";
import { loadBatchRecords, fmtDay } from "@/lib/labels";
import { createCapaDraft } from "@/lib/capaDraft";
import { canEnterYieldLoss, canVerifyRecord, loadFillChecks, logYieldAudit } from "@/lib/yieldLoss";

export default function GiveawayTab({ settings }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState({ checks: [], products: [], records: [] });
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const [checks, products, records] = await Promise.all([loadFillChecks(), loadProducts(), loadBatchRecords()]);
    setData({ checks, products, records });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const raiseCapa = async (record) => {
    const capa = await createCapaDraft(user, {
      title: `Underweight packs on ${record.production_line} · ${record.product_name}`,
      source_module: "Yield & Loss — Fill Weight",
      production_line: record.production_line,
      shift_date: record.check_date,
      description: `${record.underweight_count} of ${record.sample_count} samples fell below the ${record.lower_limit_g} g underweight limit (average ${record.avg_g} g, target ${record.target_weight_g} g). Batch ${record.batch_number || "—"}.`,
      source_record_id: record.id,
    });
    if (capa?.id) {
      await base44.entities.FillCheck.update(record.id, { capa_id: capa.id });
      await logYieldAudit({ user, action: "Updated", recordId: record.id, details: `CAPA raised for underweight samples on ${record.production_line}`, newValue: "CAPA linked" });
    }
    toast({ title: "CAPA raised", description: "Track it in the Unified CAPA Tracker." });
    load();
  };

  const verify = async (record) => {
    await base44.entities.FillCheck.update(record.id, {
      status: "Verified",
      verified_by: actingUserName(user),
      verified_date: new Date().toISOString(),
    });
    await logYieldAudit({
      user,
      action: "Verified",
      recordId: record.id,
      details: `Fill check ${record.production_line} on ${record.check_date} verified (giveaway ${record.giveaway_pct}%)`,
      oldValue: "Draft",
      newValue: "Verified",
    });
    toast({ title: "Fill check verified", description: record.production_line });
    load();
  };

  if (loading) return <div className={`${panelClass} p-8 text-center text-sm text-[#5f6b7f]`}>Loading fill checks…</div>;

  const riskCount = data.checks.filter((c) => c.compliance_risk && !c.capa_id).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs text-[#5f6b7f]">{data.checks.length} check{data.checks.length === 1 ? "" : "s"}</p>
          {riskCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-[#ff4d4d] font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" /> {riskCount} underweight risk{riskCount === 1 ? "" : "s"} without a CAPA
            </span>
          )}
        </div>
        {canEnterYieldLoss(user) && (
          <Button onClick={() => setOpen(true)} className={primaryButton}><Plus className="w-4 h-4 mr-1" /> New fill check</Button>
        )}
      </div>

      {data.checks.length === 0 ? (
        <div className={`${panelClass} p-8 text-center`}>
          <p className="text-sm text-[#a0aec0]">No fill-weight checks yet.</p>
          <p className="text-xs text-[#5f6b7f] mt-1">Weigh a few packs per check and the giveaway is calculated against the target net weight.</p>
        </div>
      ) : (
        <div className={`${panelClass} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#5f6b7f] text-[10px] uppercase tracking-widest">
                <th className="px-3 py-2 text-left font-semibold">Date · time</th>
                <th className="px-3 py-2 text-left font-semibold">Line</th>
                <th className="px-3 py-2 text-left font-semibold">Product / batch</th>
                <th className="px-3 py-2 text-right font-semibold">Target</th>
                <th className="px-3 py-2 text-right font-semibold">Average</th>
                <th className="px-3 py-2 text-right font-semibold">Giveaway</th>
                <th className="px-3 py-2 text-right font-semibold">Cost / batch</th>
                <th className="px-3 py-2 text-left font-semibold">Compliance</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.checks.map((r) => (
                <tr key={r.id} className="border-t border-[#131926]">
                  <td className="px-3 py-2 text-white whitespace-nowrap">{fmtDay(r.check_date)} {r.check_time || ""}</td>
                  <td className="px-3 py-2 text-[#a0aec0]">{r.production_line}</td>
                  <td className="px-3 py-2 text-[#a0aec0]">
                    {r.product_name}
                    <span className="block text-[10px] text-[#5f6b7f]">{r.batch_number || "no batch"} · {r.sample_count || 0} samples</span>
                  </td>
                  <td className="px-3 py-2 text-right text-[#a0aec0]">{r.target_weight_g} g</td>
                  <td className="px-3 py-2 text-right text-[#e2e8f0]">{r.avg_g} g</td>
                  <td className={`px-3 py-2 text-right font-semibold ${r.giveaway_g > 0 ? "text-[#ff9f43]" : "text-[#00ff9d]"}`}>
                    {r.giveaway_g > 0 ? "+" : ""}{r.giveaway_g} g
                    <span className="block text-[10px] font-normal text-[#5f6b7f]">{r.giveaway_pct}%</span>
                  </td>
                  <td className="px-3 py-2 text-right text-[#a0aec0]">{r.cost_per_batch ? r.cost_per_batch.toLocaleString("en-US") : "—"}</td>
                  <td className="px-3 py-2">
                    {r.compliance_risk ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border text-[#ff4d4d] border-[#ff4d4d]/40 bg-[#ff4d4d]/10">
                        <AlertTriangle className="w-3 h-3" /> {r.underweight_count} under
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#00ff9d]">OK</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                      r.status === "Verified"
                        ? "text-[#00ff9d] border-[#00ff9d]/30 bg-[#00ff9d]/10"
                        : "text-[#a0aec0] border-[#1e2740] bg-white/5"
                    }`}>{r.status}</span>
                    {r.capa_id && <span className="block text-[10px] text-[#00e5ff] mt-1">CAPA linked</span>}
                  </td>
                  <td className="px-3 py-2 text-right space-x-1 whitespace-nowrap">
                    {r.compliance_risk && !r.capa_id && canEnterYieldLoss(user) && (
                      <Button size="sm" variant="outline" onClick={() => raiseCapa(r)} className="border-[#ff4d4d]/40 bg-transparent text-[#ff4d4d] hover:bg-[#ff4d4d]/10">
                        Raise CAPA
                      </Button>
                    )}
                    {canVerifyRecord(user, r) && (
                      <Button size="sm" variant="outline" onClick={() => verify(r)} className="border-[#1e2740] bg-transparent text-[#a0aec0] hover:text-white">
                        <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Verify
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className={labelClass}>Target weight, underweight limit and cost per kg come from Product Master. Cost per batch needs a batch and a cost per kg.</p>

      <FillCheckDialog open={open} onClose={() => setOpen(false)} products={data.products} records={data.records} onSaved={load} />
    </div>
  );
}