import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import KpiCard from "@/components/factoryops/KpiCard";
import { Input } from "@/components/ui/input";
import { HardHat, Factory, UserCog, ShieldCheck, Briefcase } from "lucide-react";

const isoDaysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const todayISO = () => new Date().toISOString().slice(0, 10);
const sum = (list, field) => list.reduce((s, r) => s + (r[field] || 0), 0);
const pct = (part, total) => (total > 0 ? (part / total) * 100 : 0);
const fmt = (n) => (n || 0).toLocaleString("en-US");

// Role KPI Scorecards: per-role KPIs computed automatically from the module
// data across a selectable date range.
export default function KpiScorecards() {
  const [from, setFrom] = useState(isoDaysAgo(7));
  const [to, setTo] = useState(todayISO());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const q = { shift_date: { $gte: from, $lte: to } };
        const opt = { limit: 200 };
        const [prod, shift, down, defects, holds, tasks, capas] = await Promise.all([
          base44.entities.ProductionLog.filter(q, opt).then((p) => p.items),
          base44.entities.ShiftLog.filter(q, opt).then((p) => p.items),
          // Demo / test records never count towards KPIs or scorecards.
          base44.entities.Downtime.filter(q, opt).then((p) => p.items.filter((r) => !r.is_demo)),
          base44.entities.QualityDefect.filter(q, opt).then((p) => p.items),
          base44.entities.ProductHold.filter(q, opt).then((p) => p.items),
          base44.entities.Task.filter(q, opt).then((p) => p.items),
          base44.entities.CAPA.filter(q, opt).then((p) => p.items),
        ]);
        if (!cancelled) setData({ prod, shift, down, defects, holds, tasks, capas });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [from, to]);

  const k = {};
  if (data) {
    const today = todayISO();
    const output = sum(data.prod, "actual_output");
    const planned = sum(data.prod, "planned_qty");
    k.efficiency = pct(output, planned);
    k.output = output;

    const rejected = sum(data.shift, "rejected_qty");
    const goodOutput = sum(data.shift, "actual_output");
    k.wastage = pct(rejected, goodOutput + rejected);
    k.rejected = rejected;

    k.downtime = sum(data.down, "duration_min");
    k.openDowntime = data.down.filter((r) => r.status === "Open").length;

    k.defects = sum(data.defects, "defect_qty");
    k.activeHolds = data.holds.filter((r) => !["Completed", "Verified"].includes(r.status)).length;

    const done = data.tasks.filter((r) => ["Completed", "Verified"].includes(r.status));
    const onTimeDone = done.filter((r) => !r.due_date || r.due_date >= today).length;
    k.onTimeCompletion = pct(onTimeDone, data.tasks.length);
    k.overdueTasks = data.tasks.filter((r) => r.status === "Overdue" || (!["Completed", "Verified"].includes(r.status) && r.due_date && r.due_date < today)).length;
    k.openTasks = data.tasks.filter((r) => !["Completed", "Verified"].includes(r.status)).length;

    k.capaClosure = pct(data.capas.filter((r) => r.status === "Verified").length, data.capas.length);
    k.openCapas = data.capas.filter((r) => !["Completed", "Verified"].includes(r.status)).length;
  }

  return (
    <div className="min-h-screen bg-[#0a0e17] p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-white text-lg font-semibold">Role KPI Scorecards</h2>
          <p className="text-[#a0aec0] text-sm mt-1">KPIs computed automatically from module data for the selected date range.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="space-y-1">
            <span className="text-[11px] text-[#a0aec0]">From</span>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-[#0e131d] border-[#1e2740] text-white h-9 w-[150px]" />
          </div>
          <div className="space-y-1">
            <span className="text-[11px] text-[#a0aec0]">To</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-[#0e131d] border-[#1e2740] text-white h-9 w-[150px]" />
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 border-4 border-[#1e2740] border-t-[#00e5ff] rounded-full animate-spin" />
        </div>
      )}

      {!loading && data && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <KpiCard
            icon={HardHat}
            title="Operator"
            value={`${k.efficiency.toFixed(1)}% Efficiency`}
            stats={[
              { text: `${k.wastage.toFixed(2)}% Wastage`, tone: k.wastage > 5 ? "red" : "green" },
              { text: `${fmt(k.output)} Good Units`, tone: "white" },
              { text: `${fmt(k.rejected)} Rejected Units`, tone: "orange" },
            ]}
          />
          <KpiCard
            icon={Factory}
            title="Line Leader"
            value={`${fmt(k.downtime)} min Downtime`}
            stats={[
              { text: `${k.efficiency.toFixed(1)}% Line Efficiency`, tone: k.efficiency >= 90 ? "green" : "orange" },
              { text: `${k.openDowntime} Open Stoppages`, tone: k.openDowntime > 0 ? "red" : "green" },
            ]}
          />
          <KpiCard
            icon={UserCog}
            title="Supervisor"
            value={`${k.onTimeCompletion.toFixed(1)}% On-time Completion`}
            stats={[
              { text: `${k.overdueTasks} Overdue Tasks`, tone: k.overdueTasks > 0 ? "red" : "green" },
              { text: `${k.openTasks} Open Tasks`, tone: "white" },
            ]}
          />
          <KpiCard
            icon={ShieldCheck}
            title="QA Officer"
            value={`${fmt(k.defects)} Defect Units`}
            stats={[
              { text: `${k.activeHolds} Active Holds`, tone: k.activeHolds > 0 ? "red" : "green" },
              { text: `${k.capaClosure.toFixed(1)}% CAPA Closure Rate`, tone: "cyan" },
            ]}
          />
          <KpiCard
            icon={Briefcase}
            title="Production Manager"
            value={`${k.efficiency.toFixed(1)}% Efficiency`}
            stats={[
              { text: `${fmt(k.downtime)} min Downtime`, tone: k.downtime > 0 ? "orange" : "green" },
              { text: `${k.capaClosure.toFixed(1)}% CAPA Closure`, tone: "cyan" },
              { text: `${k.onTimeCompletion.toFixed(1)}% On-time Tasks`, tone: "white" },
            ]}
          />
        </div>
      )}
    </div>
  );
}