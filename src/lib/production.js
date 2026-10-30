// Shared logic for production orders, batch numbering and the day schedule.
// Orders link to Product Master (product, batch size, packaging) and to the
// Machines list (capacity and maintenance status).
import { base44 } from "@/api/base44Client";
import { actingUserName, appRoleOf, isAdminUser } from "@/lib/permissions";
import { eventStamp, todayStr } from "@/lib/warehouse";
import { num } from "@/lib/planning";

export const PRODUCTION_SETTINGS_KEY = "production";
export const BATCH_PATTERN_DEFAULT = "{CODE}{DDMMYYYY}{LETTER}";
export const BATCH_PATTERN_TOKENS = ["{CODE}", "{DDMMYYYY}", "{YYMMDD}", "{LETTER}", "{SEQ}"];
export const DEFAULT_CPH = 300;
export const ORDER_STATUSES = ["Planned", "In Progress", "Completed", "Cancelled"];
export const PRIORITIES = ["Low", "Normal", "High", "Urgent"];
export const SLOT_MINUTES = 15;

const role = (user) => appRoleOf(user);

// Planning and deleting orders is a supervisor job; pressing Start/Finish is for
// the people running the line; restoring a deleted order stays with Admin.
export const canPlanOrders = (user) => isAdminUser(user) || ["manager", "supervisor"].includes(role(user));
export const canRunOrders = (user) => isAdminUser(user) || ["manager", "supervisor", "operator"].includes(role(user));
export const canDeleteOrders = (user) => isAdminUser(user) || role(user) === "manager";
export const canRestoreOrders = (user) => isAdminUser(user);
export const canEditProductionSettings = (user) => isAdminUser(user) || role(user) === "manager";

export const fmtQty = (v) => num(v).toLocaleString("en-US", { maximumFractionDigits: 2 });
const pad2 = (n) => String(n).padStart(2, "0");

export const loadProductionSettings = async () => {
  const page = await base44.entities.ProductionSettings.filter({ key: PRODUCTION_SETTINGS_KEY }, { limit: 1 });
  const doc = (page.items || [])[0] || {};
  return {
    id: doc.id || "",
    batch_pattern: doc.batch_pattern || BATCH_PATTERN_DEFAULT,
    default_cph: num(doc.default_cph) || DEFAULT_CPH,
  };
};

export const saveProductionSettings = async ({ settings, user }) => {
  const payload = {
    key: PRODUCTION_SETTINGS_KEY,
    batch_pattern: (settings.batch_pattern || "").trim() || BATCH_PATTERN_DEFAULT,
    default_cph: num(settings.default_cph) || DEFAULT_CPH,
    updated_by: actingUserName(user),
  };
  if (settings.id) return base44.entities.ProductionSettings.update(settings.id, payload);
  return base44.entities.ProductionSettings.create(payload);
};

export const loadOrders = async () => {
  const rows = await base44.entities.ProductionOrder.list("-created_date", 1000).catch(() => []);
  return Array.isArray(rows) ? rows : [];
};

export const loadReceipts = async () => {
  const rows = await base44.entities.GoodsReceipt.list("-created_date", 500).catch(() => []);
  return Array.isArray(rows) ? rows : [];
};

export const liveOrders = (orders = []) => orders.filter((o) => !o.deleted);

// ---- dates and times -------------------------------------------------------
export const localDateStr = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : todayStr(d);
};

export const toLocalInput = (iso) => {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return `${todayStr(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

export const fromLocalInput = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
};

export const minuteOfDay = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 0 : d.getHours() * 60 + d.getMinutes();
};

export const atMinuteOfDay = (dateStr, minutes) => {
  const [y, m, d] = (dateStr || todayStr()).split("-").map(Number);
  return new Date(y, m - 1, d, 0, minutes, 0, 0).toISOString();
};

export const addMinutes = (iso, minutes) => new Date(new Date(iso).getTime() + minutes * 60000).toISOString();

export const fmtTime = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

export const fmtDateTime = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${todayStr(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

export const fmtRange = (startIso, endIso) => `${fmtTime(startIso)} – ${fmtTime(endIso)}`;

export const fmtDuration = (minutes) => {
  const mins = Math.max(0, Math.round(num(minutes)));
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
};

// ---- order maths -----------------------------------------------------------
export const batchCount = (product, quantity) => {
  const size = num(product?.standard_batch_cartons);
  const qty = num(quantity);
  if (!(size > 0) || !(qty > 0)) return 1;
  return Math.ceil(qty / size);
};

export const capacityOf = (machine, settings) => num(machine?.capacity_cph) || num(settings?.default_cph) || DEFAULT_CPH;

export const runMinutes = (quantity, cph) => {
  const rate = num(cph) || DEFAULT_CPH;
  const raw = (num(quantity) / rate) * 60;
  return Math.max(SLOT_MINUTES, Math.ceil(raw / SLOT_MINUTES) * SLOT_MINUTES);
};

// Suggested machine: the product's default line when it exists, otherwise the
// first machine that is not under maintenance.
export const suggestedMachine = (product, machines = []) => {
  const byName = machines.find((m) => m.name === product?.default_machine);
  if (byName) return byName;
  return machines.find((m) => m.status !== "Under Maintenance") || machines[0] || null;
};

export const letterFor = (index) => {
  let n = Math.max(1, Math.round(num(index) || 1)) - 1;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
};

const ddmmyyyy = (dateStr) => {
  const [y, m, d] = (dateStr || todayStr()).split("-");
  return `${d}${m}${y}`;
};
const yymmdd = (dateStr) => {
  const [y, m, d] = (dateStr || todayStr()).split("-");
  return `${y.slice(2)}${m}${d}`;
};

export const applyBatchPattern = (pattern, { code, dateStr, index }) => {
  const parts = {
    "{CODE}": String(code || "PROD").toUpperCase().replace(/\s+/g, ""),
    "{DDMMYYYY}": ddmmyyyy(dateStr),
    "{YYMMDD}": yymmdd(dateStr),
    "{LETTER}": letterFor(index),
    "{SEQ}": pad2(index),
  };
  let out = pattern || BATCH_PATTERN_DEFAULT;
  Object.entries(parts).forEach(([token, value]) => { out = out.split(token).join(value); });
  return out.replace(/[^A-Za-z0-9-]/g, "").toUpperCase();
};

export const buildBatchCodes = ({ code, plannedStart, count, pattern }) => {
  const dateStr = localDateStr(plannedStart) || todayStr();
  return Array.from({ length: Math.max(1, Math.round(num(count) || 1)) }, (_, i) =>
    applyBatchPattern(pattern, { code, dateStr, index: i + 1 })
  );
};

export const nextOrderNumber = (orders = []) => {
  const highest = orders.reduce((max, o) => {
    const found = /(\d+)\s*$/.exec(o.order_number || "");
    return found ? Math.max(max, Number(found[1])) : max;
  }, 0);
  return `PO-${String(highest + 1).padStart(4, "0")}`;
};

// Orders already sitting on a machine in a time window (cancelled and deleted
// orders do not block the plan).
export const overlapsOnMachine = (orders, machineName, startIso, endIso, ignoreId) => {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return (orders || []).filter((o) => {
    if (o.deleted || o.status === "Cancelled" || o.id === ignoreId) return false;
    if ((o.machine || "") !== (machineName || "")) return false;
    const oStart = new Date(o.planned_start).getTime();
    const oEnd = new Date(o.planned_end || o.planned_start).getTime();
    return oStart < end && oEnd > start;
  });
};

export const isUnderMaintenance = (machine) => machine?.status === "Under Maintenance";

export const ordersOnDate = (orders, dateStr) =>
  (orders || []).filter((o) => !o.deleted && localDateStr(o.planned_start) === dateStr);

// ---- stock risk ------------------------------------------------------------
const receiptStock = (receipts = []) => {
  const map = new Map();
  receipts.forEach((r) => {
    const code = (r.item_code || "").trim().toUpperCase();
    if (!code) return;
    map.set(code, (map.get(code) || 0) + num(r.quantity));
  });
  return map;
};

// Materials come from the active recipe (one batch × number of batches), packaging
// from the product's packaging per carton × target cartons.
export const buildRisks = ({ order, product, recipe, packagingItems = [], receipts = [] }) => {
  const batches = num(order?.batches) || 1;
  const cartons = num(order?.quantity_cartons);
  const stock = receiptStock(receipts);

  const materials = (recipe?.ingredients || []).map((ing) => {
    const needed = num(ing.quantity_per_batch) * batches;
    const code = (ing.item_code || "").trim().toUpperCase();
    const available = code ? stock.get(code) ?? 0 : null;
    return {
      name: ing.material_name || ing.item_code || "Material",
      code: ing.item_code || "",
      unit: ing.unit || "",
      needed,
      available,
      short: available == null || available < needed,
    };
  });

  const packaging = (product?.packaging_per_carton || []).map((p) => {
    const item = packagingItems.find((i) => i.id === p.item_id) || packagingItems.find((i) => i.item_code === p.item_code);
    const needed = num(p.quantity) * cartons;
    const available = item ? num(item.quantity) : null;
    return {
      name: p.item_name || p.item_code || "Packaging",
      code: p.item_code || "",
      unit: p.unit || item?.unit || "",
      needed,
      available,
      short: available == null || available < needed,
    };
  });

  return {
    materials,
    packaging,
    materialsShort: materials.filter((m) => m.short),
    packagingShort: packaging.filter((p) => p.short),
    hasRecipe: !!recipe,
  };
};

// ---- audit -----------------------------------------------------------------
export const logProductionAudit = async ({ user, action, recordId, details, oldValue = "", newValue = "" }) => {
  try {
    await base44.entities.AuditLog.create({
      event_time: new Date().toISOString(),
      event_stamp: eventStamp(),
      user_name: actingUserName(user),
      module: "Production Orders",
      action,
      record_id: recordId || "",
      details,
      old_value: oldValue,
      new_value: newValue,
    });
  } catch {
    // The order change stands even if the audit entry cannot be written.
  }
};