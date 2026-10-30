import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { groupByDate, formatDateHeader } from "@/lib/logGrouping";
import { ScrollText } from "lucide-react";

const ACTION_STYLES = {
  "New Entry Created": "bg-emerald-100 text-emerald-700",
  "Data Modified": "bg-sky-100 text-sky-700",
  "Data Deleted": "bg-rose-100 text-rose-700",
};

const MAX_CHANGE_LINES = 4;

const logDay = (log) => (log.event_stamp || "").slice(0, 10) || (log.event_time || "").slice(0, 10);
const logTime = (log) => (log.event_stamp || "").slice(11, 19);

export default function ActivityLogTable() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const page = await base44.entities.ActivityLog.filter({}, { sort: "-event_time", limit: 200 });
      setLogs(page.items || []);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { loadLogs(); }, []);

  // Live: a submission, correction or deletion anywhere lands here straight away.
  useEffect(() => {
    const unsubscribe = base44.entities.ActivityLog.subscribe(() => loadLogs(true));
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

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
        <p className="text-slate-500">No activity recorded yet. Every new entry, change and deletion is logged here.</p>
      </div>
    );
  }

  const dateGroups = groupByDate(logs.map((log) => ({ ...log, day: logDay(log) })), "day");

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200">
        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
          <ScrollText className="w-5 h-5 text-slate-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Activity Log</h3>
          <p className="text-xs text-slate-500">{logs.length} recorded events — newest first</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-slate-500 text-left">
              <th className="px-4 py-3 font-medium w-24">Time</th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Page / Module</th>
              <th className="px-4 py-3 font-medium">Details</th>
            </tr>
          </thead>
          {dateGroups.map((group) => (
            <tbody key={group.date} className="divide-y divide-slate-100">
              <tr className="bg-slate-100 border-y-2 border-slate-200">
                <td colSpan={5} className="px-0 py-0">
                  <div className="flex items-center gap-3 px-4 py-2.5 border-l-4 border-slate-500">
                    <span className="font-bold text-slate-800 text-sm">{formatDateHeader(group.date)}</span>
                    <span className="text-xs text-slate-400">
                      ({group.items.length} {group.items.length === 1 ? "event" : "events"})
                    </span>
                  </div>
                </td>
              </tr>
              {group.items.map((log) => {
                const changes = Array.isArray(log.changes) ? log.changes : [];
                const shown = changes.slice(0, MAX_CHANGE_LINES);
                const hidden = changes.length - shown.length;
                return (
                  <tr key={log.id} className="hover:bg-slate-50 align-top">
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{logTime(log)}</td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700 font-medium">{log.user_name || "—"}</p>
                      {log.user_email && <p className="text-xs text-slate-400">{log.user_email}</p>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ACTION_STYLES[log.action_type] || "bg-slate-100 text-slate-600"}`}>
                        {log.action_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{log.module}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <p>{log.details}</p>
                      {shown.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {shown.map((change, index) => (
                            <li key={index} className="text-xs text-slate-500">{change}</li>
                          ))}
                          {hidden > 0 && <li className="text-xs text-slate-400">+{hidden} more</li>}
                        </ul>
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
  );
}