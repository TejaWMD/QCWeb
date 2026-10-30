import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { productionLines, lineCode } from "@/lib/shiftLogConstants";
import { TrendingUp, Package, Trash2, Clock, Plus, CheckCircle2, AlertCircle } from "lucide-react";
import MetricCard from "@/components/dashboard/MetricCard";
import ScrapBreakdownChart from "@/components/dashboard/ScrapBreakdownChart";
import LineEfficiencyChart from "@/components/dashboard/LineEfficiencyChart";
import OTEfficiencyChart from "@/components/dashboard/OTEfficiencyChart";
import DowntimeByLineChart from "@/components/dashboard/DowntimeByLineChart";
import DowntimeParetoChart from "@/components/dashboard/DowntimeParetoChart";
import { buildEfficiencyData, buildDowntimeData } from "@/lib/dashboardMetrics";
import PackagingAtRisk from "@/components/packaging/PackagingAtRisk";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [lineFilter, setLineFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadLogs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await base44.entities.ShiftLog.list("-created_date", 100);
      setLogs(data);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {loadLogs();}, []);

  // Live pipeline: a submission or correction on any linked record refreshes
  // these metrics without a manual reload.
  useEffect(() => {
    const reload = () => loadLogs(true);
    const unsubscribes = [
      base44.entities.ShiftLog.subscribe(reload),
      base44.entities.OperationLog.subscribe(reload),
      base44.entities.OTLog.subscribe(reload),
      base44.entities.WastageLog.subscribe(reload),
    ];
    return () => unsubscribes.forEach((unsubscribe) => { if (typeof unsubscribe === "function") unsubscribe(); });
  }, []);

  const selectedCode = lineFilter === "all" ? "" : lineCode(lineFilter).toUpperCase();
  const filtered = logs.filter((l) => {
    if (selectedCode && !(l.production_line || "").toUpperCase().startsWith(selectedCode)) return false;
    if (dateFrom && (l.shift_date || "") < dateFrom) return false;
    if (dateTo && (l.shift_date || "") > dateTo) return false;
    return true;
  });

  const metrics = filtered.reduce(
    (acc, l) => {
      acc.planned += l.planned_qty || 0;
      acc.actual += l.actual_output || 0;
      acc.caps += l.cap_waste || 0;
      acc.bottles += l.bottle_waste || 0;
      acc.labels += l.label_waste || 0;
      acc.cartons += l.carton_box_waste || 0;
      acc.otHours += (l.ot_duration_hours || 0) * (l.staff_count || 0);
      acc.otSpend += (l.ot_duration_hours || 0) * (l.staff_count || 0) * (l.hourly_ot_rate || 0);
      return acc;
    },
    { planned: 0, actual: 0, caps: 0, bottles: 0, labels: 0, cartons: 0, otHours: 0, otSpend: 0 }
  );

  const avgAchieve = metrics.planned > 0 ? metrics.actual / metrics.planned * 100 : 0;
  const totalWaste = metrics.caps + metrics.bottles + metrics.labels + metrics.cartons;
  const lossValue = (totalWaste * 0.16).toFixed(2);

  const lines = [...new Set(logs.map((l) => l.production_line))];
  const chartLines = [...new Set(filtered.map((l) => l.production_line))];
  const lineData = chartLines.map((line) => {
    const lineLogs = filtered.filter((l) => l.production_line === line);
    const planned = lineLogs.reduce((s, l) => s + (l.planned_qty || 0), 0);
    const actual = lineLogs.reduce((s, l) => s + (l.actual_output || 0), 0);
    const achieve = planned > 0 ? actual / planned * 100 : 0;
    const otHours = lineLogs.reduce((s, l) => s + (l.ot_duration_hours || 0) * (l.staff_count || 0), 0);
    return { line: line.replace("Line ", "L").split(" - ")[0], target: 90, actual: Math.round(achieve), otHours: Number(otHours.toFixed(1)), achieve: Math.round(achieve) };
  });

  const efficiencyData = buildEfficiencyData(filtered);
  const downtimeData = buildDowntimeData(filtered);

  const recentLogs = [...filtered].sort((a, b) => new Date(b.shift_date || b.created_date) - new Date(a.shift_date || a.created_date)).slice(0, 20);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>);

  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="px-6 py-3 flex items-center justify-end bg-slate-100 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <div className="bg-slate-800 text-white text-sm px-4 py-2 rounded-full flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            {lineFilter === "all" ? "All Production Lines" : lineFilter}
          </div>
          <Button onClick={() => navigate("/shift-log-draft")} className="bg-sky-600 hover:bg-sky-700 text-white">
            <Plus className="w-4 h-4 mr-1" /> New Shift Log
          </Button>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl text-slate-800 font-light [font-family:'Rubik_Mono_One',_system-ui]">Operations &amp; Material Loss Overview</h2>
            <p className="text-slate-500 text-sm mt-1">Real-time packaging efficiency, material scrap, and labor usage.</p>
          </div>
          {lines.length > 0 &&
          <div className="flex items-center gap-2">
              <div className="w-56">
                <Select value={lineFilter} onValueChange={setLineFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Lines Combined</SelectItem>
                    {productionLines.map((l) =>
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                  )}
                  </SelectContent>
                </Select>
              </div>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
              <span className="text-slate-400 text-sm">to</span>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
            </div>
          }
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard
            label="Avg Achievement"
            value={`${avgAchieve.toFixed(1)}%`}
            subtext={avgAchieve >= 90 ? `↑ +${(avgAchieve - 90).toFixed(1)}% vs target (90%)` : `↓ ${(90 - avgAchieve).toFixed(1)}% vs target (90%)`}
            icon={TrendingUp}
            subtextColor={avgAchieve >= 90 ? "text-green-600" : "text-red-500"} />
          
          <MetricCard
            label="Actual Output"
            value={metrics.actual.toLocaleString()}
            subtext={`Target: ${metrics.planned.toLocaleString()} Units`}
            icon={Package} />
          
          <MetricCard
            label="Wasted Components"
            value={`${totalWaste.toLocaleString()} Pcs`}
            subtext={`Est. Loss Value: RM ${lossValue}`}
            icon={Trash2}
            valueColor="text-red-500" />
          
          <MetricCard
            label="Total OT Spend"
            value={`RM ${metrics.otSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            subtext={`OT Man-Hours: ${metrics.otHours.toFixed(1)} hrs`}
            icon={Clock} />
          
        </div>

        <PackagingAtRisk />

        {logs.length === 0 ?
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-12 text-center">
            <p className="text-slate-500">No shift logs yet. Click <span className="font-semibold text-sky-600">+ New Shift Log</span> to add your first entry.</p>
          </div> :

        <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              <ScrapBreakdownChart data={{ caps: metrics.caps, bottles: metrics.bottles, labels: metrics.labels, cartons: metrics.cartons }} />
              <LineEfficiencyChart data={efficiencyData} />
              <OTEfficiencyChart data={lineData} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <DowntimeByLineChart data={downtimeData.lines} />
              <DowntimeParetoChart data={downtimeData.pareto} />
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">Recent Shift Logs</h3>
                <span className="text-xs text-slate-400">{recentLogs.length} of {filtered.length} entries</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr className="text-slate-500 text-left">
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Line</th>
                      <th className="px-4 py-3 font-medium">Product</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">Pcs / Ctn</th>
                      <th className="px-4 py-3 font-medium text-right">Planned Ctn</th>
                      <th className="px-4 py-3 font-medium text-right">Planned (pcs)</th>
                      <th className="px-4 py-3 font-medium text-right">Actual</th>
                      <th className="px-4 py-3 font-medium text-right">Achieve</th>
                      <th className="px-4 py-3 font-medium text-right">Staff</th>
                      <th className="px-4 py-3 font-medium text-right">OT Hrs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentLogs.map((l) => {
                    const achieve = l.planned_qty > 0 ? l.actual_output / l.planned_qty * 100 : 0;
                    const isComplete = l.status === "complete";
                    return (
                      <tr key={l.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-700 font-medium">
                            {l.shift_date ? new Date(l.shift_date + "T00:00:00").toLocaleDateString("en-US", { day: "2-digit", month: "short" }) : "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-700">{l.production_line?.split(" - ")[0]}</td>
                          <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{l.product_name || "—"}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${isComplete ? "text-green-700 bg-green-50" : "text-amber-700 bg-amber-50"}`}>
                              {isComplete ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                              {isComplete ? "Complete" : "Incomplete"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700">{l.pcs_per_carton ? l.pcs_per_carton.toLocaleString() : "—"}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{l.planned_cartons ? l.planned_cartons.toLocaleString() : "—"}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{(l.planned_qty || 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{(l.actual_output || 0).toLocaleString()}</td>
                          <td className={`px-4 py-3 text-right font-medium ${achieve >= 90 ? "text-green-600" : "text-red-500"}`}>{achieve.toFixed(1)}%</td>
                          <td className="px-4 py-3 text-right text-slate-700">{l.staff_count || 0}</td>
                          <td className="px-4 py-3 text-right text-amber-600 font-medium">{(l.ot_duration_hours || 0).toFixed(1)}</td>
                        </tr>);

                  })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        }
      </main>

    </div>);

}