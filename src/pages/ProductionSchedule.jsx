import React, { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Plus, Settings } from "lucide-react";
import ScheduleGrid from "@/components/production/ScheduleGrid";
import GenerateOrderDialog from "@/components/production/GenerateOrderDialog";
import ProductionSettingsDialog from "@/components/production/ProductionSettingsDialog";
import PlanChangeDialog from "@/components/production/PlanChangeDialog";
import OrderDetailDialog from "@/components/production/OrderDetailDialog";
import useProductionData from "@/hooks/useProductionData";
import { todayStr } from "@/lib/warehouse";
import { canEditProductionSettings, canPlanOrders, liveOrders, ordersOnDate } from "@/lib/production";
import { inputClass, selectClass, primaryButton, subtleButton, labelClass } from "@/components/planning/styles";

// Day view: one column per machine, 00:00 to 24:00 down the side.
export default function ProductionSchedule() {
  const { user } = useAuth();
  const { orders, products, machines, recipes, packagingItems, receipts, settings, loading, reload } = useProductionData();
  const [date, setDate] = useState(todayStr());
  const [location, setLocation] = useState("all");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [move, setMove] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const locations = [...new Set(machines.map((m) => m.location || "Plant 1"))];
  const visibleMachines = machines.filter((m) => location === "all" || (m.location || "Plant 1") === location);
  const dayOrders = ordersOnDate(liveOrders(orders), date);
  const detail = liveOrders(orders).find((o) => o.id === detailId) || null;

  return (
    <div className="min-h-screen bg-[#0a0e17] p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-white text-lg font-semibold">Production Schedule</h2>
          <p className="text-[#a0aec0] text-sm mt-1">Drag an order to another time or machine. Every move asks for a reason.</p>
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

      <div className="rounded-xl border border-[#1e2740] bg-[#0e131d] p-3 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className={labelClass}>Date</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value || todayStr())} className={inputClass} />
        </div>
        <Button variant="outline" onClick={() => setDate(todayStr())} className={subtleButton}>
          <CalendarDays className="w-4 h-4 mr-1.5" /> Today
        </Button>
        <div className="space-y-1">
          <label className={labelClass}>Location</label>
          <Select value={location} onValueChange={setLocation}>
            <SelectTrigger className={`${selectClass} w-44`}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locations.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-[11px] text-[#a0aec0]">
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#00e5ff]/60" /> Planned</span>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#ff9f43]/70" /> In progress</span>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#00ff9d]/60" /> Completed</span>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-1 rounded-sm bg-[#00ff9d]" /> Actual run</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-[#1e2740] border-t-[#00e5ff] rounded-full animate-spin" />
        </div>
      ) : (
        <ScheduleGrid
          machines={visibleMachines}
          orders={dayOrders}
          dateStr={date}
          onOpen={(order) => setDetailId(order.id)}
          onMoveRequest={(order, target) => setMove({ order, target })}
        />
      )}

      <p className="text-xs text-[#5f6b7f]">{dayOrders.length} order(s) scheduled on {date}</p>

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

      <PlanChangeDialog
        open={!!move}
        order={move?.order || null}
        target={move?.target || null}
        machines={machines}
        orders={liveOrders(orders)}
        user={user}
        onClose={() => setMove(null)}
        onSaved={() => { setMove(null); reload(); }}
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