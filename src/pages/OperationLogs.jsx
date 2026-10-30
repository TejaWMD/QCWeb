import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Pencil, TrendingUp, Package, Clock } from "lucide-react";
import MetricCard from "@/components/dashboard/MetricCard";
import LineAchievementChart from "@/components/dashboard/LineAchievementChart";
import OTEfficiencyChart from "@/components/dashboard/OTEfficiencyChart";
import OutputByLineChart from "@/components/oplog/OutputByLineChart";
import OperationLogModal from "@/components/oplog/OperationLogModal";
import BatchBadge from "@/components/BatchBadge";
import { calculateOTMetrics } from "@/lib/otCalculations";
import { groupByDate, formatDateHeader } from "@/lib/logGrouping";
import { productionLines, lineCode } from "@/lib/shiftLogConstants";
import { canChangeRecord } from "@/lib/permissions";

export default function OperationLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editLog, setEditLog] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [lineFilter, setLineFilter] = useState("");
  const [batchFilter, setBatchFilter] = useState("");

  const loadLogs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const query = {};
      if (dateFrom || dateTo) {
        query.ot_date = {};
        if (dateFrom) query.ot_date.$gte = dateFrom;
        if (dateTo) query.ot_date.$lte = dateTo;
      }
      if (lineFilter) query.production_line = { $regex: `^${lineCode(lineFilter)}` };
      if (batchFilter) query.record_batch = batchFilter;
      const { items } = await base44.entities.OperationLog.filter(query, { sort: "-ot_date", limit: 100 });
      setLogs(items);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  useEffect(() => {
    loadLogs();
  }, [dateFrom, dateTo, lineFilter, batchFilter]);

  // Live pipeline: a shift log submission or correction refreshes this page
  // without a manual reload.
  useEffect(() => {
    const reload = () => loadLogs(true);
    const unsubscribes = [
      base44.entities.OperationLog.subscribe(reload),
      base44.entities.ShiftLog.subscribe(reload),
    ];
    return () => unsubscribes.forEach((unsubscribe) => { if (typeof unsubscribe === "function") unsubscribe(); });
  }, [dateFrom, dateTo, lineFilter, batchFilter]);

  // Entries are added by the shift log, so this only ever corrects an existing
  // row — the correction is carried back onto its shift log session.
  const handleSave = async (formData) => {
    await base44.functions.invoke("recordOperationLog", { operationLog: formData, operationLogId: editLog.id });
    setModalOpen(false);
    setEditLog(null);
    loadLogs(true);
  };

  const handleClose = () => {
    setModalOpen(false);
    setEditLog(null);
  };

  const handleEdit = (log) => {
    setEditLog(log);
    setModalOpen(true);
  };

  // Removing a row removes the shift log session it came from, across every page.
  const handleDelete = async (id) => {
    await base44.functions.invoke("deleteShiftLog", { operationLogId: id });
    loadLogs(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = currentUser?.role === "admin";
  const dateGroups = groupByDate(logs, "ot_date");

  const metrics = logs.reduce(
    (acc, l) => {
      const m = calculateOTMetrics(l);
      acc.planned += l.planned_ot_qty || 0;
      acc.good += l.actual_good_output || 0;
      acc.rejected += l.rejected_wasted_qty || 0;
      acc.otHours += m.ot_man_hours;
      acc.otSpend += m.expenditure_ot_man_hr;
      return acc;
    },
    { planned: 0, good: 0, rejected: 0, otHours: 0, otSpend: 0 }
  );
  const avgAchieve = metrics.planned > 0 ? (metrics.good / metrics.planned) * 100 : 0;

  const lineData = (() => {
    const map = new Map();
    logs.forEach((l) => {
      const line = l.production_line?.split(" - ")[0] || "—";
      const m = calculateOTMetrics(l);
      if (!map.has(line)) map.set(line, { line, planned: 0, good: 0, rejected: 0, otHours: 0 });
      const d = map.get(line);
      d.planned += l.planned_ot_qty || 0;
      d.good += l.actual_good_output || 0;
      d.rejected += l.rejected_wasted_qty || 0;
      d.otHours += m.ot_man_hours;
    });
    return Array.from(map.values()).map((d) => {
      const achieve = d.planned > 0 ? Math.round((d.good / d.planned) * 100) : 0;
      return { line: d.line, good: d.good, rejected: d.rejected, target: 90, actual: achieve, otHours: Number(d.otHours.toFixed(1)), achieve };
    });
  })();

  const fmtTime = (dt) => dt ? new Date(dt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—";

  // 4+ digits = units (pcs); 1-3 digits = carton
  const outputUnit = (n) => (Number(n) || 0) >= 1000 ? "units" : "carton";
  const OutputTag = ({ n }) => {
    const v = Number(n) || 0;
    const unit = outputUnit(v);
    return (
      <span className="inline-flex items-center gap-1.5">
        <span>{v.toLocaleString()}</span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${unit === "units" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"}`}>
          {unit}
        </span>
      </span>
    );
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-1">Operation Record</h2>
          <p className="text-slate-500 text-sm">Day-to-day operation output &amp; process improvement record — one row per shift log session, captured from the shift log.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={lineFilter || "all"} onValueChange={(v) => setLineFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="All Lines" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Lines</SelectItem>
              {productionLines.map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={batchFilter || "all"} onValueChange={(v) => setBatchFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All Batches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Batches</SelectItem>
              <SelectItem value="current">New Records</SelectItem>
              <SelectItem value="legacy">Legacy Records</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
          <span className="text-slate-400 text-sm">to</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
          {(dateFrom || dateTo || lineFilter || batchFilter) && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); setLineFilter(""); setBatchFilter(""); }} className="text-slate-500">
              Clear
            </Button>
          )}
        </div>
      </div>

      {logs.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard
              label="Avg Achievement"
              value={`${avgAchieve.toFixed(1)}%`}
              subtext={avgAchieve >= 90 ? `↑ +${(avgAchieve - 90).toFixed(1)}% vs target (90%)` : `↓ ${(90 - avgAchieve).toFixed(1)}% vs target (90%)`}
              icon={TrendingUp}
              subtextColor={avgAchieve >= 90 ? "text-green-600" : "text-red-500"} />
            <MetricCard
              label="Good Output"
              value={metrics.good.toLocaleString()}
              subtext={`Target: ${metrics.planned.toLocaleString()} Pcs`}
              icon={Package} />
            <MetricCard
              label="Rejected / Wasted"
              value={`${metrics.rejected.toLocaleString()} Pcs`}
              subtext={`${logs.length} sessions recorded`}
              icon={Trash2}
              valueColor="text-red-500" />
            <MetricCard
              label="Total OT Spend"
              value={`RM ${metrics.otSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              subtext={`OT Man-Hours: ${metrics.otHours.toFixed(1)} hrs`}
              icon={Clock} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <OutputByLineChart data={lineData} />
            <LineAchievementChart data={lineData} />
            <OTEfficiencyChart data={lineData} />
          </div>
        </>
      )}

      {logs.length === 0 ? (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500">No operation records yet. A record is created here whenever a shift log is submitted.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-slate-500 text-left">
                  <th className="px-3 py-3 font-medium sticky top-0 z-20 bg-slate-50">Batch</th>
                  <th className="px-3 py-3 font-medium sticky top-0 z-20 bg-slate-50">Line</th>
                  <th className="px-3 py-3 font-medium sticky left-0 top-0 z-30 bg-slate-50 border-r border-slate-200">Product / SKU</th>
                  <th className="px-3 py-3 font-medium text-right sticky top-0 z-20 bg-slate-50">Staff</th>
                  <th className="px-3 py-3 font-medium sticky top-0 z-20 bg-slate-50">Name</th>
                  <th className="px-3 py-3 font-medium sticky top-0 z-20 bg-slate-50">Start</th>
                  <th className="px-3 py-3 font-medium sticky top-0 z-20 bg-slate-50">End</th>
                  <th className="px-3 py-3 font-medium text-right sticky top-0 z-20 bg-slate-50">OT Hrs</th>
                  <th className="px-3 py-3 font-medium text-right sticky top-0 z-20 bg-slate-50">OT Man-Hrs</th>
                  <th className="px-3 py-3 font-medium text-right sticky top-0 z-20 bg-[#fff7d6]">Actual Unit Per Minute / Carton Per Minute</th>
                  <th className="px-3 py-3 font-medium text-right sticky top-0 z-20 bg-slate-50">OT Spend</th>
                  <th className="px-3 py-3 font-medium text-right sticky top-0 z-20 bg-slate-50">Pcs / Carton</th>
                  <th className="px-3 py-3 font-medium text-right sticky top-0 z-20 bg-slate-50">Planned Cartons</th>
                  <th className="px-3 py-3 font-medium text-right sticky top-0 z-20 bg-slate-50">Planned Qty</th>
                  <th className="px-3 py-3 font-medium text-right sticky top-0 z-20 bg-slate-50">Good Output</th>
                  <th className="px-3 py-3 font-medium text-right sticky top-0 z-20 bg-slate-50">Rejected/Wasted</th>
                  <th className="px-3 py-3 font-medium text-right sticky top-0 z-20 bg-slate-50">Yield %</th>
                  <th className="px-3 py-3 font-medium text-right sticky top-0 z-20 bg-slate-50">Variance</th>
                  <th className="px-3 py-3 font-medium text-right sticky top-0 z-20 bg-slate-50">Achieve %</th>
                  <th className="px-3 py-3 font-medium text-right sticky top-0 z-20 bg-slate-50">Good/Man-Hr</th>
                  <th className="px-3 py-3 font-medium text-right sticky top-0 z-20 bg-slate-50">Downtime (min)</th>
                  <th className="px-3 py-3 font-medium text-right sticky top-0 z-20 bg-slate-50">Net Prod (hrs)</th>
                  <th className="px-3 py-3 sticky top-0 z-20 bg-slate-50"></th>
                </tr>
              </thead>
              {dateGroups.map((group) => (
                <tbody key={group.date} className="divide-y divide-slate-100">
                  <tr className="bg-slate-100 border-y-2 border-slate-200">
                    <td colSpan={23} className="px-0 py-0">
                      <div className="flex items-center gap-3 px-4 py-2.5 border-l-4 border-sky-500">
                        <span className="font-bold text-slate-800 text-sm">{formatDateHeader(group.date)}</span>
                        <span className="text-xs text-slate-400">({group.items.length} {group.items.length === 1 ? "entry" : "entries"})</span>
                      </div>
                    </td>
                  </tr>
                  {group.items.map((log) => {
                  const m = calculateOTMetrics(log);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-3 py-3"><BatchBadge value={log.record_batch} /></td>
                      <td className="px-3 py-3 text-slate-700">{log.production_line}</td>
                      <td className="px-3 py-3 text-slate-700 sticky left-0 z-10 bg-white border-r border-slate-200">{log.product_sku}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{log.staff_count || 0}</td>
                      <td className="px-3 py-3 text-slate-600">{log.staff_name || "—"}</td>
                      <td className="px-3 py-3 text-slate-600">{fmtTime(log.ot_start)}</td>
                      <td className="px-3 py-3 text-slate-600">{fmtTime(log.ot_end)}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{m.ot_duration_hours.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{m.ot_man_hours.toFixed(1)}</td>
                      <td className="px-3 py-3 text-right text-slate-700 bg-[#fff7d6] font-semibold">{m.actual_upm.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-amber-600">RM {m.expenditure_ot_man_hr.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{log.pcs_per_carton ? log.pcs_per_carton.toLocaleString() : "—"}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{log.planned_cartons ? log.planned_cartons.toLocaleString() : "—"}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{log.planned_ot_qty ? log.planned_ot_qty.toLocaleString() : "—"}</td>
                      <td className="px-3 py-3 text-right text-slate-700"><OutputTag n={log.actual_good_output} /></td>
                      <td className="px-3 py-3 text-right text-red-500">{(log.rejected_wasted_qty || 0).toLocaleString()}</td>
                      <td className={`px-3 py-3 text-right font-medium ${m.ot_quality_yield_pct >= 95 ? "text-green-600" : "text-red-500"}`}>{m.ot_quality_yield_pct.toFixed(1)}%</td>
                      <td className={`px-3 py-3 text-right ${m.output_variance >= 0 ? "text-green-600" : "text-red-500"}`}>{m.output_variance.toLocaleString()}</td>
                      <td className={`px-3 py-3 text-right font-medium ${m.achievement_pct >= 90 ? "text-green-600" : "text-red-500"}`}>{m.achievement_pct.toFixed(1)}%</td>
                      <td className="px-3 py-3 text-right text-slate-700">{m.good_output_per_man_hour.toFixed(1)}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{log.downtime_min || 0}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{m.net_productive_ot_hours.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {canChangeRecord(currentUser, log) && (
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(log)} className="text-slate-400 hover:text-sky-600 mr-1">
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        {isAdmin && (
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(log.id)} className="text-slate-400 hover:text-red-500">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                </tbody>
              ))}
            </table>
          </div>
        </div>
      )}

      <OperationLogModal open={modalOpen} onClose={handleClose} onSave={handleSave} editData={editLog} />
    </div>
  );
}