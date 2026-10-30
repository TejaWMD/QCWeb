import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { MODULES, canAccess, isAdminUser } from "@/lib/permissions";
import { Radar, Factory, Clock, ShieldCheck, ClipboardList, AlertTriangle, Gauge, ScrollText, LayoutDashboard, Recycle, Users, Upload, PackagePlus, Boxes, PackageMinus, Layers, ArrowLeftRight, ClipboardCheck, Package, FlaskConical, Cog, ListChecks, CalendarDays, Trash2, Tag, History, Scale } from "lucide-react";

// FactoryOps modules. "Production Line Logs" opens the existing packaging record module.
const factoryItems = [
  { key: "attention_dashboard", label: "Attention Dashboard", icon: Radar },
  { key: "shift_log", label: "Daily Packaging Entry", icon: Factory },
  { key: "downtime", label: "Requests & Stoppages", icon: Clock },
  { key: "staffing", label: "Staffing", icon: Users },
  { key: "qa_haccp", label: "QA & HACCP Safety", icon: ShieldCheck },
  { key: "task_matrix", label: "Supervisor Task Matrix", icon: ClipboardList },
  { key: "capa_tracker", label: "Unified CAPA Tracker", icon: AlertTriangle, badge: "capa" },
  { key: "kpi_scorecards", label: "Role KPI Scorecards", icon: Gauge },
  { key: "audit_trail", label: "Audit Trail Log", icon: ScrollText },
  { key: "activity_history", label: "Activity History", icon: History },
];

// Planning: the masters and machine list, then the orders and schedule built from them.
const planningItems = [
  { key: "pic_product_entry", label: "PIC Product Entry", icon: PackagePlus },
  { key: "product_master", label: "Product Master", icon: Package },
  { key: "recipe_master", label: "Recipe Master", icon: FlaskConical },
  { key: "machines", label: "Machines", icon: Cog },
  { key: "production_orders", label: "Production Orders", icon: ListChecks },
  { key: "production_schedule", label: "Production Schedule", icon: CalendarDays },
];

// Production: batches and labels, their records, then the production line logs hub.
const productionItems = [
  { key: "create_batch", label: "Create Batch / Labels", icon: Tag },
  { key: "batch_records", label: "Batch Records", icon: History },
  { key: "production_line_logs", label: "Production Line Logs", icon: LayoutDashboard },
  { key: "yield_loss", label: "Yield & Loss", icon: Scale },
];

// Warehouse: goods in and out, the searchable goods log and packaging stock.
const warehouseItems = [
  { key: "warehouse_receiving", label: "Goods Receiving", icon: PackagePlus },
  { key: "goods_issued", label: "Goods Issued", icon: PackageMinus },
  { key: "goods_tracker", label: "Goods Tracker", icon: Boxes },
  { key: "packaging_stock", label: "Packaging Stock", icon: Layers },
  { key: "packaging_movements", label: "Stock Movements", icon: ArrowLeftRight },
  { key: "packaging_approvals", label: "Stock Approvals", icon: ClipboardCheck },
];

// System: administration only, so the whole section stays hidden from everyone else.
const systemItems = [
  { key: "user_management", label: "User Management", icon: Users, adminOnly: true },
  { key: "data_import", label: "Import CSV Data", icon: Upload, adminOnly: true },
  { key: "recently_deleted", label: "Recently Deleted", icon: Trash2, adminOnly: true },
];

const pathOf = (key) => MODULES.find((m) => m.key === key)?.path;

export default function FactorySidebar() {
  const location = useLocation();
  const { user } = useAuth();
  const [capaOpen, setCapaOpen] = useState(0);

  useEffect(() => {
    const loadCount = async () => {
      try {
        setCapaOpen(await base44.entities.CAPA.count({ status: { $ne: "Verified" } }));
      } catch {
        setCapaOpen(0);
      }
    };
    loadCount();
    const unsubscribe = base44.entities.CAPA.subscribe(loadCount);
    return () => { if (typeof unsubscribe === "function") unsubscribe(); };
  }, []);

  const hour = new Date().getHours();
  const shiftLabel = hour >= 6 && hour < 18 ? "Shift A (Day)" : "Shift B (Night)";

  const renderSection = (title, items) => (
    <div>
      <p className="px-3 pt-4 pb-2 text-[10px] font-semibold tracking-widest text-[#5f6b7f] hidden xl:block">{title}</p>
      <nav className="space-y-0.5">
        {items
          .filter((item) => (item.adminOnly ? isAdminUser(user) : canAccess(user, item.key)))
          .map((item) => {
            const path = pathOf(item.key);
            const active = location.pathname === path;
            return (
              <Link
                key={`${item.key}-${item.label}`}
                to={path}
                title={item.label}
                className={`flex items-center gap-2.5 px-3 py-2 text-sm border-l-2 transition-colors justify-center xl:justify-start ${
                  active
                    ? "border-[#00e5ff] text-[#00e5ff] bg-[#00e5ff]/5"
                    : "border-transparent text-[#a0aec0] hover:text-white hover:bg-white/5"
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="truncate hidden xl:inline">{item.label}</span>
                {item.badge === "capa" && capaOpen > 0 && (
                  <span className="ml-auto text-[10px] font-bold text-white bg-[#ff4d4d] rounded-full px-1.5 py-0.5 min-w-[18px] text-center hidden xl:inline">
                    {capaOpen}
                  </span>
                )}
              </Link>
            );
          })}
      </nav>
    </div>
  );

  return (
    <aside className="w-16 xl:w-64 bg-[#0e131d] border-r border-[#131926] flex flex-col shrink-0 sticky top-0 h-screen overflow-y-auto transition-all">
      {renderSection("MODULES", factoryItems)}
      {renderSection("PLANNING", planningItems)}
      {renderSection("PRODUCTION", productionItems)}
      {renderSection("WAREHOUSE", warehouseItems)}
      {isAdminUser(user) && renderSection("SYSTEM", systemItems)}
      <div className="mt-auto px-4 py-4 border-t border-[#131926] hidden xl:block">
        <p className="text-[10px] font-semibold tracking-widest text-[#5f6b7f] mb-2">ACTIVE SHIFT STATUS</p>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#00ff9d] animate-pulse" />
          <span className="text-sm text-white">{shiftLabel} • Plant 1</span>
        </div>
        <p className="text-xs text-[#a0aec0] mt-1">Supervisor: {user?.full_name || user?.email || "—"}</p>
      </div>
    </aside>
  );
}