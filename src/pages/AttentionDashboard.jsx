import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { appRoleOf, appRoleLabel } from "@/lib/permissions";
import { sweepOverdue } from "@/lib/overdue";
import { productionLines } from "@/lib/shiftLogConstants";
import { Button } from "@/components/ui/button";
import { Factory, ShieldCheck, ClipboardList, Users, ClipboardCheck, TrendingUp, Info, UserCheck, Plus, ArrowUpCircle, AlertTriangle } from "lucide-react";
import KpiCard from "@/components/factoryops/KpiCard";
import DashboardFilterBar from "@/components/factoryops/DashboardFilterBar";
import CriticalAttentionTable from "@/components/factoryops/CriticalAttentionTable";
import PackagingLowStock from "@/components/packaging/PackagingLowStock";
import TodayScheduleSummary from "@/components/dashboard/TodayScheduleSummary";
import LossTodayTile from "@/components/yieldloss/LossTodayTile";
import ProductDataHealth from "@/components/productmaster/ProductDataHealth";

const ENTITIES = ["ProductionLog", "Downtime", "QualityDefect", "ProductHold", "HACCPCheck", "StaffingRecord", "DisciplineCase", "Task", "CAPA"];
const VERIFIED = ["Verified", "Resolved", "Released", "Completed"];
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmt = (n) => (n || 0).toLocaleString("en-US");

const isVerified = (r) => VERIFIED.includes(r.status);
const isOverdue = (r, today) => !isVerified(r) && !!r.due_date && r.due_date < today;
const isActiveHold = (r) => !["Completed", "Verified"].includes(r.status);

export default function AttentionDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filters, setFilters] = useState({ date: todayISO(), shift: "all", line: "all", status: "all" });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const f = filtersRef.current;
      const q = { shift_date: f.date };
      if (f.shift !== "all") q.shift_type = f.shift;
      const opt = { limit: 200 };
      const [prod, down, defects, holds, haccp, staffing, discipline, tasks, capas] = await Promise.all([
        base44.entities.ProductionLog.filter(q, opt).then((p) => p.items),
        // Demo / test downtime records never appear on the dashboard.
        base44.entities.Downtime.filter(q, opt).then((p) => p.items.filter((r) => !r.is_demo)),
        base44.entities.QualityDefect.filter(q, opt).then((p) => p.items),
        base44.entities.ProductHold.filter(q, opt).then((p) => p.items),
        base44.entities.HACCPCheck.filter(q, opt).then((p) => p.items),
        base44.entities.StaffingRecord.filter(q, opt).then((p) => p.items),
        base44.entities.DisciplineCase.filter(q, opt).then((p) => p.items),
        base44.entities.Task.filter(q, opt).then((p) => p.items),
        base44.entities.CAPA.filter(q, opt).then((p) => p.items),
      ]);
      setData({ prod, down, defects, holds, haccp, staffing, discipline, tasks, capas });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    // Anything past its due date automatically becomes "Overdue" so it shows up here.
    sweepOverdue().finally(() => load());
  }, [filters.date, filters.shift]);

  useEffect(() => {
    const reload = () => load(true);
    const subs = ENTITIES.map((name) => base44.entities[name].subscribe(reload));
    return () => subs.forEach((u) => { if (typeof u === "function") u(); });
  }, []);

  const { date, shift, line, status } = filters;

  const view = useMemo(() => {
    if (!data) return null;
    const today = date;
    const matchesScope = (r) => (line === "all" || !r.production_line || r.production_line === line);
    const matchesStatus = (r) => {
      if (status === "all") return true;
      if (status === "Verified") return isVerified(r);
      if (status === "Overdue") return isOverdue(r, today) || r.status === "Overdue";
      return !isVerified(r) && !isOverdue(r, today); // Open
    };
    const scope = (list) => (list || []).filter((r) => matchesScope(r) && matchesStatus(r));

    const prod = scope(data.prod);
    const down = scope(data.down);
    const defects = scope(data.defects);
    const holds = scope(data.holds);
    const haccp = scope(data.haccp);
    const staffing = scope(data.staffing);
    const discipline = scope(data.discipline);
    const tasks = scope(data.tasks);
    const capas = scope(data.capas);

    // Production
    const actual = prod.reduce((s, r) => s + (r.actual_output || 0), 0);
    const target = prod.reduce((s, r) => s + (r.planned_qty || 0), 0);
    const eff = target > 0 ? (actual / target) * 100 : 0;
    const ordersAtRisk = prod.filter((r) => r.order_status === "at_risk").length;

    // Quality & Holds
    const defectQty = defects.reduce((s, r) => s + (r.defect_qty || 0), 0);
    const activeHolds = holds.filter(isActiveHold).length;
    const openCapas = capas.filter((r) => !isVerified(r)).length;

    // Food Safety / HACCP
    const haccpOverdue = haccp.filter((r) => isOverdue(r, today) || r.status === "Overdue").length;
    const failedLimits = haccp.filter((r) => r.result === "Fail" && r.status !== "Verified").length;
    const halalDone = haccp.filter((r) => r.halal_verified).length;
    const halalPct = haccp.length > 0 ? Math.round((halalDone / haccp.length) * 100) : 0;

    // Staffing
    const onShift = staffing.reduce((s, r) => s + (r.actual_headcount || 0), 0);
    const plannedHeads = staffing.reduce((s, r) => s + (r.planned_headcount || 0), 0);
    const gaps = staffing.filter((r) => r.gap_logged).length;
    const openDiscipline = discipline.filter((r) => !isVerified(r)).length;

    // Attention Actions (tasks + CAPAs)
    const attention = [...tasks, ...capas];
    const overdueActions = attention.filter((r) => isOverdue(r, today) || r.status === "Overdue").length;
    const dueToday = attention.filter((r) => !isVerified(r) && r.due_date === today).length;
    const verifiedActions = attention.filter((r) => isVerified(r)).length;

    // Shift Data Completion
    const totalLines = productionLines.length;
    const linesLogged = new Set(prod.map((r) => r.production_line).filter(Boolean)).size;

    // Critical attention items across all modules
    const critical = [];
    tasks.forEach((r) => { if (!isVerified(r)) critical.push({ item: r.title, module: "Supervisor Task Matrix", owner: r.owner, due: r.due_date || r.shift_date, status: r.status === "Overdue" || isOverdue(r, today) ? "Overdue" : "Pending Verification", path: "/task-matrix" }); });
    capas.forEach((r) => { if (!isVerified(r)) critical.push({ item: r.title, module: "Unified CAPA Tracker", owner: r.owner, due: r.due_date || r.shift_date, status: r.status === "Overdue" || isOverdue(r, today) ? "Overdue" : "Pending Verification", path: "/capa-tracker" }); });
    haccp.forEach((r) => { if (!isVerified(r) && (r.status === "Overdue" || isOverdue(r, today) || r.result === "Pending")) critical.push({ item: r.check_name, module: "QA & HACCP Safety", owner: r.owner, due: r.due_date || r.shift_date, status: r.status === "Overdue" || isOverdue(r, today) ? "Overdue" : "Pending Verification", path: "/qa-haccp" }); });
    down.forEach((r) => { if (r.status === "Open") critical.push({ item: r.reason, module: "Requests & Stoppages", owner: r.owner, due: r.shift_date, status: "Open", path: "/downtime" }); });
    holds.forEach((r) => { if (isActiveHold(r)) critical.push({ item: r.hold_reason, module: "QA & HACCP Safety", owner: r.owner, due: r.shift_date, status: "Open", path: "/qa-haccp" }); });
    critical.sort((a, b) => {
      const ao = a.status === "Overdue" ? 0 : 1;
      const bo = b.status === "Overdue" ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return (a.due || "").localeCompare(b.due || "");
    });

    return { actual, target, eff, ordersAtRisk, defectQty, activeHolds, openCapas, haccpOverdue, failedLimits, halalPct, onShift, plannedHeads, gaps, openDiscipline, overdueActions, dueToday, verifiedActions, linesLogged, totalLines, critical };
  }, [data, date, shift, line, status]);

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0e17]">
        <div className="w-8 h-8 border-4 border-[#1e2740] border-t-[#00e5ff] rounded-full animate-spin" />
      </div>
    );
  }

  const role = appRoleOf(user);
  const targetLabel = view.target >= 1000 ? `${(view.target / 1000).toFixed(view.target % 1000 === 0 ? 0 : 1)}k` : `${view.target}`;

  return (
    <div className="min-h-screen bg-[#0a0e17] p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[#a0aec0]">Your role:</span>
          <span className="px-2 py-0.5 rounded-full bg-[#00e5ff]/15 text-[#00e5ff] border border-[#00e5ff]/30 text-xs font-medium">
            {role === "admin" ? "Admin" : role ? appRoleLabel(role) : "Custom modules"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => navigate("/shift-log-draft")} className="bg-[#00e5ff] hover:bg-[#00c3d7] text-[#0a0e17]">
            <Plus className="w-4 h-4 mr-1" /> Log Shift Output
          </Button>
          <Button onClick={() => navigate("/downtime")} className="bg-[#ff9f43] hover:bg-[#ff8c1a] text-[#0a0e17]">
            <ArrowUpCircle className="w-4 h-4 mr-1" /> Log Downtime
          </Button>
          <Button onClick={() => navigate("/capa-tracker")} className="bg-[#ff4d4d] hover:bg-[#e63b3b] text-white">
            🛡 Raise CAPA
          </Button>
        </div>
      </div>

      <DashboardFilterBar
        date={date}
        shift={shift}
        line={line}
        status={status}
        onChange={(key, value) => setFilters((f) => ({ ...f, [key]: value }))}
        onReset={() => setFilters({ date: todayISO(), shift: "all", line: "all", status: "all" })}
      />

      {(view.failedLimits > 0 || view.activeHolds > 0) && (
        <div className="bg-[#ff4d4d]/10 border border-[#ff4d4d] rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-[#ff4d4d] shrink-0" />
          <div className="flex-1 min-w-[220px]">
            <h3 className="text-[#ff4d4d] text-sm font-semibold">Critical Quality Alert</h3>
            <p className="text-[#e2e8f0] text-xs mt-0.5">
              {view.failedLimits} failed HACCP critical limit{view.failedLimits === 1 ? "" : "s"} and {view.activeHolds} active product hold{view.activeHolds === 1 ? "" : "s"} need attention. CAPA drafts are created automatically.
            </p>
          </div>
          <Button onClick={() => navigate("/qa-haccp?tab=holds")} className="bg-[#ff4d4d] hover:bg-[#e63b3b] text-white">
            Review in QA &amp; HACCP
          </Button>
        </div>
      )}

      <TodayScheduleSummary />

      <ProductDataHealth />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
        <LossTodayTile />
        <PackagingLowStock />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard
          icon={Factory}
          title="Production"
          value={`${fmt(view.actual)} / ${targetLabel}`}
          valueSub="target"
          stats={[
            { text: `${view.eff.toFixed(1)}% Eff`, tone: "green" },
            { text: `${view.ordersAtRisk} Order${view.ordersAtRisk === 1 ? "" : "s"} At Risk`, tone: "orange" },
          ]}
          onClick={() => navigate("/shift-log-draft")}
        />
        <KpiCard
          icon={ClipboardCheck}
          title="Quality & Holds"
          value={`${fmt(view.defectQty)} Defects`}
          stats={[
            { text: `${view.activeHolds} Active Holds`, tone: "red" },
            { text: `${view.openCapas} Open CAPAs`, tone: "white" },
          ]}
          onClick={() => navigate(`/qa-haccp?tab=holds&status=Open`)}
        />
        <KpiCard
          icon={ShieldCheck}
          title="Food Safety / HACCP"
          value={`${view.haccpOverdue} Check${view.haccpOverdue === 1 ? "" : "s"} Overdue`}
          stats={[
            { text: `${view.failedLimits} Failed Limits`, tone: view.failedLimits > 0 ? "red" : "green" },
            { text: `${view.halalPct}% Halal Verified`, tone: "green" },
          ]}
          onClick={() => navigate(`/qa-haccp?tab=checks&status=Open`)}
        />
        <KpiCard
          icon={Users}
          title="Staffing"
          value={`${fmt(view.onShift)} / ${fmt(view.plannedHeads)} On Shift`}
          stats={[
            { text: `${view.gaps} Gap${view.gaps === 1 ? "" : "s"} Logged`, tone: view.gaps > 0 ? "orange" : "muted" },
            { text: `${view.openDiscipline} Open Discipline`, tone: view.openDiscipline > 0 ? "orange" : "muted" },
          ]}
          onClick={() => navigate(`/staffing?status=Open`)}
        />
        <KpiCard
          icon={ClipboardList}
          title="Attention Actions"
          value={`${view.overdueActions} Overdue`}
          alert={view.overdueActions > 0}
          stats={[
            { text: `${view.dueToday} Due Today`, tone: "white" },
            { text: `${view.verifiedActions} Verified`, tone: "green" },
          ]}
          onClick={() => navigate(`/task-matrix?status=Overdue`)}
        />
        <KpiCard
          icon={TrendingUp}
          title="Shift Data Completion"
          value={`${view.linesLogged} / ${view.totalLines} Lines Complete`}
          progress={{ value: view.totalLines > 0 ? (view.linesLogged / view.totalLines) * 100 : 0 }}
          onClick={() => navigate("/shift-log-draft")}
        />
      </div>

      <div className="bg-[#101828] rounded-xl border border-[#1e2740] px-4 py-3 flex flex-wrap items-center gap-3">
        <Info className="w-5 h-5 text-[#00e5ff] shrink-0" />
        <div>
          <h3 className="text-white text-sm font-semibold">Daily Operational Focus Mandate</h3>
          <p className="text-[#a0aec0] text-xs mt-0.5">What needs attention today, who owns it, and is it completed with verified evidence?</p>
        </div>
        <span className="ml-auto flex items-center gap-1.5 text-[#00ff9d] text-xs font-medium">
          <UserCheck className="w-4 h-4" /> Strict Protocol: Verification Required for Closure
        </span>
      </div>

      <CriticalAttentionTable items={view.critical} onOpen={(item) => navigate(item.path)} />
    </div>
  );
}