import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { groupByDate, formatDateHeader } from "@/lib/logGrouping";

// Every packaged shift log entry, newest first, with admin delete. Kept live:
// a submission or correction elsewhere updates this list without a reload.
export default function ShiftLogEntriesTable() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { items } = await base44.entities.ShiftLog.filter({}, { sort: "-shift_date", limit: 100 });
      setLogs(items);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { loadLogs(); }, []);

  useEffect(() => {
    const unsubscribe = base44.entities.ShiftLog.subscribe(() => loadLogs(true));
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  const handleDelete = async (id) => {
    await base44.functions.invoke("deleteShiftLog", { shiftLogId: id });
    loadLogs(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-12 text-center">
        <p className="text-slate-500">No shift logs recorded yet.</p>
      </div>
    );
  }

  const dateGroups = groupByDate(logs, "shift_date");

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-slate-500 text-left">
              <th className="px-4 py-3 font-medium">Shift</th>
              <th className="px-4 py-3 font-medium">Line</th>
              <th className="px-4 py-3 font-medium text-right">Planned</th>
              <th className="px-4 py-3 font-medium text-right">Actual</th>
              <th className="px-4 py-3 font-medium text-right">Achieve</th>
              <th className="px-4 py-3 font-medium text-right">Waste</th>
              <th className="px-4 py-3 font-medium text-right">OT Hrs</th>
              <th className="px-4 py-3 font-medium text-right">OT Spend</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          {dateGroups.map((group) => (
            <tbody key={group.date} className="divide-y divide-slate-100">
              <tr className="bg-slate-100 border-y-2 border-slate-200">
                <td colSpan={9} className="px-0 py-0">
                  <div className="flex items-center gap-3 px-4 py-2.5 border-l-4 border-sky-500">
                    <span className="font-bold text-slate-800 text-sm">{formatDateHeader(group.date)}</span>
                    <span className="text-xs text-slate-400">
                      ({group.items.length} {group.items.length === 1 ? "entry" : "entries"})
                    </span>
                  </div>
                </td>
              </tr>
              {group.items.map((log) => {
                const achieve = log.planned_qty > 0 ? (log.actual_output / log.planned_qty) * 100 : 0;
                const waste = (log.cap_waste || 0) + (log.bottle_waste || 0) + (log.label_waste || 0) + (log.carton_box_waste || 0);
                const otHours = (log.ot_duration_hours || 0) * (log.staff_count || 0);
                const otSpend = otHours * (log.hourly_ot_rate || 0);
                return (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">{log.shift_type}</td>
                    <td className="px-4 py-3 text-slate-700">{log.production_line}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{(log.planned_qty || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{(log.actual_output || 0).toLocaleString()}</td>
                    <td className={`px-4 py-3 text-right font-medium ${achieve >= 90 ? "text-green-600" : "text-red-500"}`}>{achieve.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right text-red-500">{waste.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{otHours.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">RM {otSpend.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(log.id)} className="text-slate-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}