import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, Plus, Play, Settings } from "lucide-react";
import GenerateOrderDialog from "@/components/production/GenerateOrderDialog";
import ProductionSettingsDialog from "@/components/production/ProductionSettingsDialog";
import OrderDetailDialog from "@/components/production/OrderDetailDialog";
import useProductionData from "@/hooks/useProductionData";
import {
  ORDER_STATUSES, buildRisks, canEditProductionSettings, canPlanOrders, canRunOrders, fmtDateTime, fmtQty, liveOrders,
  localDateStr, logProductionAudit,
} from "@/lib/production";
import { inputClass, selectClass, primaryButton, subtleButton, panelClass, labelClass } from "@/components/planning/styles";
import { num } from "@/lib/planning";
import { activeRecipeFor } from "@/lib/recipeMaster";

const STATUS_STYLES = {
  Planned: "bg-[#00e5ff]/10 text-[#00e5ff] border-[#00e5ff]/30",
  "In Progress": "bg-[#ff9f43]/15 text-[#ff9f43] border-[#ff9f43]/40",
  Completed: "bg-[#00ff9d]/10 text-[#00ff9d] border-[#00ff9d]/30",
  Cancelled: "bg-[#3a4560]/20 text-[#a0aec0] border-[#3a4560]",
};

export default function ProductionOrders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { orders, products, machines, recipes, packagingItems, receipts, settings, loading, reload } = useProductionData();
  const [dateFilter, setDateFilter] = useState("");
  const [machineFilter, setMachineFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [busyId, setBusyId] = useState("");

  const active = liveOrders(orders);

  const rows = useMemo(() => active
    .filter((o) => !dateFilter || localDateStr(o.planned_start) === dateFilter)
    .filter((o) => machineFilter === "all" || o.machine === machineFilter)
    .filter((o) => statusFilter === "all" || o.status === statusFilter)
    .sort((a, b) => new Date(b.planned_start).getTime() - new Date(a.planned_start).getTime()), [active, dateFilter, machineFilter, statusFilter]);

  const counting = (status) => active.filter((o) => o.status === status).length;

  // Stock risk per order, computed once for the visible rows.
  const riskById = useMemo(() => {
    const map = {};
    rows.forEach((o) => {
      const product = products.find((p) => p.id === o.product_id) || null;
      const recipe = activeRecipeFor(recipes, o.product_id);
      const risk = buildRisks({ order: o, product, recipe, packagingItems, receipts });
      map[o.id] = { materials: risk.materialsShort.length, packaging: risk.packagingShort.length };
    });
    return map;
  }, [rows, products, recipes, packagingItems, receipts]);
  const detail = active.find((o) => o.id === detailId) || null;

  const quickRun = async (order, finish) => {
    setBusyId(order.id);
    try {
      const now = new Date().toISOString();
      await base44.entities.ProductionOrder.update(order.id, finish
        ? { status: "Completed", actual_start: order.actual_start || now, actual_end: now }
        : { status: "In Progress", actual_start: order.actual_start || now });
      await logProductionAudit({
        user,
        action: finish ? "Completed" : "Started",
        recordId: order.id,
        details: `${order.order_number} ${finish ? "finished" : "started"} on ${order.machine}`,
      });
      toast({ title: finish ? "Order finished" : "Order started", description: `${order.order_number} · ${order.product_name}` });
      await reload();
    } catch (e) {
      toast({ title: "Could not update the order", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-white text-lg font-semibold">Production Orders</h2>
          <p className="text-[#a0aec0] text-sm mt-1">Orders built from Product Master, scheduled onto the Machines list.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEditProductionSettings(user) && (
            <Button variant="outline" onClick={() => setSettingsOpen(true)} className={subtleButton}>
              <Settings className="w-4 h-4 mr-1.5" /> Settings
            </Button>
          )}
          {canPlanOrders(user) && (
            <Button onClick={() => setGenerateOpen(true)} className={primaryButton}>
              <Plus className="w-4 h-4 mr-1.5" /> Generate Order
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {["Planned", "In Progress", "Completed"].map((s) => (
          <span key={s} className={`px-2.5 py-1 rounded-full border ${STATUS_STYLES[s]}`}>{counting(s)} {s.toLowerCase()}</span>
        ))}
      </div>

      <div className={`${panelClass} p-3`}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className={labelClass}>Planned date</label>
            <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Machine</label>
            <Select value={machineFilter} onValueChange={setMachineFilter}>
              <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All machines</SelectItem>
                {machines.map((m) => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {ORDER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
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
                <th className="text-left font-semibold px-3 py-2">Order</th>
                <th className="text-left font-semibold px-3 py-2">Product</th>
                <th className="text-right font-semibold px-3 py-2">Cartons</th>
                <th className="text-right font-semibold px-3 py-2">Batches</th>
                <th className="text-left font-semibold px-3 py-2">Machine</th>
                <th className="text-left font-semibold px-3 py-2">Planned</th>
                <th className="text-left font-semibold px-3 py-2">Status</th>
                <th className="text-left font-semibold px-3 py-2">Stock</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-[#a0aec0]">
                    {active.length === 0 ? "No orders yet. Generate the first one." : "No orders match these filters."}
                  </td>
                </tr>
              ) : (
                rows.map((o) => {
                  const materialShort = riskById[o.id]?.materials || 0;
                  const packagingShort = riskById[o.id]?.packaging || 0;
                  return (
                    <tr key={o.id} className="border-b border-[#131926] hover:bg-white/5 cursor-pointer" onClick={() => setDetailId(o.id)}>
                      <td className="px-3 py-2 text-white font-semibold whitespace-nowrap">{o.order_number}</td>
                      <td className="px-3 py-2 max-w-[220px]">
                        <span className="block text-white font-semibold text-xs truncate">{o.product_code || "—"}</span>
                        <span className="block text-[#a0aec0] text-[11px] truncate">{o.product_name}</span>
                      </td>
                      <td className="px-3 py-2 text-right text-[#a0aec0]">
                        {fmtQty(o.quantity_cartons)}
                        {num(o.produced_cartons) > 0 && (
                          <span className="block text-[10px] text-[#00ff9d]">{fmtQty(o.produced_cartons)} produced</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-[#a0aec0]">{o.batches || 1}</td>
                      <td className="px-3 py-2 text-[#a0aec0] max-w-[200px] truncate">{o.machine || "—"}</td>
                      <td className="px-3 py-2 text-[#5f6b7f] whitespace-nowrap text-xs">
                        {fmtDateTime(o.planned_start)}<br />to {fmtDateTime(o.planned_end)}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[o.status] || STATUS_STYLES.Planned}`}>{o.status}</span>
                      </td>
                      <td className="px-3 py-2">
                        {(materialShort > 0 || packagingShort > 0) ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-[#ff4d4d]">
                            <AlertTriangle className="w-3 h-3" />
                            {[materialShort ? `${materialShort} mat` : "", packagingShort ? `${packagingShort} pkg` : ""].filter(Boolean).join(" · ")}
                          </span>
                        ) : <span className="text-[10px] text-[#5f6b7f]">ok</span>}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {canRunOrders(user) && o.status === "Planned" && (
                          <Button size="sm" variant="ghost" disabled={busyId === o.id} onClick={() => quickRun(o, false)} className="text-[#00e5ff] hover:bg-[#00e5ff]/10">
                            <Play className="w-3.5 h-3.5 mr-1" /> Start
                          </Button>
                        )}
                        {canRunOrders(user) && o.status === "In Progress" && (
                          <Button size="sm" variant="ghost" disabled={busyId === o.id} onClick={() => quickRun(o, true)} className="text-[#00ff9d] hover:bg-[#00ff9d]/10">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Finish
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-[#5f6b7f]">{rows.length} of {active.length} order(s)</p>

      <GenerateOrderDialog
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onSaved={reload}
        products={products.filter((p) => p.active !== false && !p.hidden)}
        machines={machines}
        orders={orders}
        settings={settings}
        user={user}
      />

      <ProductionSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        user={user}
        onSaved={reload}
      />

      {detail && (
        <OrderDetailDialog
          order={detail}
          products={products}
          recipes={recipes}
          packagingItems={packagingItems}
          receipts={receipts}
          user={user}
          onClose={() => setDetailId(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}