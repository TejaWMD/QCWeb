import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Timer, DollarSign, Users } from "lucide-react";
import { groupByDate, formatDateHeader } from "@/lib/logGrouping";
import { otHoursAfterFive } from "@/lib/otCalculations";
import OTSpendTrendChart from "@/components/otlog/OTSpendTrendChart";
import OTSpendByLineChart from "@/components/overtime/OTSpendByLineChart";
import WorkforceQuadrantChart from "@/components/overtime/WorkforceQuadrantChart";
import BatchBadge from "@/components/BatchBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function OvertimeRecord() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [batchFilter, setBatchFilter] = useState("");

  const loadLogs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const query = batchFilter ? { record_batch: batchFilter } : {};
      // One row per session, read from the Overtime Record table alone.
      const otRes = await base44.entities.OTLog.filter(query, { sort: "-created_date", limit: 200 });
      const mapped = (otRes.items || otRes).map((l) => {
        const start = l.ot_start ? l.ot_start.slice(11, 16) : l.start_time || "";
        const end = l.ot_end ? l.ot_end.slice(11, 16) : l.end_time || "";
        // Overtime is the hours worked after 5:00 PM — the same rule the shift log
        // and the save service use: 08:00-20:00 is 3.00 hours, not 12.00.
        return {
          ...l,
          shift_date: l.ot_date,
          start_time: start,
          end_time: end,
          break_duration: 0,
          ot_duration_hours: Number(otHoursAfterFive(start, end).toFixed(2)),
        };
      });
      setLogs(mapped.filter((l) => l.ot_duration_hours > 0));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { loadLogs(); }, [batchFilter]);

  // Live pipeline: an overtime correction or shift log change lands here at once.
  useEffect(() => {
    const reload = () => loadLogs(true);
    const unsubscribes = [base44.entities.OTLog.subscribe(reload)];
    return () => unsubscribes.forEach((unsubscribe) => { if (typeof unsubscribe === "function") unsubscribe(); });
  }, [batchFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  const totalOTHours = logs.reduce((s, l) => s + (l.ot_duration_hours || 0) * (l.staff_count || 0), 0);
  const totalOTSpend = logs.reduce((s, l) => s + (l.ot_duration_hours || 0) * (l.staff_count || 0) * (l.hourly_ot_rate || 0), 0);
  const totalSessions = logs.length;
  const dateGroups = groupByDate(logs, "shift_date");

  const dailySummary = (() => {
    const map = new Map();
    logs.forEach((l) => {
      if (!l.shift_date) return;
      const day = new Date(l.shift_date + "T00:00:00");
      day.setHours(0, 0, 0, 0);
      const key = day.toISOString();
      const otHrs = l.ot_duration_hours || 0;
      const spend = otHrs * (l.staff_count || 0) * (l.hourly_ot_rate || 0);
      if (!map.has(key)) map.set(key, { day, hours: 0, spend: 0, count: 0, manpower: 0, manHours: 0 });
      const d = map.get(key);
      d.hours += otHrs;
      d.manHours += otHrs * (l.staff_count || 0);
      d.manpower += l.staff_count || 0;
      d.spend += spend;
      d.count += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.day - a.day);
  })();
  const maxDaySpend = Math.max(...dailySummary.map((d) => d.spend), 0);

  const lineSummary = (() => {
    const map = new Map();
    logs.forEach((l) => {
      const line = l.production_line?.split(" - ")[0] || "—";
      const otHrs = l.ot_duration_hours || 0;
      const spend = otHrs * (l.staff_count || 0) * (l.hourly_ot_rate || 0);
      if (!map.has(line)) map.set(line, { line, spend: 0, hours: 0 });
      const d = map.get(line);
      d.spend += spend;
      d.hours += otHrs * (l.staff_count || 0);
    });
    return Array.from(map.values()).sort((a, b) => b.spend - a.spend);
  })();

  const fmtTime = (t) => (t ? new Date(`2000-01-01T${t}`).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—");

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-1">Overtime Record</h2>
          <p className="text-slate-500 text-sm">One row per session, from the Overtime Record — only the hours worked after 5:00 PM count as overtime.</p>
        </div>
        <div className="flex items-center gap-2">
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
          <Link to="/">
            <Button variant="outline" className="border-slate-300">
              <LayoutDashboard className="w-4 h-4 mr-1" /> Dashboard
            </Button>
          </Link>
        </div>
      </div>

      {logs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center">
                <Timer className="w-5 h-5 text-sky-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total OT Man-Hours</p>
                <p className="text-2xl font-bold text-slate-800">{totalOTHours.toFixed(1)} hrs</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total OT Spend</p>
                <p className="text-2xl font-bold text-slate-800">RM {totalOTSpend.toFixed(2)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
                <Users className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">OT Sessions</p>
                <p className="text-2xl font-bold text-slate-800">{totalSessions}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {logs.length > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700">Daily OT Summary</h3>
              </div>
              <div className="overflow-auto max-h-72">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                    <tr className="text-slate-500 text-left">
                      <th className="px-4 py-2 font-medium">Date</th>
                      <th className="px-4 py-2 font-medium text-right">Sess.</th>
                      <th className="px-4 py-2 font-medium text-right">Manpower</th>
                      <th className="px-4 py-2 font-medium text-right">OT Hrs</th>
                      <th className="px-4 py-2 font-medium text-right">Man-Hrs</th>
                      <th className="px-4 py-2 font-medium text-right">Spend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dailySummary.map((d) => {
                      const isMax = d.spend === maxDaySpend && maxDaySpend > 0;
                      return (
                        <tr key={d.day.toISOString()} className={isMax ? "bg-red-50" : "hover:bg-slate-50"}>
                          <td className="px-4 py-2 text-slate-700 font-medium">{format(d.day, "EEE, MMM d")}</td>
                          <td className="px-4 py-2 text-right text-slate-700">{d.count}</td>
                          <td className="px-4 py-2 text-right text-slate-700">{d.manpower}</td>
                          <td className="px-4 py-2 text-right text-amber-700 font-medium">{d.hours.toFixed(1)}</td>
                          <td className="px-4 py-2 text-right text-sky-700 font-medium">{d.manHours.toFixed(1)}</td>
                          <td className={`px-4 py-2 text-right font-medium ${isMax ? "text-red-600" : "text-amber-600"}`}>
                            RM {d.spend.toFixed(0)}{isMax ? "  (highest)" : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-700">OT Spend Trend</h3>
                <span className="text-xs text-slate-400">RM per day</span>
              </div>
              <div className="h-64">
                <OTSpendTrendChart data={dailySummary} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-700">OT Spend by Line</h3>
              <span className="text-xs text-slate-400">Highest spend shown in red</span>
            </div>
            <div className="h-64">
              <OTSpendByLineChart data={lineSummary} />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-700">Workforce Efficiency Quadrant</h3>
              <span className="text-xs text-slate-400">Manpower vs. daily OT hours — split at 35 staff / 60 OT hrs</span>
            </div>
            <div className="h-96">
              <WorkforceQuadrantChart data={dailySummary} />
            </div>
          </div>
        </>
      )}

      {logs.length === 0 ? (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500">No overtime recorded yet. OT is auto-detected when a shift log's end time exceeds 5:00 PM.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-slate-500 text-left">
                  <th className="px-3 py-3 font-medium">Batch</th>
                  <th className="px-3 py-3 font-medium">Line</th>
                  <th className="px-3 py-3 font-medium">Product</th>
                  <th className="px-3 py-3 font-medium text-right">Pcs / Carton</th>
                  <th className="px-3 py-3 font-medium text-right">Planned Cartons</th>
                  <th className="px-3 py-3 font-medium">Staff</th>
                  <th className="px-3 py-3 font-medium">Names</th>
                  <th className="px-3 py-3 font-medium">Start</th>
                  <th className="px-3 py-3 font-medium">End</th>
                  <th className="px-3 py-3 font-medium text-right">Break</th>
                  <th className="px-3 py-3 font-medium text-right">OT Hrs</th>
                  <th className="px-3 py-3 font-medium text-right">OT Man-Hrs</th>
                  <th className="px-3 py-3 font-medium text-right">OT Spend</th>
                </tr>
              </thead>
              {dateGroups.map((group) => (
                <tbody key={group.date} className="divide-y divide-slate-100">
                  <tr className="bg-slate-100 border-y-2 border-slate-200">
                    <td colSpan={13} className="px-0 py-0">
                      <div className="flex items-center gap-3 px-4 py-2.5 border-l-4 border-amber-500">
                        <span className="font-bold text-slate-800 text-sm">{formatDateHeader(group.date)}</span>
                        <span className="text-xs text-slate-400">({group.items.length} {group.items.length === 1 ? "session" : "sessions"})</span>
                      </div>
                    </td>
                  </tr>
                  {group.items.map((l) => {
                    const otHrs = l.ot_duration_hours || 0;
                    const otManHrs = otHrs * (l.staff_count || 0);
                    const otSpend = otManHrs * (l.hourly_ot_rate || 0);
                    return (
                      <tr key={l.id} className="hover:bg-slate-50">
                        <td className="px-3 py-3"><BatchBadge value={l.record_batch} /></td>
                        <td className="px-3 py-3 text-slate-700">{l.production_line?.split(" - ")[0]}</td>
                        <td className="px-3 py-3 text-slate-700 max-w-xs truncate">{l.product_name || "—"}</td>
                        <td className="px-3 py-3 text-right text-slate-700">{l.pcs_per_carton ? l.pcs_per_carton.toLocaleString() : "—"}</td>
                        <td className="px-3 py-3 text-right text-slate-700">{l.planned_cartons ? l.planned_cartons.toLocaleString() : "—"}</td>
                        <td className="px-3 py-3 text-right text-slate-700">{l.staff_count || 0}</td>
                        <td className="px-3 py-3 text-slate-600 max-w-[200px] truncate" title={Array.isArray(l.staff_names) ? l.staff_names.join(", ") : l.staff_name}>{Array.isArray(l.staff_names) && l.staff_names.length ? l.staff_names.join(", ") : l.staff_name || "—"}</td>
                        <td className="px-3 py-3 text-slate-600">{fmtTime(l.start_time)}</td>
                        <td className="px-3 py-3 text-slate-600">{fmtTime(l.end_time)}</td>
                        <td className="px-3 py-3 text-right text-slate-700">{(l.break_duration || 0)} hr</td>
                        <td className="px-3 py-3 text-right text-amber-600 font-medium">{otHrs.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right text-slate-700">{otManHrs.toFixed(1)}</td>
                        <td className="px-3 py-3 text-right text-amber-600 font-medium">RM {otSpend.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}