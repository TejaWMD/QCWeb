import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowRight, CalendarDays } from "lucide-react";
import { loadMachines } from "@/lib/planning";
import { loadOrders } from "@/lib/production";
import { todaysSchedule } from "@/lib/batchTrace";

const TILES = [
  { key: "planned", label: "Planned", tone: "text-[#00e5ff] border-[#00e5ff]/30 bg-[#00e5ff]/5" },
  { key: "inProgress", label: "In progress", tone: "text-[#ff9f43] border-[#ff9f43]/30 bg-[#ff9f43]/5" },
  { key: "completed", label: "Completed", tone: "text-[#00ff9d] border-[#00ff9d]/30 bg-[#00ff9d]/5" },
  { key: "delayed", label: "Delayed", tone: "text-[#ff4d4d] border-[#ff4d4d]/40 bg-[#ff4d4d]/5" },
];

// Today's production schedule at a glance: order counts by state and the machines
// with nothing planned.
export default function TodayScheduleSummary() {
  const [orders, setOrders] = useState([]);
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [orderRows, machineRows] = await Promise.all([loadOrders(), loadMachines()]);
      if (!active) return;
      setOrders(orderRows);
      setMachines(machineRows);
      setLoading(false);
    };
    load();
    const unsubscribe = base44.entities.ProductionOrder.subscribe(() => load());
    return () => {
      active = false;
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  const summary = useMemo(() => todaysSchedule({ orders, machines }), [orders, machines]);

  return (
    <div className="bg-[#131926] rounded-xl border border-[#1e2740] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-[#00e5ff]" />
          <h3 className="text-white text-sm font-semibold">Today's Schedule</h3>
          <span className="text-[10px] text-[#5f6b7f]">
            {loading ? "loading…" : `${summary.total} order${summary.total === 1 ? "" : "s"} on the plan`}
          </span>
        </div>
        <Link to="/production-schedule" className="text-xs text-[#00e5ff] hover:underline inline-flex items-center gap-1">
          Open schedule <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {TILES.map((tile) => (
          <div key={tile.key} className={`rounded-lg border px-3 py-2 ${tile.tone}`}>
            <p className="text-[10px] uppercase tracking-widest opacity-80">{tile.label}</p>
            <p className="text-xl font-bold leading-tight">{summary[tile.key]}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold mr-1">
          Idle machines ({summary.idle.length})
        </span>
        {loading ? (
          <span className="text-xs text-[#5f6b7f]">—</span>
        ) : summary.idle.length === 0 ? (
          <span className="text-xs text-[#00ff9d]">Every machine has work planned today</span>
        ) : (
          summary.idle.map((name) => (
            <span key={name} className="text-[11px] px-2 py-0.5 rounded-full border border-[#1e2740] bg-[#0e131d] text-[#a0aec0]">
              {name}
            </span>
          ))
        )}
      </div>
    </div>
  );
}