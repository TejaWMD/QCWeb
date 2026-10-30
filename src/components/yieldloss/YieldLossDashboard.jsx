import React, { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { panelClass, labelClass, subtleButton } from "@/components/planning/styles";
import { productionLines } from "@/lib/shiftLogConstants";
import { downloadCsv, todayStr } from "@/lib/warehouse";
import { num } from "@/lib/planning";
import { SHIFTS, fmtKg, fmtPct, loadBatchYields, loadFillChecks, loadPackagingWastes, loadReworks } from "@/lib/yieldLoss";

const isoDaysAgo = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return todayStr(d);
};
const avg = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
const tooltipStyle = { background: "#0e131d", border: "1px solid #1e2740", borderRadius: 8, color: "#e2e8f0" };
const AXIS = { stroke: "#5f6b7f", fontSize: 11 };

const Tile = ({ label, value, sub, tone = "text-white" }) => (
  <div className={`${panelClass} p-3`}>
    <p className={labelClass}>{label}</p>
    <p className={`text-xl font-bold leading-tight ${tone}`}>{value}</p>
    {sub && <p className="text-[10px] text-[#5f6b7f] mt-0.5">{sub}</p>}
  </div>
);

export default function YieldLossDashboard({ settings }) {
  const [raw, setRaw] = useState(null);
  const [filters, setFilters] = useState({ from: isoDaysAgo(30), to: todayStr(), line: "all", product: "all", shift: "all" });

  useEffect(() => {
    (async () => {
      const [yields, wastes, checks, reworks] = await Promise.all([loadBatchYields(), loadPackagingWastes(), loadFillChecks(), loadReworks()]);
      setRaw({ yields, wastes, checks, reworks });
    })();
  }, []);

  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  const view = useMemo(() => {
    if (!raw) return null;
    const inRange = (dateStr) => (!filters.from || dateStr >= filters.from) && (!filters.to || dateStr <= filters.to);
    const lineOk = (line) => filters.line === "all" || line === filters.line;
    const shiftOk = (shift) => filters.shift === "all" || shift === filters.shift;

    const yields = raw.yields.filter((r) => inRange(r.shift_date) && lineOk(r.production_line) && shiftOk(r.shift_type) && (filters.product === "all" || r.product_id === filters.product));
    const wastes = raw.wastes.filter((r) => inRange(r.waste_date) && lineOk(r.production_line) && shiftOk(r.shift_type));
    const checks = raw.checks.filter((r) => inRange(r.check_date) && lineOk(r.production_line) && shiftOk(r.shift_type) && (filters.product === "all" || r.product_id === filters.product));
    const reworks = raw.reworks.filter((r) => inRange(r.rework_date) && lineOk(r.production_line) && shiftOk(r.shift_type) && (filters.product === "all" || r.product_id === filters.product));

    const yieldByProduct = Object.values(yields.reduce((acc, r) => {
      const key = r.product_name || r.product_code || "Unknown";
      acc[key] = acc[key] || { name: key, actual: [], standard: [] };
      acc[key].actual.push(num(r.yield_pct));
      if (num(r.standard_yield_pct) > 0) acc[key].standard.push(num(r.standard_yield_pct));
      return acc;
    }, {})).map((row) => ({ name: row.name, Yield: Math.round(avg(row.actual) * 10) / 10, Standard: Math.round(avg(row.standard) * 10) / 10 }));

    const byDay = Object.values(yields.reduce((acc, r) => {
      const key = r.shift_date || "";
      acc[key] = acc[key] || { name: key.slice(5), values: [] };
      acc[key].values.push(num(r.yield_pct));
      return acc;
    }, {})).map((row) => ({ name: row.name, Yield: Math.round(avg(row.values) * 10) / 10 })).sort((a, b) => a.name.localeCompare(b.name));

    const wasteByLine = Object.values(wastes.reduce((acc, r) => {
      const key = r.production_line || "—";
      acc[key] = acc[key] || { name: key, values: [] };
      acc[key].values.push(num(r.waste_pct));
      return acc;
    }, {})).map((row) => ({ name: row.name, Waste: Math.round(avg(row.values) * 10) / 10 }));

    const giveaway = Object.values(checks.reduce((acc, r) => {
      const key = r.production_line || "—";
      acc[key] = acc[key] || { name: key, pct: [], cost: 0 };
      acc[key].pct.push(num(r.giveaway_pct));
      acc[key].cost += num(r.cost_per_batch);
      return acc;
    }, {})).map((row) => ({ name: row.name, Giveaway: Math.round(avg(row.pct) * 10) / 10, cost: Math.round(row.cost * 100) / 100 }));

    const giveawayByProduct = Object.values(checks.reduce((acc, r) => {
      const key = r.product_name || r.product_code || "Unknown";
      acc[key] = acc[key] || { name: key, values: [] };
      acc[key].values.push(num(r.giveaway_pct));
      return acc;
    }, {})).map((row) => ({ name: row.name, Giveaway: Math.round(avg(row.values) * 10) / 10 }));

    const reasons = {};
    wastes.forEach((r) => {
      const key = r.reason || "Unspecified";
      reasons[key] = reasons[key] || { name: key, count: 0, qty: 0 };
      reasons[key].count += 1;
      reasons[key].qty += num(r.waste_units);
    });
    reworks.forEach((r) => {
      const key = r.reason || "Unspecified";
      reasons[key] = reasons[key] || { name: key, count: 0, qty: 0 };
      reasons[key].count += 1;
      reasons[key].qty += num(r.quantity_kg);
    });
    const topReasons = Object.values(reasons).sort((a, b) => b.count - a.count).slice(0, 5);

    const totalOutput = yields.reduce((sum, r) => sum + num(r.output_kg), 0);
    const reworkKg = reworks.reduce((sum, r) => sum + num(r.quantity_kg), 0);

    return {
      yields, wastes, checks, reworks, yieldByProduct, byDay, wasteByLine, giveaway, giveawayByProduct, topReasons,
      avgYield: avg(yields.map((r) => num(r.yield_pct))),
      flagged: yields.filter((r) => r.within_tolerance === false).length,
      avgWaste: avg(wastes.map((r) => num(r.waste_pct))),
      wasteFlags: wastes.filter((r) => r.exceeded).length,
      avgGiveaway: avg(checks.map((r) => num(r.giveaway_pct))),
      giveawayCost: checks.reduce((sum, r) => sum + num(r.cost_per_batch), 0),
      underweight: checks.filter((r) => r.compliance_risk).length,
      reworkKg,
      reworkRate: totalOutput > 0 ? (reworkKg / totalOutput) * 100 : 0,
    };
  }, [raw, filters]);

  const exportCsv = () => {
    const rows = [
      ...view.yields.map((r) => ({ type: "Batch yield", date: r.shift_date, line: r.production_line, product: r.product_name, ref: r.batch_number, value: `${r.yield_pct}%`, detail: `input ${r.input_kg} kg · output ${r.output_kg} kg` })),
      ...view.wastes.map((r) => ({ type: "Packaging waste", date: r.waste_date, line: r.production_line, product: "", ref: r.reason, value: `${r.waste_pct}%`, detail: `${r.waste_units} of ${r.used_units} pcs` })),
      ...view.checks.map((r) => ({ type: "Giveaway", date: r.check_date, line: r.production_line, product: r.product_name, ref: r.batch_number, value: `${r.giveaway_pct}%`, detail: `avg ${r.avg_g} g · cost ${r.cost_per_batch}` })),
      ...view.reworks.map((r) => ({ type: "Rework", date: r.rework_date, line: r.production_line, product: r.product_name, ref: r.rework_lot_id, value: `${r.quantity_kg} kg`, detail: `${r.reason} · ${r.disposition}` })),
    ];
    downloadCsv(`yield-loss-${filters.from}-to-${filters.to}.csv`, [
      { label: "Type", key: "type" },
      { label: "Date", key: "date" },
      { label: "Line", key: "line" },
      { label: "Product", key: "product" },
      { label: "Reference", key: "ref" },
      { label: "Value", key: "value" },
      { label: "Detail", key: "detail" },
    ], rows);
  };

  if (!view) return <div className={`${panelClass} p-8 text-center text-sm text-[#5f6b7f]`}>Loading dashboard…</div>;

  const products = Object.fromEntries((raw.yields.concat(raw.checks)).filter((r) => r.product_id).map((r) => [r.product_id, r.product_name || r.product_code]));

  return (
    <div className="space-y-3">
      <div className={`${panelClass} p-3 flex flex-wrap items-end gap-3`}>
        <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">From
          <input type="date" value={filters.from} onChange={(e) => set("from", e.target.value)} className="block mt-1 h-9 rounded-md border border-[#1e2740] bg-[#0a0e17] text-[#e2e8f0] text-xs px-2" />
        </label>
        <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">To
          <input type="date" value={filters.to} onChange={(e) => set("to", e.target.value)} className="block mt-1 h-9 rounded-md border border-[#1e2740] bg-[#0a0e17] text-[#e2e8f0] text-xs px-2" />
        </label>
        <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Line
          <select value={filters.line} onChange={(e) => set("line", e.target.value)} className="block mt-1 h-9 rounded-md border border-[#1e2740] bg-[#0a0e17] text-[#e2e8f0] text-xs px-2">
            <option value="all">All lines</option>
            {productionLines.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Product
          <select value={filters.product} onChange={(e) => set("product", e.target.value)} className="block mt-1 h-9 rounded-md border border-[#1e2740] bg-[#0a0e17] text-[#e2e8f0] text-xs px-2 max-w-[180px]">
            <option value="all">All products</option>
            {Object.entries(products).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Shift
          <select value={filters.shift} onChange={(e) => set("shift", e.target.value)} className="block mt-1 h-9 rounded-md border border-[#1e2740] bg-[#0a0e17] text-[#e2e8f0] text-xs px-2">
            <option value="all">Both shifts</option>
            {SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <Button variant="outline" onClick={exportCsv} className={`${subtleButton} ml-auto`}>
          <Download className="w-4 h-4 mr-1.5" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <Tile label="Average yield" value={fmtPct(view.avgYield)} sub={`${view.yields.length} batches · ${view.flagged} flagged`} tone={view.flagged ? "text-[#ff4d4d]" : "text-[#00ff9d]"} />
        <Tile label="Packaging waste" value={fmtPct(view.avgWaste)} sub={`${view.wasteFlags} above ${settings.packaging_waste_threshold_pct}%`} tone={view.wasteFlags ? "text-[#ff4d4d]" : "text-[#00ff9d]"} />
        <Tile label="Giveaway" value={fmtPct(view.avgGiveaway)} sub={`${view.underweight} underweight check(s)`} tone="text-[#ff9f43]" />
        <Tile label="Giveaway cost" value={view.giveawayCost ? view.giveawayCost.toLocaleString("en-US") : "—"} sub="estimated per batch" />
        <Tile label="Rework" value={fmtKg(view.reworkKg)} sub={`${fmtPct(view.reworkRate)} of output`} tone={view.reworkRate > settings.max_rework_pct ? "text-[#ff4d4d]" : "text-white"} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <div className={`${panelClass} p-3`}>
          <p className={`${labelClass} mb-2`}>Average yield % by product</p>
          {view.yieldByProduct.length === 0 ? <p className="text-xs text-[#5f6b7f]">No batch yields in this range.</p> : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={view.yieldByProduct}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2740" vertical={false} />
                <XAxis dataKey="name" tick={AXIS} interval={0} height={50} angle={-12} textAnchor="end" />
                <YAxis tick={AXIS} unit="%" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Yield" fill="#00e5ff" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Standard" fill="#3b4a63" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className={`${panelClass} p-3`}>
          <p className={`${labelClass} mb-2`}>Daily yield trend</p>
          {view.byDay.length === 0 ? <p className="text-xs text-[#5f6b7f]">No batch yields in this range.</p> : (
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={view.byDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2740" vertical={false} />
                <XAxis dataKey="name" tick={AXIS} />
                <YAxis tick={AXIS} unit="%" domain={["auto", "auto"]} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="Yield" stroke="#00e5ff" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className={`${panelClass} p-3`}>
          <p className={`${labelClass} mb-2`}>Packaging waste % by line</p>
          {view.wasteByLine.length === 0 ? <p className="text-xs text-[#5f6b7f]">No packaging waste in this range.</p> : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={view.wasteByLine}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2740" vertical={false} />
                <XAxis dataKey="name" tick={AXIS} interval={0} height={50} angle={-12} textAnchor="end" />
                <YAxis tick={AXIS} unit="%" />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="Waste" fill="#ff9f43" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className={`${panelClass} p-3`}>
          <p className={`${labelClass} mb-2`}>Giveaway % by line</p>
          {view.giveaway.length === 0 ? <p className="text-xs text-[#5f6b7f]">No fill checks in this range.</p> : (
            <>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={view.giveaway}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2740" vertical={false} />
                  <XAxis dataKey="name" tick={AXIS} interval={0} height={50} angle={-12} textAnchor="end" />
                  <YAxis tick={AXIS} unit="%" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="Giveaway" fill="#ff4d4d" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {view.giveaway.map((row) => (
                  <p key={row.name} className="text-[11px] text-[#a0aec0]">{row.name}: <span className="text-white font-semibold">{row.cost ? row.cost.toLocaleString("en-US") : "—"}</span></p>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <div className={`${panelClass} p-3`}>
          <p className={`${labelClass} mb-2`}>Giveaway % by product</p>
          {view.giveawayByProduct.length === 0 ? <p className="text-xs text-[#5f6b7f]">No fill checks in this range.</p> : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={view.giveawayByProduct}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2740" vertical={false} />
                <XAxis dataKey="name" tick={AXIS} interval={0} height={50} angle={-12} textAnchor="end" />
                <YAxis tick={AXIS} unit="%" />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="Giveaway" fill="#ff9f43" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className={`${panelClass} p-3`}>
          <p className={`${labelClass} mb-2`}>Top 5 loss reasons</p>
          {view.topReasons.length === 0 ? <p className="text-xs text-[#5f6b7f]">No losses recorded in this range.</p> : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={view.topReasons} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2740" horizontal={false} />
                <XAxis type="number" tick={AXIS} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={AXIS} width={140} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Occurrences" fill="#00e5ff" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}