// Shared logic for the Packaging Stock module: stock maths, movement logging,
// batch (FEFO) helpers and the approval rules for counts and large issues.
import { base44 } from "@/api/base44Client";
import { actingUserName, isAdminUser } from "@/lib/permissions";
import { eventStamp, todayStr } from "@/lib/warehouse";

export const PACKAGING_SETTINGS_KEY = "packaging_stock";
export const DEFAULT_CATEGORIES = [
  "Labels",
  "Cartons",
  "Caps & Closures",
  "Bottles & Jars",
  "Pouches & Foil",
  "Shrink Film",
  "Tape & Adhesive",
  "Other",
];
export const DEFAULT_UNITS = ["PCS", "kg", "roll", "box", "pack", "carton", "pallet", "L", "m"];
export const MOVEMENT_TYPES = ["In", "Use", "Adjustment"];
export const USE_THRESHOLD_DEFAULT = 500;

export const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
export const fmtQty = (v) => num(v).toLocaleString("en-US", { maximumFractionDigits: 2 });

// Warehouse staff key stock in, out and counts; supervisors and admins approve.
export const isPackagingStaff = (user) =>
  isAdminUser(user) || ["warehouse_staff", "warehouse_supervisor"].includes(user?.app_role);
export const canApproveStock = (user) =>
  isAdminUser(user) || user?.app_role === "warehouse_supervisor";
export const canManagePackaging = canApproveStock;

export const newGroupId = (prefix = "PKG") => `${prefix}-${Date.now().toString(36).toUpperCase()}`;

export const isLowStock = (item) => num(item?.quantity) <= num(item?.min_level);

export const itemStatus = (item, hasPendingApproval) => {
  if (hasPendingApproval) return "Pending approval";
  if (num(item.quantity) <= 0) return "No stock";
  if (isLowStock(item)) return "Low stock";
  return "In stock";
};

export const loadPackagingSettings = async () => {
  const page = await base44.entities.PackagingSettings.filter({ key: PACKAGING_SETTINGS_KEY }, { limit: 1 });
  const doc = (page.items || [])[0] || {};
  return {
    id: doc.id || "",
    categories: Array.isArray(doc.categories) && doc.categories.length ? doc.categories : DEFAULT_CATEGORIES,
    threshold: doc.use_approval_threshold != null ? num(doc.use_approval_threshold) : USE_THRESHOLD_DEFAULT,
  };
};

// Production orders for the "Use" form: the planned batches already captured on
// the packaging shift logs.
export const loadProductionOrders = async () => {
  const rows = await base44.entities.ShiftLog.list("-created_date", 200);
  const seen = new Set();
  const options = [];
  (Array.isArray(rows) ? rows : []).forEach((r) => {
    const label = [r.product_name, r.batch_number].filter(Boolean).join(" · ");
    if (!label || seen.has(label)) return;
    seen.add(label);
    options.push({ value: label, label });
  });
  return options.slice(0, 100);
};

const logAudit = async (user, action, recordId, details) => {
  try {
    await base44.entities.AuditLog.create({
      event_time: new Date().toISOString(),
      event_stamp: eventStamp(),
      user_name: actingUserName(user),
      module: "Packaging Stock",
      action,
      record_id: recordId,
      details,
    });
  } catch {
    // An audit write must never block the stock action itself.
  }
};

export const logMovement = (item, type, quantity, user, extras = {}) =>
  base44.entities.PackagingMovement.create({
    item_id: item.id,
    item_code: item.item_code || "",
    item_name: item.description || item.item_code || "",
    category: item.category || "",
    unit: item.unit || "",
    type,
    quantity: num(quantity),
    movement_date: extras.movement_date || todayStr(),
    batch_number: extras.batch_number || "",
    rack_location: extras.rack_location || "",
    expiry_date: extras.expiry_date || "",
    supplier: extras.supplier || "",
    delivery_note: extras.delivery_note || "",
    production_order: extras.production_order || "",
    production_line: extras.production_line || "",
    remarks: extras.remarks || "",
    source: extras.source || "",
    group_id: extras.group_id || "",
    approval_id: extras.approval_id || "",
    user_name: actingUserName(user),
    user_id: user?.id || "",
  });

const setItemQuantity = (item, quantity) =>
  base44.entities.PackagingItem.update(item.id, { quantity: Math.max(0, num(quantity)) });

export const receiveStock = async ({ item, quantity, user, extras = {} }) => {
  const qty = num(quantity);
  if (!(qty > 0)) throw new Error("Quantity must be greater than zero.");
  const movement = await logMovement(item, "In", qty, user, extras);
  await setItemQuantity(item, num(item.quantity) + qty);
  await logAudit(user, "Created", item.id, `Stock in ${fmtQty(qty)} ${item.unit || ""} of ${item.item_code}`);
  return movement;
};

export const issueStock = async ({ item, quantity, user, extras = {} }) => {
  const qty = num(quantity);
  if (!(qty > 0)) throw new Error("Quantity must be greater than zero.");
  if (qty > num(item.quantity)) {
    throw new Error(`Only ${fmtQty(item.quantity)} ${item.unit || ""} of ${item.item_code} in stock.`);
  }
  const movement = await logMovement(item, "Use", qty, user, extras);
  await setItemQuantity(item, num(item.quantity) - qty);
  await logAudit(user, "Updated", item.id, `Stock out ${fmtQty(qty)} ${item.unit || ""} of ${item.item_code}`);
  return movement;
};

const createApproval = (payload) =>
  base44.entities.PackagingApproval.create({ ...payload, status: "Pending", requested_date: new Date().toISOString() });

export const requestStockUse = async ({ item, quantity, user, extras = {}, threshold = 0 }) => {
  const qty = num(quantity);
  if (!(qty > 0)) throw new Error("Quantity must be greater than zero.");
  if (qty > num(item.quantity)) {
    throw new Error(`Only ${fmtQty(item.quantity)} ${item.unit || ""} of ${item.item_code} in stock.`);
  }
  const approval = await createApproval({
    approval_type: "Stock Use",
    item_id: item.id,
    item_code: item.item_code || "",
    item_name: item.description || item.item_code || "",
    unit: item.unit || "",
    system_qty: num(item.quantity),
    requested_qty: qty,
    difference: 0,
    reason: extras.reason || `Issue above the ${fmtQty(threshold)} ${item.unit || ""} approval threshold`,
    batch_number: extras.batch_number || "",
    rack_location: extras.rack_location || "",
    production_order: extras.production_order || "",
    production_line: extras.production_line || "",
    remarks: extras.remarks || "",
    requested_by: actingUserName(user),
    requested_by_id: user?.id || "",
  });
  await logAudit(user, "Created", item.id, `Stock out of ${fmtQty(qty)} ${item.unit || ""} of ${item.item_code} sent for approval`);
  return approval;
};

// A stock issue that is over the threshold set in Settings goes to approvals
// instead of being deducted straight away.
export const submitStockUse = async ({ item, quantity, user, extras = {}, threshold = 0 }) => {
  const qty = num(quantity);
  if (!(qty > 0)) throw new Error("Quantity must be greater than zero.");
  if (qty > num(item.quantity)) {
    throw new Error(`Only ${fmtQty(item.quantity)} ${item.unit || ""} of ${item.item_code} in stock.`);
  }
  if (threshold > 0 && qty > threshold) {
    const approval = await requestStockUse({ item, quantity: qty, user, extras, threshold });
    return { approval };
  }
  await issueStock({ item, quantity: qty, user, extras });
  return {};
};

export const requestAdjustment = async ({ item, counted, user, reason, extras = {} }) => {
  const difference = num(counted) - num(item.quantity);
  if (difference === 0) throw new Error("The counted quantity matches the system quantity.");
  if (!String(reason || "").trim()) throw new Error("A reason is required for a stock adjustment.");
  return createApproval({
    approval_type: "Stock Adjustment",
    item_id: item.id,
    item_code: item.item_code || "",
    item_name: item.description || item.item_code || "",
    unit: item.unit || "",
    system_qty: num(item.quantity),
    requested_qty: num(counted),
    difference,
    reason: String(reason).trim(),
    batch_number: extras.batch_number || "",
    rack_location: extras.rack_location || "",
    remarks: extras.remarks || "",
    requested_by: actingUserName(user),
    requested_by_id: user?.id || "",
  });
};

// Approving applies the correction (or deducts the approved issue) and logs it.
export const decideApproval = async ({ approval, decision, comment, user }) => {
  const decided = {
    status: decision,
    decided_by: actingUserName(user),
    decided_by_id: user?.id || "",
    decided_date: new Date().toISOString(),
    decision_comment: String(comment || "").trim(),
  };
  if (decision === "Approved") {
    const item = await base44.entities.PackagingItem.get(approval.item_id);
    if (approval.approval_type === "Stock Adjustment") {
      const counted = num(approval.requested_qty);
      await logMovement(item, "Adjustment", counted - num(item.quantity), user, {
        batch_number: approval.batch_number,
        rack_location: approval.rack_location,
        remarks: approval.reason,
        source: "Stock count",
        approval_id: approval.id,
      });
      await setItemQuantity(item, counted);
    } else {
      await issueStock({
        item,
        quantity: approval.requested_qty,
        user,
        extras: {
          batch_number: approval.batch_number,
          rack_location: approval.rack_location,
          production_order: approval.production_order,
          production_line: approval.production_line,
          remarks: approval.remarks,
          source: "Approved issue",
          approval_id: approval.id,
        },
      });
    }
    await logAudit(user, "Updated", approval.item_id, `Approved stock ${approval.approval_type.toLowerCase()} for ${approval.item_code}`);
  }
  await base44.entities.PackagingApproval.update(approval.id, decided);
};

// Batch / rack balances for one item, rebuilt from its movement log.
export const batchSummary = (movements = []) => {
  const map = new Map();
  movements.forEach((m) => {
    const batch = (m.batch_number || "").trim();
    const rack = (m.rack_location || "").trim();
    const key = `${batch}|${rack}`;
    const row = map.get(key) || { key, batch_number: batch, rack_location: rack, expiry_date: "", quantity: 0 };
    if (m.expiry_date && (!row.expiry_date || m.expiry_date < row.expiry_date)) row.expiry_date = m.expiry_date;
    const qty = num(m.quantity);
    row.quantity += m.type === "Use" ? -qty : qty;
    map.set(key, row);
  });
  return [...map.values()].map((r) => ({ ...r, quantity: Math.round(r.quantity * 1000) / 1000 }));
};

export const loadItemBatches = async (itemId) => {
  const page = await base44.entities.PackagingMovement.filter({ item_id: itemId }, { sort: "created_date", limit: 500 });
  return batchSummary(page.items || []);
};

// First expired, first out: the oldest expiry date still in stock.
export const fefoBatch = (rows = []) => {
  const available = rows.filter((r) => r.batch_number && r.quantity > 0);
  const dated = available.filter((r) => r.expiry_date).sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));
  return dated[0] || available[0] || null;
};

export const MOVEMENT_CSV_COLUMNS = [
  { label: "Date", key: "movement_date" },
  { label: "Item Code", key: "item_code" },
  { label: "Item", key: "item_name" },
  { label: "Category", key: "category" },
  { label: "Type", key: "type" },
  { label: "Quantity", key: "quantity" },
  { label: "Unit", key: "unit" },
  { label: "Batch", key: "batch_number" },
  { label: "Rack", key: "rack_location" },
  { label: "Production Order", key: "production_order" },
  { label: "User", key: "user_name" },
  { label: "Remarks", key: "remarks" },
];