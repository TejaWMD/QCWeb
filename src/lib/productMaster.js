// Shared logic for the Product Master datasheet: master lists, calculations,
// barcode / customer cleaning, completeness rules and field-level audit.
import { base44 } from "@/api/base44Client";
import { actingUserName, appRoleOf, isAdminUser } from "@/lib/permissions";
import { eventStamp } from "@/lib/warehouse";

export const PRODUCT_SETTINGS_KEY = "product_master";
export const SIZE_UNITS = ["G", "KG", "ML", "L"];
export const PRODUCT_STATUSES = ["Active", "Pending", "Inactive"];
export const DEFAULT_CUSTOMER = "GENERAL";

export const FIELD_LABELS = {
  product_code: "Item Code",
  product_name: "Carton Description",
  brand: "Brand",
  recipe_name: "Recipe Name",
  cooking_time_hr: "Cooking Time (hr)",
  batch_output_kg: "Batch Output (kg)",
  carton_size: "Pcs per Carton",
  net_weight_kg: "Net Weight per Pc (kg)",
  net_filling_kg: "Net Filling (kg/Carton)",
  cartons_per_batch: "Cartons per Batch",
  line_type: "Line Type",
  default_machine: "Default Machine",
  batch_prefix: "Batch Code",
  shelf_life_months: "Shelf Life (Months)",
  shelf_life_days: "Shelf Life (Days)",
  barcode: "SKU Barcode",
  carton_barcode: "Carton Barcode",
  customer: "Customer",
  status: "Status",
  hidden: "Hidden",
  remarks: "Remarks",
  notes: "Notes",
  target_net_weight_g: "Net Weight (g)",
  channels: "Customer",
};

// Who may change what on the master (import and bulk edits stay with Admin).
export const canManageProducts = (user) => isAdminUser(user);
export const canEditProductSensitive = (user) =>
  isAdminUser(user) || appRoleOf(user) === "qa_officer";
export const SENSITIVE_FIELDS = ["shelf_life_months", "shelf_life_days", "barcode", "carton_barcode"];
export const canEditProductField = (user, field) =>
  isAdminUser(user) || (appRoleOf(user) === "qa_officer" && SENSITIVE_FIELDS.includes(field));

export const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
export const round1 = (v) => Math.round(num(v) * 10) / 10;
const upper = (v) => (v || "").toString().trim().toUpperCase();
const clean = (v) => (v ?? "").toString().trim();

// ---- calculations (always done by the system, never typed in) ---------------
export const derivedFields = ({ carton_size, net_weight_kg, batch_output_kg, shelf_life_months, cooking_time_hr }) => {
  // Net filling keeps its full value (24 x 0.227 = 5.448); only cartons per
  // batch is stored to one decimal, as the datasheet requires.
  const netFilling = Math.round(num(carton_size) * num(net_weight_kg) * 1000) / 1000;
  const cartonsPerBatch = netFilling > 0 ? round1(num(batch_output_kg) / netFilling) : 0;
  const months = num(shelf_life_months);
  return {
    net_filling_kg: netFilling,
    cartons_per_batch: cartonsPerBatch,
    standard_batch_cartons: Math.round(cartonsPerBatch),
    target_net_weight_g: Math.round(num(net_weight_kg) * 1000 * 1000) / 1000,
    shelf_life_days: months ? months * 30 : 0,
    cooking_time_min: Math.round(num(cooking_time_hr) * 60),
  };
};

// ---- cleaning ---------------------------------------------------------------
// Barcodes lose a leading "*" and are stored as text.
export const cleanBarcode = (value) => clean(value).replace(/^\*+/, "").trim();
// Matching ignores "*" and one leading zero.
export const barcodeKey = (value) => cleanBarcode(value).replace(/^0/, "");
export const cleanCustomer = (value) => upper(value) || DEFAULT_CUSTOMER;
export const normalizeFileStatus = (value) => (upper(value) === "ACTIVE" ? "Active" : "Inactive");

import { productService } from "@/services/productService";

// ---- master lists -----------------------------------------------------------
export const loadProductSettings = async () => {
  return await productService.getProductSettings();
};

export const saveProductSettings = async ({ settings, user }) => {
  await productService.saveProductSettings({
    ...settings,
    updated_by: actingUserName(user),
  });
};

export const mergeNames = (list = [], names = []) => {
  const seen = new Set(list.map((row) => upper(row.name)));
  const next = [...list];
  names.forEach((name) => {
    const value = clean(name);
    if (!value || seen.has(upper(value))) return;
    seen.add(upper(value));
    next.push({ name: value, status: "Active" });
  });
  return next;
};

export const activeNames = (list = []) =>
  list.filter((row) => (row.status || "Active") === "Active").map((row) => row.name);

// ---- legacy helpers kept so older screens keep working ----------------------
export const parseSize = (value, unit) => {
  const rawValue = clean(value);
  const rawUnit = clean(unit);
  const match = `${rawValue} ${rawUnit}`.match(/(\d+(?:[.,]\d+)?)\s*([A-Za-z]*)/);
  const parsedValue = match ? Number(match[1].replace(",", ".")) : 0;
  const word = upper(rawUnit || (match ? match[2] : ""));
  const map = { G: "G", GM: "G", GR: "G", GRAM: "G", GRAMS: "G", KG: "KG", KGS: "KG", KILO: "KG", ML: "ML", MLS: "ML", L: "L", LTR: "L", LT: "L", LITRE: "L", LITER: "L" };
  return { value: Number.isFinite(parsedValue) ? parsedValue : 0, unit: map[word] || (SIZE_UNITS.includes(word) ? word : "") };
};

export const sizeLabel = (product) => {
  const value = num(product?.size_value);
  const unit = product?.size_unit || "";
  return value ? `${value} ${unit}`.trim() : unit || "";
};

export const productKey = (product) => upper(product?.product_code);
export const itemCodeKey = (value) => upper(value);

export const productStatus = (product) =>
  PRODUCT_STATUSES.includes(product?.status) ? product.status : product?.active === false ? "Inactive" : "Active";

export const statusPayload = (status) => ({
  status,
  active: status === "Active",
});

export const normalizeStatus = (value) => {
  const word = upper(value);
  if (!word) return "";
  if (["PENDING", "DRAFT", "HOLD", "ON HOLD"].includes(word)) return "Pending";
  if (["INACTIVE", "IN ACTIVE", "DISCONTINUED", "OBSOLETE", "NO", "FALSE", "0"].includes(word)) return "Inactive";
  if (["ACTIVE", "YES", "TRUE", "1"].includes(word)) return "Active";
  return "";
};

export const barcodeCheckDigit = (digits) => {
  let sum = 0;
  digits.split("").reverse().forEach((char, index) => {
    const digit = Number(char);
    sum += index % 2 === 0 ? digit * 3 : digit;
  });
  return (10 - (sum % 10)) % 10;
};

// 8 (EAN-8), 12 (UPC-A) or 13 (EAN-13) digits with a valid check digit.
export const checkBarcode = (value) => {
  const code = cleanBarcode(value);
  if (!code) return { ok: false, reason: "empty" };
  if (!/^\d+$/.test(code)) return { ok: false, reason: "not digits" };
  if (![8, 12, 13].includes(code.length)) return { ok: false, reason: `length ${code.length}` };
  const body = code.slice(0, -1);
  if (barcodeCheckDigit(body) !== Number(code.slice(-1))) return { ok: false, reason: "wrong check digit" };
  return { ok: true, reason: "" };
};

export const cartonUnitsFromDescription = (description) => {
  const match = clean(description).match(/(?:x|×|\*)\s*(\d{1,4})\s*$/i);
  return match ? Number(match[1]) : 0;
};

// ---- completeness -----------------------------------------------------------
const missing = (test, label) => (test ? null : label);

export const productCompleteness = (product) => {
  const labels = [missing(!!clean(product?.batch_prefix), "Batch code"), missing(num(product?.shelf_life_days) > 0, "Shelf life")].filter(Boolean);
  const scheduling = [missing(num(product?.batch_output_kg) > 0, "Batch output"), missing(num(product?.cartons_per_batch) > 0, "Cartons per batch")].filter(Boolean);
  const yieldGaps = [missing(num(product?.net_weight_kg) > 0, "Net weight"), missing(num(product?.net_filling_kg) > 0, "Net filling")].filter(Boolean);
  const traceGaps = [missing(!!clean(product?.barcode), "SKU barcode")].filter(Boolean);
  const core = [...labels, ...scheduling].filter(Boolean);
  const met = [labels, scheduling, yieldGaps, traceGaps].filter((gaps) => gaps.length === 0).length;
  return {
    labels: { ok: labels.length === 0, missing: labels },
    scheduling: { ok: scheduling.length === 0, missing: scheduling },
    yieldLoss: { ok: yieldGaps.length === 0, missing: yieldGaps },
    traceability: { ok: traceGaps.length === 0, missing: traceGaps },
    core,
    incomplete: core.length > 0,
    percent: Math.round((met / 4) * 100),
  };
};

export const labelBlock = (product) => {
  const status = productStatus(product);
  if (status === "Inactive") return "Inactive product";
  if (status === "Pending") return "Pending — an Admin must set it to Active";
  if (product?.deleted) return "Deleted product";
  const gaps = productCompleteness(product).labels.missing;
  return gaps.length ? `Incomplete — missing ${gaps.join(" and ").toLowerCase()}` : null;
};

export const scheduleBlock = (product) => {
  const status = productStatus(product);
  if (status === "Inactive") return "Inactive product";
  if (status === "Pending") return "Pending — an Admin must set it to Active";
  if (product?.deleted) return "Deleted product";
  const gaps = productCompleteness(product).scheduling.missing;
  return gaps.length ? `Incomplete — missing ${gaps.join(" and ").toLowerCase()}` : null;
};

export const listedProducts = (products = []) => products.filter((p) => !p.hidden && !p.deleted);

export const completenessSummary = (products = []) => {
  const live = listedProducts(products);
  if (!live.length) return { total: 0, complete: 0, percent: 0, incomplete: 0 };
  const complete = live.filter((p) => !productCompleteness(p).incomplete).length;
  return {
    total: live.length,
    complete,
    incomplete: live.length - complete,
    percent: Math.round((complete / live.length) * 100),
  };
};

// ---- audit ------------------------------------------------------------------
export const logProductAudit = async ({ user, action, recordId, details, oldValue = "", newValue = "" }) => {
  try {
    await base44.entities.AuditLog.create({
      event_time: new Date().toISOString(),
      event_stamp: eventStamp(),
      user_name: actingUserName(user),
      module: "Product Master",
      action,
      record_id: recordId || "",
      details,
      old_value: oldValue,
      new_value: newValue,
    });
  } catch {
    // The saved product stands even if the audit entry cannot be written.
  }
};

const display = (value) =>
  Array.isArray(value) ? value.join(", ") : value === true ? "Yes" : value === false ? "No" : value === undefined || value === null ? "" : String(value);

const sameValue = (a, b) => display(a) === display(b);

export const auditFieldChanges = async ({ user, recordId, before = {}, after = {}, fields }) => {
  const keys = fields || Object.keys(after);
  const changed = keys.filter((key) => !sameValue(before[key], after[key]));
  for (const key of changed) {
    await logProductAudit({
      user,
      action: "Updated",
      recordId,
      details: `${FIELD_LABELS[key] || key} changed`,
      oldValue: display(before[key]),
      newValue: display(after[key]),
    });
  }
  return changed;
};

// ---- payload ----------------------------------------------------------------
// Builds the stored product from a datasheet form; the calculated fields are
// always derived here so nobody can type them in.
export const productPayload = (form) => {
  const status = PRODUCT_STATUSES.includes(form.status) ? form.status : "Active";
  const derived = derivedFields({
    carton_size: form.carton_size,
    net_weight_kg: form.net_weight_kg,
    batch_output_kg: form.batch_output_kg,
    shelf_life_months: form.shelf_life_months,
    cooking_time_hr: form.cooking_time_hr,
  });
  const customer = cleanCustomer(form.customer);
  const code = clean(form.product_code).toUpperCase();
  const description = clean(form.product_name);
  const cartonBarcode = cleanBarcode(form.carton_barcode);
  return {
    product_code: code,
    product_name: description,
    product_name_original: form.product_name_original || description,
    brand: clean(form.brand),
    recipe_name: clean(form.recipe_name),
    recipe_id: form.recipe_id || "",
    cooking_time_hr: num(form.cooking_time_hr),
    cooking_time_min: derived.cooking_time_min,
    batch_output_kg: num(form.batch_output_kg),
    carton_size: num(form.carton_size),
    net_weight_kg: num(form.net_weight_kg),
    target_net_weight_g: derived.target_net_weight_g,
    net_filling_kg: derived.net_filling_kg,
    cartons_per_batch: derived.cartons_per_batch,
    standard_batch_cartons: derived.standard_batch_cartons,
    line_type: upper(form.line_type),
    default_machine: clean(form.default_machine),
    batch_prefix: upper(form.batch_prefix),
    shelf_life_months: num(form.shelf_life_months),
    shelf_life_days: derived.shelf_life_days,
    barcode: cleanBarcode(form.barcode),
    carton_barcode: cartonBarcode,
    customer,
    channels: [customer],
    ...statusPayload(status),
    hidden: !!form.hidden,
    size_value: num(form.size_value),
    size_unit: form.size_unit || "",
    packing_time_min: num(form.packing_time_min),
    lower_tolerance_g: num(form.lower_tolerance_g),
    cost_per_kg: num(form.cost_per_kg),
    remarks: form.remarks || "",
    notes: form.notes || "",
    carton_skus: code || description
      ? [{ description, item_code: code, barcode: cartonBarcode, units_per_carton: num(form.carton_size) }]
      : [],
    custom_fields: (form.custom_fields || []).filter((row) => row.label),
    packaging_per_carton: form.packaging_per_carton || [],
    default_label_layout: form.default_label_layout || "",
  };
};

export const blankProduct = () => ({
  product_code: "",
  product_name: "",
  product_name_original: "",
  brand: "",
  recipe_name: "",
  recipe_id: "",
  cooking_time_hr: "",
  batch_output_kg: "",
  carton_size: "",
  net_weight_kg: "",
  line_type: "",
  default_machine: "",
  batch_prefix: "",
  shelf_life_months: "",
  barcode: "",
  carton_barcode: "",
  customer: DEFAULT_CUSTOMER,
  status: "Active",
  hidden: false,
  size_value: "",
  size_unit: "",
  packing_time_min: "",
  lower_tolerance_g: "",
  cost_per_kg: "",
  remarks: "",
  notes: "",
  custom_fields: [],
  packaging_per_carton: [],
  default_label_layout: "",
});

// A stored product shaped for the datasheet form (legacy values filled in).
export const productToForm = (product = {}) => ({
  ...blankProduct(),
  ...product,
  customer: product.customer || (product.channels || [])[0] || DEFAULT_CUSTOMER,
  net_weight_kg: num(product.net_weight_kg) || (num(product.target_net_weight_g) ? num(product.target_net_weight_g) / 1000 : ""),
  cooking_time_hr: num(product.cooking_time_hr) || (num(product.cooking_time_min) ? num(product.cooking_time_min) / 60 : ""),
});

// ---- CSV out ----------------------------------------------------------------
export const PRODUCT_CSV_HEADERS = [
  "Item Description/ Carton Description", "Item Code", "Recipe", "Cooking Time (hr)", "Batch Output (kg)",
  "Pcs per carton", "Net Weight (kg)", "Net Filling (kg/Carton)", "Carton/Batch", "Brand", "Line Code",
  "Batch Code", "Shelf Life (Months)", "NEW SKU Barcode", "NEW Carton Barcode", "Customer", "Status (Active/ na)",
];

export const downloadCsv = (filename, headers, rows) => {
  const escape = (value) => {
    const text = value === undefined || value === null ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const body = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const TEMPLATE_HEADERS = PRODUCT_CSV_HEADERS;

export const TEMPLATE_EXAMPLE = [
  "EXAMPLE SAUCE 500G X 12", "EX500GX12", "EXAMPLE SAUCE", "1.5", "600", "12", "0.5", "6", "100",
  "EXAMPLE", "SAUCE", "EXS", "12", "9556123456789", "9556123456796", "GENERAL", "Active",
];

export const downloadBlankTemplate = () =>
  downloadCsv("product-master-template.csv", TEMPLATE_HEADERS, [TEMPLATE_EXAMPLE]);

// One row per product in the datasheet column order.
export const productExportRow = (p) => [
  p.product_name || "", p.product_code || "", p.recipe_name || "", num(p.cooking_time_hr) || "",
  num(p.batch_output_kg) || "", num(p.carton_size) || "", num(p.net_weight_kg) || "",
  num(p.net_filling_kg) || "", num(p.cartons_per_batch) || "", p.brand || "", p.line_type || "",
  p.batch_prefix || "", num(p.shelf_life_months) || "", p.barcode || "", p.carton_barcode || "",
  p.customer || "", productStatus(p),
];