import React, { useCallback, useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import HistoryStats from "@/components/history/HistoryStats";
import HistoryFilters from "@/components/history/HistoryFilters";
import HistoryTable from "@/components/history/HistoryTable";
import { EXPORT_COLUMNS, actionOptions, buildRows, filterRows, moduleOptions, summarize } from "@/components/history/historyRows";
import { downloadCsv, todayStr } from "@/lib/warehouse";
import { ShieldCheck } from "lucide-react";

const AUDIT_LIMIT = 500;
const ACTIVITY_LIMIT = 300;

// A member without the production line log permission cannot read ActivityLog;
// that source simply contributes nothing rather than breaking the page.
const auditEntries = async () => {
  try {
    const rows = await base44.entities.AuditLog.list("-created_date", AUDIT_LIMIT);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
};

const activityEntries = async () => {
  try {
    const page = await base44.entities.ActivityLog.filter({}, { sort: "-event_time", limit: ACTIVITY_LIMIT });
    return Array.isArray(page?.items) ? page.items : [];
  } catch {
    return [];
  }
};

const EMPTY_FILTERS = { from: "", to: "", actor: "all", action: "all", module: "all", search: "" };

// Activity History: one read-only timeline of everything done in the app — user
// actions, system actions and the data changes behind them.
export default function ActivityHistory() {
  const [audit, setAudit] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const [auditRows, activityRows] = await Promise.all([auditEntries(), activityEntries()]);
    setAudit(auditRows);
    setActivity(activityRows);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Live: an action anywhere in the app appears here straight away.
  useEffect(() => {
    const reload = () => load(true);
    const unsubscribes = [
      base44.entities.AuditLog.subscribe(reload),
      base44.entities.ActivityLog.subscribe(reload),
    ];
    return () => unsubscribes.forEach((unsubscribe) => { if (typeof unsubscribe === "function") unsubscribe(); });
  }, [load]);

  const rows = useMemo(() => buildRows(audit, activity), [audit, activity]);
  const modules = useMemo(() => moduleOptions(rows), [rows]);
  const actions = useMemo(() => actionOptions(rows), [rows]);
  const filtered = useMemo(() => filterRows(rows, filters), [rows, filters]);
  const stats = useMemo(() => summarize(filtered), [filtered]);

  const exportCsv = () => downloadCsv(`activity-history-${todayStr()}.csv`, EXPORT_COLUMNS, filtered);

  return (
    <div className="min-h-full bg-[#0a0e17] p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-white text-lg font-semibold">Activity History</h2>
          <p className="text-[#a0aec0] text-sm mt-1 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00e5ff]" />
            Read-only record of every action taken in the app, including user actions, system actions and data changes.
          </p>
        </div>
        <p className="text-[11px] text-[#5f6b7f]">
          Latest {AUDIT_LIMIT} audit entries and {ACTIVITY_LIMIT} production line entries
        </p>
      </div>

      <HistoryStats stats={stats} loading={loading} />
      <HistoryFilters filters={filters} onChange={setFilters} modules={modules} actions={actions} onExport={exportCsv} exportDisabled={filtered.length === 0} count={filtered.length} />
      <HistoryTable rows={filtered} loading={loading} />
    </div>
  );
}