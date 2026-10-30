// Shared logic for batch labels: layout definitions, expiry calculation, the QR
// code and barcode images, print CSS, duplicate protection and the audit trail.
import { base44 } from "@/api/base44Client";
import { actingUserName, isAdminUser } from "@/lib/permissions";
import { eventStamp } from "@/lib/warehouse";
import { num } from "@/lib/planning";

export const LABEL_SETTINGS_KEY = "labels";
export const ECC_LEVELS = ["L", "M", "Q", "H"];
export const CUSTOM_LAYOUT_ID = "custom";

// The layouts offered as buttons. Width, height and QR size are in millimetres,
// the font size in points. Admin can change any of these in Label Settings.
export const DEFAULT_LAYOUTS = [
  { id: "default", name: "Default", width_mm: 100, height_mm: 60, font_size: 8, qr_mm: 18, qr_ecc: "M" },
  { id: "tall_default", name: "Tall Default", width_mm: 80, height_mm: 100, font_size: 8, qr_mm: 20, qr_ecc: "M" },
  { id: "70x50", name: "70 x 50 mm", width_mm: 70, height_mm: 50, font_size: 7, qr_mm: 14, qr_ecc: "M" },
  { id: "50x80", name: "50 x 80 mm", width_mm: 50, height_mm: 80, font_size: 6.5, qr_mm: 13, qr_ecc: "M" },
  { id: "premium_default", name: "Premium Default", width_mm: 100, height_mm: 70, font_size: 9, qr_mm: 22, qr_ecc: "Q" },
  { id: "qr13_m", name: "QR 13 mm ECC M", width_mm: 70, height_mm: 50, font_size: 7, qr_mm: 13, qr_ecc: "M" },
  { id: "qr13_l", name: "QR 13 mm ECC L", width_mm: 70, height_mm: 50, font_size: 7, qr_mm: 13, qr_ecc: "L" },
  { id: "70x50_qr24", name: "70 x 50 mm 24 mm QR", width_mm: 70, height_mm: 50, font_size: 6.5, qr_mm: 24, qr_ecc: "M" },
  { id: CUSTOM_LAYOUT_ID, name: "Custom Manual", width_mm: 70, height_mm: 50, font_size: 7, qr_mm: 14, qr_ecc: "M" },
];

// Changing the label layouts is an Admin job.
export const canEditLabelSettings = (user) => isAdminUser(user);

const cleanLayout = (layout) => ({
  id: String(layout.id || ""),
  name: String(layout.name || layout.id || "Layout"),
  width_mm: Math.max(20, num(layout.width_mm) || 70),
  height_mm: Math.max(20, num(layout.height_mm) || 50),
  font_size: Math.max(4, num(layout.font_size) || 7),
  qr_mm: Math.max(5, num(layout.qr_mm) || 14),
  qr_ecc: ECC_LEVELS.includes(layout.qr_ecc) ? layout.qr_ecc : "M",
});

export const loadLabelSettings = async () => {
  const page = await base44.entities.LabelSettings.filter({ key: LABEL_SETTINGS_KEY }, { limit: 1 });
  const doc = (page.items || [])[0] || {};
  const layouts = Array.isArray(doc.layouts) && doc.layouts.length ? doc.layouts.map(cleanLayout) : DEFAULT_LAYOUTS;
  const defaultId = layouts.some((l) => l.id === doc.default_layout_id) ? doc.default_layout_id : layouts[0].id;
  return { id: doc.id || "", layouts, default_layout_id: defaultId };
};

export const saveLabelSettings = async ({ settings, user }) => {
  const layouts = (settings.layouts || DEFAULT_LAYOUTS).map(cleanLayout);
  const payload = {
    key: LABEL_SETTINGS_KEY,
    layouts,
    default_layout_id: layouts.some((l) => l.id === settings.default_layout_id) ? settings.default_layout_id : layouts[0].id,
    updated_by: actingUserName(user),
  };
  if (settings.id) return base44.entities.LabelSettings.update(settings.id, payload);
  return base44.entities.LabelSettings.create(payload);
};

// The layout the preview and the print sheet use: the chosen one, falling back
// to the plant default.
export const resolveLayout = (settings, layoutId) => {
  const list = settings?.layouts?.length ? settings.layouts : DEFAULT_LAYOUTS;
  return list.find((l) => l.id === layoutId) || list.find((l) => l.id === settings?.default_layout_id) || list[0];
};

// The layout a batch was printed with, frozen so a reprint looks the same even
// after the settings change.
export const layoutOfRecord = (record) => cleanLayout({
  id: record?.label_layout || "custom",
  name: record?.label_layout_name || "Saved layout",
  width_mm: record?.label_width_mm,
  height_mm: record?.label_height_mm,
  font_size: record?.label_font_size,
  qr_mm: record?.qr_mm,
  qr_ecc: record?.qr_ecc,
});

export const saveDefaultLayoutForProduct = async (productId, layoutId) =>
  base44.entities.Product.update(productId, { default_label_layout: layoutId || "" });

// ---- dates -----------------------------------------------------------------
const pad2 = (n) => String(n).padStart(2, "0");

export const addDays = (dateStr, days) => {
  const [y, m, d] = (dateStr || "").split("-").map(Number);
  if (!y || !m || !d) return "";
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + Math.round(num(days)));
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

export const expiryFor = (productionDate, shelfLifeDays) =>
  num(shelfLifeDays) > 0 ? addDays(productionDate, num(shelfLifeDays)) : "";

// Labels show plant dates as DD/MM/YYYY.
export const fmtDay = (dateStr) => {
  const [y, m, d] = (dateStr || "").split("-");
  return y && m && d ? `${d}/${m}/${y}` : "—";
};

// ---- codes -----------------------------------------------------------------
export const traceUrlFor = (batchNumber) =>
  `${window.location.origin}/traceability?batch=${encodeURIComponent(batchNumber || "")}`;

export const qrImageUrl = (payload, ecc = "M", sizePx = 420) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${sizePx}x${sizePx}&ecc=${ECC_LEVELS.includes(ecc) ? ecc : "M"}&margin=0&data=${encodeURIComponent(payload || "")}`;

export const barcodeImageUrl = (code) =>
  `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(code || "")}&scale=3&height=12&includetext=false&paddingwidth=0&paddingheight=0&backgroundcolor=ffffff`;

// Exact page size, no margins, one page per label copy.
export const printCss = (layout) => `
@page { size: ${layout.width_mm}mm ${layout.height_mm}mm; margin: 0; }
@media print {
  html, body { margin: 0 !important; padding: 0 !important; background: #ffffff !important; }
  body * { visibility: hidden !important; }
  #label-print-root, #label-print-root * { visibility: visible !important; }
  #label-print-root { position: absolute !important; left: 0 !important; top: 0 !important; margin: 0 !important; padding: 0 !important; }
  #label-print-root .label-page { break-after: page; page-break-after: always; break-inside: avoid; }
  #label-print-root .label-page:last-child { break-after: auto; page-break-after: auto; }
}
`;

// ---- records ---------------------------------------------------------------
export const loadBatchRecords = async () => {
  const rows = await base44.entities.BatchRecord.list("-created_date", 2000);
  return Array.isArray(rows) ? rows : [];
};

export const normalizeBatch = (value) => (value || "").trim().toUpperCase();

// A batch number may only be used once for the same product.
export const duplicateOf = (records, productId, batchNumber, ignoreId) => {
  const batch = normalizeBatch(batchNumber);
  if (!batch) return null;
  return (records || []).find((r) => r.id !== ignoreId && r.product_id === productId && normalizeBatch(r.batch_number) === batch) || null;
};

// Batch numbers waiting on the production schedule, with the order they belong to.
export const scheduledBatches = (orders = [], recordedIds = []) => {
  const done = new Set(recordedIds);
  return (orders || [])
    .filter((o) => !o.deleted && o.status !== "Cancelled")
    .flatMap((o) => (o.batch_codes || []).map((code) => ({ code, order: o })))
    .map((entry) => ({ ...entry, recorded: done.has(`${entry.order.product_id}|${normalizeBatch(entry.code)}`) }))
    .sort((a, b) => (a.code || "").localeCompare(b.code || ""));
};

export const logLabelAudit = async ({ user, action, recordId, details }) => {
  try {
    await base44.entities.AuditLog.create({
      event_time: new Date().toISOString(),
      event_stamp: eventStamp(),
      user_name: actingUserName(user),
      module: "Batch Labels",
      action,
      record_id: recordId || "",
      details,
      old_value: "",
      new_value: "",
    });
  } catch {
    // The batch stands even if the audit entry cannot be written.
  }
};