import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Plus, ShieldCheck } from "lucide-react";
import PackagingWasteDialog from "@/components/yieldloss/PackagingWasteDialog";
import { panelClass, primaryButton, labelClass } from "@/components/planning/styles";
import { actingUserName } from "@/lib/permissions";
import { fmtDay } from "@/lib/labels";
import { productionLines } from "@/lib/shiftLogConstants";
import {
  canEnterYieldLoss, canVerifyRecord, loadIssues, loadPackagingWastes, loadShiftEntries, logYieldAudit,
} from "@/lib/yieldLoss";

export default function PackagingWasteTab({ settings }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState({ wastes: [], movements: [], shiftEntries: [] });
  const [line, setLine] = useState("all");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const [wastes, movements, shiftEntries] = await Promise.all([loadPackagingWastes(), loadIssues(), loadShiftEntries()]);
    setData({ wastes, movements, shiftEntries });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const verify = async (record) => {
    await base44.entities.PackagingWaste.update(record.id, {
      status: "Verified",
      verified_by: actingUserName(user),
      verified_date: new Date().toISOString(),
    });
    await logYieldAudit({
      user,
      action: "Verified",
      recordId: record.id,
      details: `Packaging waste ${record.production_line} ${record.shift_type} on ${record.waste_date} verified at ${record.waste_pct}%`,
      oldValue: "Draft",
      newValue: "Verified",
    });
    toast({ title: "Waste verified", description: `${record.production_line} · ${fmtDay(record.waste_date)}` });
    load();
  };

  if (loading) return <div className={`${panelClass} p-8 text-center text-sm text-[#5f6b7f]`}>Loading packaging waste…</div>;

  const rows = data.wastes.filter((r) => line === "all" || r.production_line === line);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <select value={line} onChange={(e) => setLine(e.target.value)} className="h-9 rounded-md border border-[#1e2740] bg-[#0a0e17] text-[#a0aec0] text-xs px-2">
            <option value="all">All lines</option>
            {productionLines.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <p className="text-xs text-[#5f6b7f]">{rows.length} entr{rows.length === 1 ? "y" : "ies"} · threshold {settings.packaging_waste_threshold_pct}%</p>
        </div>
        {canEnterYieldLoss(user) && (
          <Button onClick={() => setOpen(true)} className={primaryButton}><Plus className="w-4 h-4 mr-1" /> New waste entry</Button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className={`${panelClass} p-8 text-center`}>
          <p className="text-sm text-[#a0aec0]">No packaging waste recorded yet.</p>
          <p className="text-xs text-[#5f6b7f] mt-1">Figures already captured in the Daily Packaging Entry are pulled in automatically.</p>
        </div>
      ) : (
        <div className={`${panelClass} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#5f6b7f] text-[10px] uppercase tracking-widest">
                <th className="px-3 py-2 text-left font-semibold">Date</th>
                <th className="px-3 py-2 text-left font-semibold">Line</th>
                <th className="px-3 py-2 text-left font-semibold">Shift</th>
                <th className="px-3 py-2 text-right font-semibold">Film</th>
                <th className="px-3 py-2 text-right font-semibold">Cartons</th>
                <th className="px-3 py-2 text-right font-semibold">Labels</th>
                <th className="px-3 py-2 text-right font-semibold">Pouches</th>
                <th className="px-3 py-2 text-right font-semibold">Waste %</th>
                <th className="px-3 py-2 text-left font-semibold">Reason</th>
                <th className="px-3 py-2 text-left font-semibold">Source</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[#131926]">
                  <td className="px-3 py-2 text-white whitespace-nowrap">{fmtDay(r.waste_date)}</td>
                  <td className="px-3 py-2 text-[#a0aec0]">{r.production_line}</td>
                  <td className="px-3 py-2 text-[#5f6b7f]">{r.shift_type}</td>
                  <td className="px-3 py-2 text-right text-[#e2e8f0]">
                    {r.film_m ? `${r.film_m} m` : ""}{r.film_m && r.film_kg ? " · " : ""}{r.film_kg ? `${r.film_kg} kg` : ""}{!r.film_m && !r.film_kg ? "—" : ""}
                  </td>
                  <td className="px-3 py-2 text-right text-[#a0aec0]">{r.cartons || 0}</td>
                  <td className="px-3 py-2 text-right text-[#a0aec0]">{r.labels || 0}</td>
                  <td className="px-3 py-2 text-right text-[#a0aec0]">{r.pouches || 0}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${r.exceeded ? "text-[#ff4d4d]" : "text-[#00ff9d]"}`}>
                    {r.waste_pct ?? 0}%
                    <span className="block text-[10px] text-[#5f6b7f] font-normal">{r.waste_units || 0} / {r.used_units || 0} pcs</span>
                  </td>
                  <td className="px-3 py-2 text-[#a0aec0]">{r.reason || "—"}</td>
                  <td className="px-3 py-2 text-[10px] text-[#5f6b7f]">{r.source || "Manual"}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                      r.status === "Verified"
                        ? "text-[#00ff9d] border-[#00ff9d]/30 bg-[#00ff9d]/10"
                        : "text-[#a0aec0] border-[#1e2740] bg-white/5"
                    }`}>{r.status}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
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

      <p className={labelClass}>Waste % compares cartons, labels and pouches wasted against the pieces issued from Packaging Stock to that line on the day.</p>

      <PackagingWasteDialog
        open={open}
        onClose={() => setOpen(false)}
        settings={settings}
        movements={data.movements}
        shiftEntries={data.shiftEntries}
        onSaved={load}
      />
    </div>
  );
}