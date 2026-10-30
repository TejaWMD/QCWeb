import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, Play, CheckCircle2, Trash2, Ban } from "lucide-react";
import { actingUserName } from "@/lib/permissions";
import {
  buildRisks, canDeleteOrders, canPlanOrders, canRunOrders, fmtDateTime, fmtDuration, fmtQty, fmtRange, fmtTime,
  logProductionAudit,
} from "@/lib/production";
import { activeRecipeFor } from "@/lib/recipeMaster";
import { primaryButton, subtleButton, labelClass } from "@/components/planning/styles";

const STATUS_STYLES = {
  Planned: "bg-[#00e5ff]/10 text-[#00e5ff] border-[#00e5ff]/30",
  "In Progress": "bg-[#ff9f43]/15 text-[#ff9f43] border-[#ff9f43]/40",
  Completed: "bg-[#00ff9d]/10 text-[#00ff9d] border-[#00ff9d]/30",
  Cancelled: "bg-[#3a4560]/20 text-[#a0aec0] border-[#3a4560]",
};

const RiskList = ({ title, rows, emptyText }) => (
  <div>
    <p className={labelClass}>{title}</p>
    {rows.length === 0 ? (
      <p className="text-xs text-[#5f6b7f] mt-1">{emptyText}</p>
    ) : (
      <ul className="mt-1 space-y-1">
        {rows.map((r) => (
          <li key={`${r.code}-${r.needed}`} className="flex items-start justify-between gap-2 text-xs">
            <span className="text-[#a0aec0] truncate">{r.name}</span>
            <span className={`whitespace-nowrap ${r.short ? "text-[#ff4d4d]" : "text-[#5f6b7f]"}`}>
              need {fmtQty(r.needed)} / have {r.available == null ? "none" : fmtQty(r.available)} {r.unit}
            </span>
          </li>
        ))}
      </ul>
    )}
  </div>
);

// Full order view: details, batch numbers, planned vs actual, stock risk and the
// Start / Finish / Cancel / Delete actions.
export default function OrderDetailDialog({ order, products = [], recipes = [], packagingItems = [], receipts = [], user, onClose, onChanged }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const product = products.find((p) => p.id === order?.product_id) || null;
  const recipe = activeRecipeFor(recipes, product || order?.product_id);
  const risks = buildRisks({ order, product, recipe, packagingItems, receipts });
  const plannedMins = order?.planned_end
    ? Math.round((new Date(order.planned_end).getTime() - new Date(order.planned_start).getTime()) / 60000)
    : 0;
  const variance = order?.actual_end && order?.planned_end
    ? Math.round((new Date(order.actual_end).getTime() - new Date(order.planned_end).getTime()) / 60000)
    : null;

  const run = async (patch, action, details, closeAfter) => {
    setBusy(true);
    try {
      await base44.entities.ProductionOrder.update(order.id, patch);
      await logProductionAudit({ user, action, recordId: order.id, details });
      toast({ title: details });
      onChanged?.();
      if (closeAfter) onClose();
    } catch (e) {
      toast({ title: "Could not update the order", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const start = () => run(
    { status: "In Progress", actual_start: order.actual_start || new Date().toISOString() },
    "Started",
    `${order.order_number} started on ${order.machine}`
  );

  const finish = () => {
    const now = new Date().toISOString();
    return run(
      { status: "Completed", actual_start: order.actual_start || now, actual_end: now },
      "Completed",
      `${order.order_number} finished on ${order.machine}`
    );
  };

  const cancel = () => run({ status: "Cancelled" }, "Cancelled", `${order.order_number} cancelled`);

  const remove = () => run(
    { deleted: true, deleted_by: actingUserName(user), deleted_date: new Date().toISOString() },
    "Deleted",
    `${order.order_number} moved to Recently Deleted`,
    true
  );

  if (!order) return null;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#0b1018] border-[#1e2740] text-white max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="text-white">{order.order_number}</DialogTitle>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[order.status] || STATUS_STYLES.Planned}`}>{order.status}</span>
            {order.priority && order.priority !== "Normal" && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[#1e2740] text-[#a0aec0]">{order.priority}</span>
            )}
          </div>
          <p className="text-sm text-[#a0aec0]">{order.product_code} · {order.product_name}</p>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div><p className={labelClass}>Cartons</p><p className="text-white">{fmtQty(order.quantity_cartons)}</p></div>
          <div><p className={labelClass}>Batches</p><p className="text-white">{order.batches || 1}</p></div>
          <div><p className={labelClass}>Machine</p><p className="text-white text-xs leading-5">{order.machine || "—"}</p></div>
          <div><p className={labelClass}>Customer</p><p className="text-[#a0aec0] text-xs leading-5">{order.customer || "—"}</p></div>
          <div><p className={labelClass}>Planned</p><p className="text-white text-xs leading-5">{fmtDateTime(order.planned_start)}</p><p className="text-[11px] text-[#5f6b7f]">to {fmtDateTime(order.planned_end)}</p></div>
          <div><p className={labelClass}>Actual</p><p className="text-white text-xs leading-5">{order.actual_start ? fmtDateTime(order.actual_start) : "not started"}</p><p className="text-[11px] text-[#5f6b7f]">{order.actual_end ? `to ${fmtTime(order.actual_end)}` : ""}</p></div>
          <div><p className={labelClass}>Run time</p><p className="text-white text-xs leading-5">{plannedMins ? fmtDuration(plannedMins) : "—"}</p></div>
          <div><p className={labelClass}>Due</p><p className="text-white text-xs leading-5">{order.due_date || "—"}</p></div>
        </div>

        {variance != null && (
          <p className={`text-xs ${variance > 0 ? "text-[#ff9f43]" : "text-[#00ff9d]"}`}>
            Finished {fmtDuration(Math.abs(variance))} {variance > 0 ? "later" : "earlier"} than planned.
          </p>
        )}

        {(order.batch_codes || []).length > 0 && (
          <div>
            <p className={labelClass}>Batch numbers</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {order.batch_codes.map((c) => (
                <span key={c} className="text-xs px-1.5 py-0.5 rounded bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/30">{c}</span>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-lg border border-[#1e2740] bg-[#0e131d] p-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <RiskList
            title="Materials at risk"
            rows={risks.materials}
            emptyText={risks.hasRecipe ? "No ingredients on the active recipe." : "No active recipe for this product."}
          />
          <RiskList
            title="Packaging at risk"
            rows={risks.packaging}
            emptyText="No packaging per carton set on the product."
          />
        </div>

        {(risks.materialsShort.length > 0 || risks.packagingShort.length > 0) && (
          <div className="rounded-lg border border-[#ff4d4d]/40 bg-[#ff4d4d]/10 p-3 flex gap-2">
            <AlertTriangle className="w-4 h-4 text-[#ff4d4d] shrink-0 mt-0.5" />
            <p className="text-xs text-[#ff8a8a]">
              Short on {[...risks.materialsShort, ...risks.packagingShort].map((r) => r.name).join(", ")}. Materials are compared with goods received in the warehouse.
            </p>
          </div>
        )}

        {(order.plan_changes || []).length > 0 && (
          <div>
            <p className={labelClass}>Plan changes</p>
            <ul className="mt-1 space-y-1">
              {order.plan_changes.slice().reverse().map((c, i) => (
                <li key={`${c.changed_at}-${i}`} className="text-xs text-[#5f6b7f]">
                  <span className="text-[#a0aec0]">{c.changed_by}</span> moved it to {c.to_machine} on {fmtDateTime(c.to_start)} — {c.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {order.notes && <p className="text-xs text-[#a0aec0]">{order.notes}</p>}

        <DialogFooter className="flex-wrap gap-2">
          {confirmDelete ? (
            <>
              <span className="text-xs text-[#ff8a8a] mr-auto">Move this order to Recently Deleted?</span>
              <Button variant="outline" onClick={() => setConfirmDelete(false)} className={subtleButton} disabled={busy}>Keep</Button>
              <Button onClick={remove} disabled={busy} className="bg-[#ff4d4d] hover:bg-[#d93b3b] text-white">
                {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1.5" />} Delete
              </Button>
            </>
          ) : (
            <>
              {canDeleteOrders(user) && order.status !== "Completed" && (
                <Button variant="ghost" onClick={() => setConfirmDelete(true)} className="text-[#ff8a8a] hover:bg-[#ff4d4d]/10 mr-auto">
                  <Trash2 className="w-4 h-4 mr-1.5" /> Delete
                </Button>
              )}
              {canPlanOrders(user) && ["Planned", "In Progress"].includes(order.status) && (
                <Button variant="outline" onClick={cancel} disabled={busy} className={subtleButton}>
                  <Ban className="w-4 h-4 mr-1.5" /> Cancel order
                </Button>
              )}
              {canRunOrders(user) && order.status === "Planned" && (
                <Button onClick={start} disabled={busy} className={primaryButton}>
                  <Play className="w-4 h-4 mr-1.5" /> Start
                </Button>
              )}
              {canRunOrders(user) && order.status === "In Progress" && (
                <Button onClick={finish} disabled={busy} className={primaryButton}>
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> Finish
                </Button>
              )}
              {order.status === "Completed" && <span className="text-xs text-[#00ff9d] mr-auto">Completed {order.actual_end ? fmtTime(order.actual_end) : ""}</span>}
              <Button variant="outline" onClick={onClose} className={subtleButton}>Close</Button>
            </>
          )}
        </DialogFooter>
        <p className="text-[11px] text-[#5f6b7f]">{fmtRange(order.planned_start, order.planned_end)} planned</p>
      </DialogContent>
    </Dialog>
  );
}