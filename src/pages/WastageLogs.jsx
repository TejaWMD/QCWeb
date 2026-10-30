import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { groupByDate, formatDateHeader } from "@/lib/logGrouping";
import { wasteComponents } from "@/lib/shiftLogConstants";
import WastageBreakdownChart from "@/components/wastage/WastageBreakdownChart";
import WastageTrendChart from "@/components/wastage/WastageTrendChart";

const wasteColumns = wasteComponents.map((c) => ({ key: `${c.key}_waste`, label: c.label }));

// A row's wastage is its component breakdown plus, for entries branched off an
// Operation Record, the rejected / wasted quantity recorded there.
const rowWaste = (log) =>
  wasteColumns.reduce((s, c) => s + (log[c.key] || 0), 0) + (Number(log.total_waste) || 0);

export default function WastageLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [shiftRes, wastageRes] = await Promise.all([
        base44.entities.ShiftLog.filter({}, { sort: "-shift_date", limit: 200 }),
        base44.entities.WastageLog.filter({}, { sort: "-date", limit: 200 }),
      ]);
      const fromShift = (shiftRes.items || shiftRes).filter((l) => wasteColumns.some((c) => (l[c.key] || 0) > 0));
      // Entries branched off an Operation Record carry the rejected / wasted quantity
      // as a single figure instead of a component breakdown.
      const fromOperations = (wastageRes.items || wastageRes)
        .filter((w) => (Number(w.total_waste) || 0) > 0)
        .map((w) => ({ ...w, shift_date: w.date || (w.created_date || "").slice(0, 10) }));
      setLogs([...fromOperations, ...fromShift]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { loadLogs(); }, []);

  // Live pipeline: wastage recorded or corrected elsewhere lands here at once.
  useEffect(() => {
    const reload = () => loadLogs(true);
    const unsubscribes = [
      base44.entities.WastageLog.subscribe(reload),
      base44.entities.ShiftLog.subscribe(reload),
    ];
    return () => unsubscribes.forEach((unsubscribe) => { if (typeof unsubscribe === "function") unsubscribe(); });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  const totalWaste = logs.reduce((sum, log) => sum + rowWaste(log), 0);
  const operationWaste = logs.reduce((s, l) => s + (Number(l.total_waste) || 0), 0);
  const componentTotals = [
    ...wasteColumns.map((c) => ({
      name: c.label,
      value: logs.reduce((s, log) => s + (log[c.key] || 0), 0),
    })),
    ...(operationWaste > 0 ? [{ name: "Rejected / Wasted (operation)", value: operationWaste }] : []),
  ];
  const topWaste = [...componentTotals].filter((c) => c.value > 0).sort((a, b) => b.value - a.value)[0];

  const dayMap = new Map();
  logs.forEach((l) => {
    if (!l.shift_date) return;
    const day = new Date(l.shift_date + "T00:00:00");
    day.setHours(0, 0, 0, 0);
    const key = day.toISOString();
    const t = rowWaste(l);
    if (!dayMap.has(key)) dayMap.set(key, { day, total: 0 });
    dayMap.get(key).total += t;
  });
  const dailyTrend = Array.from(dayMap.values()).sort((a, b) => b.day - a.day);

  const dateGroups = groupByDate(logs, "shift_date");

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-1">Wastage Record</h2>
        <p className="text-slate-500 text-sm">Component wastage from shift log entries, plus rejected / wasted quantities branched from operation records.</p>
      </div>

      {logs.length === 0 ? (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500">No wastage recorded yet. It appears when a shift log or an operation record reports wastage.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
              <p className="text-xs text-slate-500">Total Wastage</p>
              <p className="text-xl font-bold text-red-500">{totalWaste.toLocaleString()} Pcs</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
              <p className="text-xs text-slate-500">Top Waste Source</p>
              <p className="text-xl font-bold text-amber-600">{topWaste ? `${topWaste.name} (${topWaste.value.toLocaleString()})` : "—"}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
              <p className="text-xs text-slate-500">Entries with Wastage</p>
              <p className="text-xl font-bold text-slate-800">{logs.length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Wastage by Component</h3>
              <div className="h-64"><WastageBreakdownChart data={componentTotals} /></div>
            </div>
            <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-700">Daily Wastage Trend</h3>
                <span className="text-xs text-slate-400">Highest day in red</span>
              </div>
              <div className="h-64"><WastageTrendChart data={dailyTrend} /></div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-slate-500 text-left">
                    <th className="px-3 py-3 font-medium">Line</th>
                    <th className="px-3 py-3 font-medium">Product</th>
                    <th className="px-3 py-3 font-medium">Batch</th>
                    <th className="px-3 py-3 font-medium">Type</th>
                    {wasteColumns.map((c) => (
                      <th key={c.key} className="px-3 py-3 font-medium text-right">{c.label}</th>
                    ))}
                    <th className="px-3 py-3 font-medium text-right">Total</th>
                  </tr>
                </thead>
                {dateGroups.map((group) => (
                  <tbody key={group.date} className="divide-y divide-slate-100">
                    <tr className="bg-slate-100 border-y-2 border-slate-200">
                      <td colSpan={wasteColumns.length + 5} className="px-0 py-0">
                        <div className="flex items-center gap-3 px-4 py-2.5 border-l-4 border-sky-500">
                          <span className="font-bold text-slate-800 text-sm">{formatDateHeader(group.date)}</span>
                          <span className="text-xs text-slate-400">({group.items.length} {group.items.length === 1 ? "entry" : "entries"})</span>
                        </div>
                      </td>
                    </tr>
                    {group.items.map((log) => {
                      const rowTotal = rowWaste(log);
                      return (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="px-3 py-3 text-slate-600">{log.production_line?.split(" - ")[0] || "—"}</td>
                          <td className="px-3 py-3 text-slate-700 max-w-xs truncate">{log.product_name || "—"}</td>
                          <td className="px-3 py-3 text-slate-600">{log.batch_number || "—"}</td>
                          <td className="px-3 py-3 text-slate-600">{log.product_type || "—"}</td>
                          {wasteColumns.map((c) => (
                            <td key={c.key} className="px-3 py-3 text-right text-slate-700">{log[c.key] ? Number(log[c.key]).toLocaleString() : "—"}</td>
                          ))}
                          <td className="px-3 py-3 text-right font-semibold text-red-500">{rowTotal > 0 ? rowTotal.toLocaleString() : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                ))}
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}