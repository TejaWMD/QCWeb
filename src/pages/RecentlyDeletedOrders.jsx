import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { RotateCcw, ShieldAlert } from "lucide-react";
import useProductionData from "@/hooks/useProductionData";
import { isAdminUser } from "@/lib/permissions";
import { canRestoreOrders, fmtDateTime, fmtQty, logProductionAudit } from "@/lib/production";
import { subtleButton, panelClass } from "@/components/planning/styles";

// Deleted orders are kept here so an Admin can restore one.
export default function RecentlyDeletedOrders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { orders, loading, reload } = useProductionData();
  const [busyId, setBusyId] = useState("");

  const deleted = orders
    .filter((o) => o.deleted)
    .sort((a, b) => new Date(b.deleted_date || 0).getTime() - new Date(a.deleted_date || 0).getTime());

  const restore = async (order) => {
    setBusyId(order.id);
    try {
      await base44.entities.ProductionOrder.update(order.id, { deleted: false, deleted_by: "", deleted_date: "" });
      await logProductionAudit({ user, action: "Restored", recordId: order.id, details: `${order.order_number} restored from Recently Deleted` });
      toast({ title: "Order restored", description: `${order.order_number} · ${order.product_name}` });
      await reload();
    } catch (e) {
      toast({ title: "Could not restore the order", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setBusyId("");
    }
  };

  if (!isAdminUser(user)) {
    return (
      <div className="min-h-screen bg-[#0a0e17] p-4 md:p-6">
        <div className="rounded-xl border border-[#1e2740] bg-[#101828] px-4 py-3 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#ff9f43]" />
          <p className="text-sm text-[#a0aec0]">Only an Admin can restore deleted orders.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e17] p-4 md:p-6 space-y-4">
      <div>
        <h2 className="text-white text-lg font-semibold">Recently Deleted</h2>
        <p className="text-[#a0aec0] text-sm mt-1">Deleted production orders stay here until they are restored.</p>
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
                <th className="text-left font-semibold px-3 py-2">Machine</th>
                <th className="text-left font-semibold px-3 py-2">Planned</th>
                <th className="text-left font-semibold px-3 py-2">Deleted</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {deleted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-[#a0aec0]">Nothing here. No orders have been deleted.</td>
                </tr>
              ) : (
                deleted.map((o) => (
                  <tr key={o.id} className="border-b border-[#131926] hover:bg-white/5">
                    <td className="px-3 py-2 text-white font-semibold whitespace-nowrap">{o.order_number}</td>
                    <td className="px-3 py-2 text-[#a0aec0] max-w-[260px] truncate">{o.product_name}</td>
                    <td className="px-3 py-2 text-right text-[#a0aec0]">{fmtQty(o.quantity_cartons)}</td>
                    <td className="px-3 py-2 text-[#a0aec0] max-w-[200px] truncate">{o.machine || "—"}</td>
                    <td className="px-3 py-2 text-[#5f6b7f] text-xs whitespace-nowrap">{fmtDateTime(o.planned_start)}</td>
                    <td className="px-3 py-2 text-[#5f6b7f] text-xs whitespace-nowrap">
                      {o.deleted_by || "—"}<br />{o.deleted_date ? fmtDateTime(o.deleted_date) : ""}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {canRestoreOrders(user) && (
                        <Button size="sm" variant="outline" onClick={() => restore(o)} disabled={busyId === o.id} className={subtleButton}>
                          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restore
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-[#5f6b7f]">{deleted.length} deleted order(s)</p>
    </div>
  );
}