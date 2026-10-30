// Page access is decided by the member's FactoryOps role (a fixed preset of
// modules), or by the modules assigned to them individually in User Management.
// Administrators can open every page; everyone else can open exactly the modules
// their role or assignment grants, and the Attention Dashboard as the shared home.
export const MODULES = [
  { key: "attention_dashboard", label: "Attention Dashboard", path: "/", description: "Overdue and unverified attention items across all modules" },
  { key: "dashboard", label: "Operations Overview", path: "/operations-overview", description: "Overview of output, waste, overtime and downtime" },
  { key: "production_line_logs", label: "Production Line Logs", path: "/production-line-logs", description: "Overview, operation, overtime, wastage, baseline and activity logs in one place" },
  { key: "production_orders", label: "Production Orders", path: "/production-orders", description: "Orders with batches, machine, run time and batch numbers" },
  { key: "production_schedule", label: "Production Schedule", path: "/production-schedule", description: "Day timeline per machine with drag-and-drop planning" },
  { key: "create_batch", label: "Create Batch / Labels", path: "/create-batch", description: "Record a batch and print its labels with a traceability QR code" },
  { key: "batch_records", label: "Batch Records", path: "/batch-records", description: "All created batches with search, CSV export and reprints" },
  { key: "yield_loss", label: "Yield & Loss", path: "/yield-loss", description: "Batch yield, packaging waste, giveaway and rework" },
  { key: "recently_deleted", label: "Recently Deleted", path: "/recently-deleted", description: "Deleted production orders, restorable by Admin", adminOnly: true },
  { key: "shift_log", label: "Daily Packaging Entry", path: "/shift-log-draft", description: "Daily packaging line record entry" },
  { key: "operation_record", label: "Operation Record", path: "/operation-logs", description: "Operation output & process improvement records" },
  { key: "overtime_record", label: "Overtime Record", path: "/overtime-record", description: "Overtime sessions, spend and workforce analytics" },
  { key: "wastage_records", label: "Wastage Record", path: "/wastage-logs", description: "Packaging material wastage records" },
  { key: "baseline_capacity", label: "Baseline Capacity", path: "/baseline-capacity", description: "Line capacity, setup and staffing baselines" },
  { key: "downtime", label: "Requests & Stoppages", path: "/downtime", description: "Downtime stoppages, item/material and approval requests" },
  { key: "staffing", label: "Staffing", path: "/staffing", description: "Shift headcount and staffing gaps" },
  { key: "qa_haccp", label: "QA & HACCP Safety", path: "/qa-haccp", description: "Food safety checks, defects and product holds" },
  { key: "task_matrix", label: "Supervisor Task Matrix", path: "/task-matrix", description: "Supervisor attention tasks and verification" },
  { key: "capa_tracker", label: "Unified CAPA Tracker", path: "/capa-tracker", description: "Corrective and preventive actions" },
  { key: "kpi_scorecards", label: "Role KPI Scorecards", path: "/kpi-scorecards", description: "Per-role performance scorecards" },
  { key: "audit_trail", label: "Audit Trail Log", path: "/audit-trail", description: "Chronological record of actions across modules" },
  { key: "activity_history", label: "Activity History", path: "/activity-history", description: "Every user action, system action and data change in one timeline" },
  { key: "activity_logs", label: "Activity Logs", path: "/activity-logs", description: "All recorded shift log entries" },
  { key: "warehouse_receiving", label: "Goods Receiving", path: "/goods-receiving", description: "Record goods received against a delivery note" },
  { key: "goods_tracker", label: "Goods Tracker", path: "/goods-tracker", description: "Searchable log of everything received into the warehouse" },
  { key: "goods_issued", label: "Goods Issued", path: "/goods-issued", description: "Record packaging stock going out to production" },
  { key: "packaging_stock", label: "Packaging Stock", path: "/packaging-stock", description: "Packaging material stock with in, use and count movements" },
  { key: "packaging_movements", label: "Stock Movements", path: "/packaging-movements", description: "Full log of stock in, use and adjustments" },
  { key: "packaging_approvals", label: "Stock Approvals", path: "/packaging-approvals", description: "Stock count and high-value issue approvals" },
  { key: "pic_product_entry", label: "PIC Product Entry", path: "/pic-product-entry", description: "Direct product entry & Supabase live sync for PIC" },
  { key: "product_master", label: "Product Master", path: "/product-master", description: "Product codes, carton sizes and packaging used per carton" },
  { key: "recipe_master", label: "Recipe Master", path: "/recipe-master", description: "Versioned recipes per product with ingredient lists" },
  { key: "machines", label: "Machines", path: "/machines", description: "Machine list with capacity and maintenance status" },
  { key: "user_management", label: "User Management", path: "/users", description: "Members, roles and invitations", adminOnly: true },
  { key: "data_import", label: "Import CSV Data", path: "/data-import", description: "Bulk import legacy records from CSV files", adminOnly: true }
];

// Modules an invitation offers by default; they are only granted once the invitation is
// sent with them.
export const USER_MODULE_KEYS = ["dashboard", "shift_log", "operation_record"];
export const ALL_MODULE_KEYS = MODULES.map((m) => m.key);

// Modules an administrator can hand out (User Management itself is administrator only).
export const ASSIGNABLE_MODULE_KEYS = MODULES.filter((m) => !m.adminOnly).map((m) => m.key);

export const isAdminUser = (user) => user?.role === "admin";

// FactoryOps roles. A role grants a fixed preset of modules; members without a
// role keep whatever modules were assigned to them individually.
export const APP_ROLES = [
  { key: "operator", label: "Operator / Line Leader", preset: ["shift_log", "downtime", "qa_haccp", "production_orders", "production_schedule", "create_batch", "batch_records", "yield_loss"] },
  { key: "supervisor", label: "Supervisor", preset: ["task_matrix", "shift_log", "downtime", "pic_product_entry", "product_master", "production_orders", "production_schedule", "create_batch", "batch_records", "yield_loss"] },
  { key: "qa_officer", label: "QA Officer", preset: ["qa_haccp", "capa_tracker", "pic_product_entry", "product_master", "recipe_master", "yield_loss"] },
  { key: "warehouse_staff", label: "Warehouse Staff", preset: ["warehouse_receiving", "goods_tracker", "goods_issued", "packaging_stock"] },
  { key: "warehouse_supervisor", label: "Warehouse Supervisor", preset: ["warehouse_receiving", "goods_tracker", "goods_issued", "packaging_stock", "packaging_movements", "packaging_approvals"] },
  { key: "manager", label: "Production Manager / MD", preset: ASSIGNABLE_MODULE_KEYS },
];

export const ROLE_PRESETS = Object.fromEntries(APP_ROLES.map((r) => [r.key, r.preset]));
export const appRoleLabel = (key) => APP_ROLES.find((r) => r.key === key)?.label || "Custom modules";

// "View as" demo roles (Admin only): temporarily limit the admin's visible
// modules to that role's, so they can see the app as that member would.
// Maintenance Technician covers stoppages and the daily packaging entry.
export const VIEW_AS_ROLES = [
  { key: "supervisor", label: "Packaging Supervisor" },
  { key: "maintenance", label: "Maintenance Technician" },
  { key: "qa_officer", label: "QA Officer" },
  { key: "manager", label: "Production Manager" },
];

const VIEW_AS_PRESETS = {
  supervisor: ROLE_PRESETS.supervisor,
  maintenance: ["downtime", "shift_log"],
  qa_officer: ROLE_PRESETS.qa_officer,
  manager: ASSIGNABLE_MODULE_KEYS,
};

// The member's FactoryOps role: "admin" for platform administrators, the stored
// app role, or null when access comes from individually assigned modules.
export const appRoleOf = (user) => (isAdminUser(user) ? "admin" : user?.app_role || null);

// Production Manager / MD and Admins can verify closures.
export const isManagerRole = (user) => ["admin", "manager"].includes(appRoleOf(user));

// Modules every signed-in member can open: the Attention Dashboard is the shared home.
export const BASE_MODULE_KEYS = ["attention_dashboard"];

export const effectiveModuleKeys = (user) => {
  if (!user) return [];
  if (isAdminUser(user)) {
    if (user.view_as_role) return [...BASE_MODULE_KEYS, ...(VIEW_AS_PRESETS[user.view_as_role] || [])];
    return ALL_MODULE_KEYS;
  }
  const preset = ROLE_PRESETS[user?.app_role];
  if (preset) return [...BASE_MODULE_KEYS, ...preset];
  const assigned = Array.isArray(user.permissions) ? user.permissions : [];
  return [...BASE_MODULE_KEYS, ...ASSIGNABLE_MODULE_KEYS.filter((key) => assigned.includes(key))];
};

// The merged Production Line Logs page also admits members who were granted any
// of the six modules it now contains, so no one loses access in the reorg.
const MODULE_ALIASES = {
  production_line_logs: ["dashboard", "operation_record", "overtime_record", "wastage_records", "baseline_capacity", "activity_logs"],
};

// True when modules have been assigned explicitly (an empty assignment means no access).
export const hasAssignedModules = (user) => Array.isArray(user?.permissions) && user.permissions.length > 0;

export const moduleLabel = (key) => MODULES.find((m) => m.key === key)?.label || key;

export const canAccess = (user, key) => {
  if (!user || !key) return false;
  const moduleDef = MODULES.find((m) => m.key === key);
  if (!moduleDef) return false;
  if (isAdminUser(user)) return true;
  if (moduleDef.adminOnly) return false;
  const effective = effectiveModuleKeys(user);
  return [key, ...(MODULE_ALIASES[key] || [])].some((k) => effective.includes(k));
};

export const moduleForPath = (pathname) => MODULES.find((m) => m.path === pathname)?.key || null;

export const ownsRecord = (user, record) => !!user?.id && !!record && record.created_by_id === user.id;

// A record may be changed by whoever entered it, or by an administrator.
export const canChangeRecord = (user, record) => isAdminUser(user) || ownsRecord(user, record);

// Shared status-change rules: an item cannot move to "Verified" without an
// evidence attachment and a verifier who is not the owner. Optionally closing
// (Completed) requires evidence, and verification is restricted to managers.
export const statusChangeGuard = (user, { requireEvidenceToComplete = false, managerVerifies = false } = {}) => (record, status) => {
  if (requireEvidenceToComplete && status === "Completed" && !record.evidence_file_uri) {
    return "This item cannot be closed without an evidence attachment.";
  }
  if (status === "Verified") {
    if (!record.evidence_file_uri) return "Items cannot move to Verified without an evidence attachment.";
    const me = (user?.full_name || user?.email || "").trim().toLowerCase();
    if (me && record.owner && record.owner.trim().toLowerCase() === me) {
      return "The verifier cannot be the owner of this item.";
    }
    if (managerVerifies && !isManagerRole(user)) {
      return "Only a Production Manager / MD or an Admin can verify this item.";
    }
  }
  return null;
};

// The name recorded in the Audit Trail: while an Admin is in "View as" mode,
// every action is recorded as "Admin (demo as <role>)".
export const actingUserName = (user) => {
  if (isAdminUser(user) && user?.view_as_role) {
    const label = VIEW_AS_ROLES.find((r) => r.key === user.view_as_role)?.label || user.view_as_role;
    return `Admin (demo as ${label})`;
  }
  return user?.full_name || user?.email || "";
};