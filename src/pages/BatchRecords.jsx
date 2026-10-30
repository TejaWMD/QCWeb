import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Download, ExternalLink, Printer, Search } from "lucide-react";
import LabelPrintSheet from "@/components/labels/LabelPrintSheet";
import ReprintDialog from "@/components/labels/ReprintDialog";
import { fmtDay, layoutOfRecord, loadBatchRecords, logLabelAudit } from "@/lib/labels";
import { fmtDateTime, fmtQty } from "@/lib/production";
import { actingUserName } from "@/lib/permissions";
import { downloadCsv, todayStr } from "@/lib/warehouse";
import { loadProductLinkData, recipeLabel, recipeOf } from "@/lib/productLinks";
import { inputClass, subtleButton, panelClass, labelClass } from "@/components/planning/styles";

export default function BatchRecords() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [records, setRecords] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState("");
  const [reprintTarget, setReprintTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState(null);

  const reload = useCallback(async () => {
    const [rows, link] = await Promise.all([loadBatchRecords(), loadProductLinkData()]);
    setRecords(rows);
    setRecipes(link.recipes);
    setLoading(false);
  }, []);

  // The recipe the item was made to, from the shared Recipe Master.
  const recipeFor = (record) => recipeLabel(recipeOf(recipes, record.product_id));

  useEffect(() => { reload(); }, [reload]);

  const rows = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return records.filter((r) => !needle || [
      r.product_name, r.product_code, r.batch_number, r.machine, r.created_by_name, r.order_number,
    ].some((value) => (value || "").toLowerCase().includes(needle)));
  }, [records, term]);

  const exportCsv = () => {
    downloadCsv(`batch-records-${todayStr()}.csv`, [
      { label: "Product", value: (r) => r.product_name },
      { label: "Product code", value: (r) => r.product_code },
      { label: "Recipe", value: (r) => recipeFor(r) },
      { label: "Batch number", value: (r) => r.batch_number },
      { label: "Production date", value: (r) => r.production_date },
      { label: "Expiry date", value: (r) => r.expiry_date },
      { label: "Cartons", value: (r) => r.quantity_cartons },
      { label: "Machine", value: (r) => r.machine },
      { label: "Order", value: (r) => r.order_number },
      { label: "Created by", value: (r) => r.created_by_name },
      { label: "Created", value: (r) => fmtDateTime(r.created_date) },
      { label: "Reprints", value: (r) => (r.reprints || []).length },
    ], rows);
  };

  const reprint = async (copies) => {
    if (!reprintTarget) return;
    setBusy(true);
    try {
      const entry = { user_name: actingUserName(user), user_id: user?.id || "", date: new Date().toISOString(), copies };
      const reprints = [...(reprintTarget.reprints || []), entry];
      await base44.entities.BatchRecord.update(reprintTarget.id, { reprints });
      await logLabelAudit({
        user,
        action: "Reprinted",
        recordId: reprintTarget.id,
        details: `Batch ${reprintTarget.batch_number} reprinted for ${reprintTarget.product_name} · ${copies} label(s)`,
      });
      setRecords((list) => list.map((r) => (r.id === reprintTarget.id ? { ...r, reprints } : r)));
      setJob({
        layout: layoutOfRecord(reprintTarget),
        copies,
        data: {
          productName: reprintTarget.product_name,
          productCode: reprintTarget.product_code,
          batchNumber: reprintTarget.batch_number,
          productionDate: reprintTarget.production_date,
          expiryDate: reprintTarget.expiry_date,
        },
      });
      toast({ title: "Reprint logged", description: `${reprintTarget.batch_number} · ${copies} label(s)` });
      setReprintTarget(null);
    } catch (e) {
      toast({ title: "Could not reprint", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-white text-lg font-semibold">Batch Records</h2>
          <p className="text-[#a0aec0] text-sm mt-1">Every batch created with its labels, and every reprint logged.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCsv} className={subtleButton} disabled={rows.length === 0}>
            <Download className="w-4 h-4 mr-1.5" /> Export CSV
          </Button>
          <Button asChild className="bg-[#00e5ff] hover:bg-[#00c3d7] text-[#0a0e17] font-semibold">
            <Link to="/create-batch"><Printer className="w-4 h-4 mr-1.5" /> Create Batch</Link>
          </Button>
        </div>
      </div>

      <div className={`${panelClass} p-3`}>
        <div className="space-y-1 max-w-md">
          <label className={labelClass}>Search</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#5f6b7f] absolute left-2.5 top-2.5" />
            <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Product, batch number, machine or who created it" className={`${inputClass} pl-8`} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-[#1e2740] border-t-[#00e5ff] rounded-full animate-spin" />
        </div>
      ) : (
        <div className={`${panelClass} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-[#5f6b7f] border-b border-[#1e2740]">
                <th className="text-left font-semibold px-3 py-2">Product</th>
                <th className="text-left font-semibold px-3 py-2">Recipe</th>
                <th className="text-left font-semibold px-3 py-2">Batch</th>
                <th className="text-left font-semibold px-3 py-2">Production</th>
                <th className="text-left font-semibold px-3 py-2">Expiry</th>
                <th className="text-right font-semibold px-3 py-2">Cartons</th>
                <th className="text-left font-semibold px-3 py-2">Machine</th>
                <th className="text-left font-semibold px-3 py-2">Created by</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-[#a0aec0]">
                    {records.length === 0 ? "No batches recorded yet." : "No batch matches this search."}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-[#131926] hover:bg-white/5">
                    <td className="px-3 py-2 text-white">
                      {r.product_name}
                      <span className="block text-[10px] text-[#5f6b7f]">{r.product_code}</span>
                    </td>
                    <td className="px-3 py-2 text-[#a0aec0] max-w-[200px] truncate" title={recipeFor(r)}>{recipeFor(r) || "—"}</td>
                    <td className="px-3 py-2 text-[#00e5ff] font-semibold whitespace-nowrap">{r.batch_number}</td>
                    <td className="px-3 py-2 text-[#a0aec0] whitespace-nowrap">{fmtDay(r.production_date)}</td>
                    <td className="px-3 py-2 text-[#a0aec0] whitespace-nowrap">
                      {fmtDay(r.expiry_date)}
                      {r.expiry_overridden && (
                        <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-[#ff9f43]" title={r.expiry_override_reason || "Expiry overridden"}>
                          <AlertTriangle className="w-3 h-3" /> override
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-[#a0aec0]">{fmtQty(r.quantity_cartons)}</td>
                    <td className="px-3 py-2 text-[#a0aec0] max-w-[180px] truncate">{r.machine || "—"}</td>
                    <td className="px-3 py-2 text-[#a0aec0] whitespace-nowrap">
                      {r.created_by_name || "—"}
                      <span className="block text-[10px] text-[#5f6b7f]">{fmtDateTime(r.created_date)}</span>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Link to={`/traceability?batch=${encodeURIComponent(r.batch_number)}`} className="text-[#5f6b7f] hover:text-[#00e5ff] mr-2" title="Open traceability">
                        <ExternalLink className="w-3.5 h-3.5 inline" />
                      </Link>
                      <Button size="sm" variant="ghost" onClick={() => setReprintTarget(r)} className="text-[#00e5ff] hover:bg-[#00e5ff]/10">
                        <Printer className="w-3.5 h-3.5 mr-1" /> Reprint
                        {(r.reprints || []).length > 0 && <span className="text-[10px] text-[#5f6b7f] ml-1">×{r.reprints.length}</span>}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-[#5f6b7f]">{rows.length} of {records.length} batch record(s)</p>

      <ReprintDialog
        open={!!reprintTarget}
        record={reprintTarget}
        busy={busy}
        onClose={() => setReprintTarget(null)}
        onConfirm={reprint}
      />

      <LabelPrintSheet job={job} />
    </div>
  );
}