import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Download, Lock } from "lucide-react";

const ACTION_TONES = {
  Created: "text-[#00e5ff]",
  Updated: "text-[#e2e8f0]",
  Deleted: "text-[#ff4d4d]",
  Verified: "text-[#00ff9d]",
};

const ACTIONS = ["all", "Created", "Updated", "Deleted", "Verified"];

// Audit Trail Log: read-only, automatically written by every module. Nobody can
// edit or delete entries. Includes date/module/user/action filters and CSV export.
export default function AuditTrailLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ from: "", to: "", module: "", user: "", action: "all" });

  useEffect(() => {
    const load = async () => {
      try {
        const data = await base44.entities.AuditLog.list("-created_date", 500);
        setLogs(data);
      } finally {
        setLoading(false);
      }
    };
    load();
    const unsubscribe = base44.entities.AuditLog.subscribe(() => load());
    return () => { if (typeof unsubscribe === "function") unsubscribe(); };
  }, []);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      const stamp = (l.event_stamp || l.event_time || "").slice(0, 10);
      if (filters.from && stamp < filters.from) return false;
      if (filters.to && stamp > filters.to) return false;
      if (filters.module && !(l.module || "").toLowerCase().includes(filters.module.toLowerCase())) return false;
      if (filters.user && !(l.user_name || "").toLowerCase().includes(filters.user.toLowerCase())) return false;
      if (filters.action !== "all" && l.action !== filters.action) return false;
      return true;
    });
  }, [logs, filters]);

  const exportCsv = () => {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["Timestamp", "User", "Module", "Action", "Record ID", "Details", "Old Value", "New Value"];
    const rows = filtered.map((l) => [l.event_stamp, l.user_name, l.module, l.action, l.record_id, l.details, l.old_value, l.new_value]);
    const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  return (
    <div className="min-h-screen bg-[#0a0e17] p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-white text-lg font-semibold">Audit Trail Log</h2>
          <p className="text-[#a0aec0] text-sm mt-1 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[#00e5ff]" /> Read-only: every create, edit, delete, status change and verification is logged automatically.
          </p>
        </div>
        <Button onClick={exportCsv} disabled={filtered.length === 0} className="bg-[#00e5ff] hover:bg-[#00c3d7] text-[#0a0e17]">
          <Download className="w-4 h-4 mr-1" /> Export CSV ({filtered.length})
        </Button>
      </div>

      <div className="bg-[#131926] rounded-xl border border-[#1e2740] px-4 py-3 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <span className="text-[11px] text-[#a0aec0]">From</span>
          <Input type="date" value={filters.from} onChange={(e) => set("from", e.target.value)} className="bg-[#0e131d] border-[#1e2740] text-white h-9 w-[150px]" />
        </div>
        <div className="space-y-1">
          <span className="text-[11px] text-[#a0aec0]">To</span>
          <Input type="date" value={filters.to} onChange={(e) => set("to", e.target.value)} className="bg-[#0e131d] border-[#1e2740] text-white h-9 w-[150px]" />
        </div>
        <div className="space-y-1">
          <span className="text-[11px] text-[#a0aec0]">Module</span>
          <Input placeholder="Filter by module" value={filters.module} onChange={(e) => set("module", e.target.value)} className="bg-[#0e131d] border-[#1e2740] text-white h-9 w-[170px]" />
        </div>
        <div className="space-y-1">
          <span className="text-[11px] text-[#a0aec0]">User</span>
          <Input placeholder="Filter by user" value={filters.user} onChange={(e) => set("user", e.target.value)} className="bg-[#0e131d] border-[#1e2740] text-white h-9 w-[170px]" />
        </div>
        <div className="space-y-1">
          <span className="text-[11px] text-[#a0aec0]">Action</span>
          <Select value={filters.action} onValueChange={(v) => set("action", v)}>
            <SelectTrigger className="bg-[#0e131d] border-[#1e2740] text-white h-9 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>{a === "all" ? "All Actions" : a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-[#131926] rounded-xl border border-[#1e2740] overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-[#1e2740] hover:bg-transparent">
              <TableHead className="text-[#a0aec0] whitespace-nowrap">Timestamp</TableHead>
              <TableHead className="text-[#a0aec0]">User</TableHead>
              <TableHead className="text-[#a0aec0]">Module</TableHead>
              <TableHead className="text-[#a0aec0]">Action</TableHead>
              <TableHead className="text-[#a0aec0]">Record</TableHead>
              <TableHead className="text-[#a0aec0]">Details</TableHead>
              <TableHead className="text-[#a0aec0]">Old Value</TableHead>
              <TableHead className="text-[#a0aec0]">New Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow className="border-[#1e2740]">
                <TableCell colSpan={8} className="text-center py-8">
                  <span className="inline-block w-5 h-5 border-2 border-[#1e2740] border-t-[#00e5ff] rounded-full animate-spin" />
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow className="border-[#1e2740]">
                <TableCell colSpan={8} className="text-center text-[#a0aec0] py-8">No audit entries match the filters.</TableCell>
              </TableRow>
            )}
            {!loading && filtered.map((l) => (
              <TableRow key={l.id} className="border-[#1e2740]">
                <TableCell className="text-xs text-[#a0aec0] whitespace-nowrap">{l.event_stamp || l.event_time}</TableCell>
                <TableCell className="text-sm text-white">{l.user_name || "—"}</TableCell>
                <TableCell className="text-sm text-[#e2e8f0]">{l.module || "—"}</TableCell>
                <TableCell className={`text-sm font-medium ${ACTION_TONES[l.action] || "text-[#a0aec0]"}`}>{l.action}</TableCell>
                <TableCell className="text-xs text-[#a0aec0] max-w-[120px] truncate">{l.record_id || "—"}</TableCell>
                <TableCell className="text-sm text-[#e2e8f0] max-w-[260px]">{l.details || "—"}</TableCell>
                <TableCell className="text-xs text-[#ff9f43] max-w-[120px] truncate">{l.old_value || "—"}</TableCell>
                <TableCell className="text-xs text-[#00ff9d] max-w-[120px] truncate">{l.new_value || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}