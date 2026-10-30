// Shared helpers for the Warehouse Goods Tracker: date stamps, the 24-hour edit
// window, duplicate detection and CSV export.
import { isAdminUser } from "@/lib/permissions";

export const SETTINGS_KEY = "warehouse";
export const DEFAULT_UNITS = ["pcs", "kg", "g", "L", "carton", "pallet", "bag", "roll", "box"];
export const ITEM_CATEGORIES = ["Raw Material", "Packaging", "Finished Goods", "Spare Part", "Consumable", "Other"];
export const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export const todayStr = (d = new Date()) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const eventStamp = (d = new Date()) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${todayStr(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// Admins and Warehouse Supervisors can edit any entry at any time.
export const isWarehouseSupervisor = (user) =>
  isAdminUser(user) || user?.app_role === "warehouse_supervisor";

// Everyone else may edit only what they keyed in, and only within 24 hours.
export const canEditReceipt = (user, record) => {
  if (!user || !record) return false;
  if (isWarehouseSupervisor(user)) return true;
  const mine = record.received_by_id === user.id || record.created_by_id === user.id;
  if (!mine) return false;
  const created = new Date(record.created_date || 0).getTime();
  return Number.isFinite(created) && created > 0 && Date.now() - created < EDIT_WINDOW_MS;
};

export const newGroupId = () => `RCP-${Date.now().toString(36).toUpperCase()}`;

// Lines sharing an item code and batch number on the same day are duplicates.
export const duplicateKey = (line) =>
  `${(line.item_code || "").trim().toLowerCase()}|${(line.batch_number || "").trim().toLowerCase()}`;

export const downloadCsv = (filename, columns, rows) => {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [columns.map((c) => esc(c.label)).join(",")];
  rows.forEach((row) => {
    lines.push(columns.map((c) => esc(typeof c.value === "function" ? c.value(row) : row[c.key])).join(","));
  });
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};