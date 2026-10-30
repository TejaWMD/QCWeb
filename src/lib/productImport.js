// CSV import helpers for the Product Master: column mapping, per-row validation
// and the product record each valid row turns into.
import { coerceValue } from "@/lib/csv";

export const PRODUCT_IMPORT_FIELDS = [
  { key: "product_code", label: "Product Code", type: "text", required: true, aliases: ["code", "sku", "item code"] },
  { key: "product_name", label: "Product Name", type: "text", required: true, aliases: ["name", "description"] },
  { key: "category", label: "Category", type: "text", aliases: ["product category"] },
  { key: "carton_size", label: "Units per Carton", type: "number", aliases: ["carton", "carton size", "pcs per carton"] },
  { key: "shelf_life_days", label: "Shelf Life (days)", type: "number", aliases: ["shelf life"] },
  { key: "default_machine", label: "Default Machine", type: "text", aliases: ["machine", "line", "production line"] },
  { key: "standard_batch_cartons", label: "Standard Batch (cartons)", type: "number", aliases: ["batch size", "standard batch", "batch"] },
  { key: "packaging_per_carton", label: "Packaging per Carton", type: "text", aliases: ["packaging", "packaging items"] },
  { key: "active", label: "Active", type: "boolean", aliases: ["status"] },
];

export const PRODUCT_IMPORT_REQUIRED = PRODUCT_IMPORT_FIELDS.filter((f) => f.required).map((f) => f.key);

const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const upper = (s) => (s || "").trim().toUpperCase();

export const autoMapProducts = (headers) => {
  const map = {};
  PRODUCT_IMPORT_FIELDS.forEach((f) => {
    const names = [f.key, f.label, ...(f.aliases || [])].map(norm);
    map[f.key] = headers.find((h) => names.includes(norm(h))) || "";
  });
  return map;
};

// "LBL-001:2; CART-01:1" -> [{ code, quantity }]
const parsePackaging = (raw) =>
  String(raw || "")
    .split(/[;|]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      const [code, qty] = part.split(":").map((s) => (s || "").trim());
      return { code, quantity: qty === undefined ? 1 : Number(qty) };
    });

// Validates every CSV row: required fields, number formats, duplicate product
// codes (in the file and already stored), unknown machines and packaging codes.
export function buildProductPreview({ headers, rows, mapping, products = [], machineNames = [], packagingItems = [] }) {
  const seen = new Set();
  const existing = new Set(products.map((p) => upper(p.product_code)));
  const itemByCode = new Map(packagingItems.map((i) => [upper(i.item_code), i]));

  const preview = rows.map((row, idx) => {
    const raw = {};
    PRODUCT_IMPORT_FIELDS.forEach((f) => {
      const col = mapping[f.key];
      raw[f.key] = col ? row[headers.indexOf(col)] ?? "" : "";
    });

    const values = {};
    let error = null;
    for (const f of PRODUCT_IMPORT_FIELDS) {
      if (raw[f.key] === "") continue;
      const coerced = coerceValue(f, raw[f.key]);
      if (coerced.error) { error = `${f.label}: ${coerced.error}`; break; }
      if (!coerced.skip) values[f.key] = coerced.value;
    }

    const code = upper(values.product_code);
    if (!error && !code) error = "Product code is required";
    if (!error && !String(values.product_name || "").trim()) error = "Product name is required";

    if (!error && (existing.has(code) || seen.has(code))) {
      error = `Product code ${code} already exists`;
    }
    if (code) seen.add(code);

    if (!error && values.default_machine) {
      const known = machineNames.some((m) => upper(m) === upper(values.default_machine));
      if (machineNames.length && !known) error = `Machine "${values.default_machine}" is not on the Machines list`;
    }

    const packaging = [];
    if (!error && raw.packaging_per_carton) {
      for (const line of parsePackaging(raw.packaging_per_carton)) {
        const item = itemByCode.get(upper(line.code));
        if (!item) { error = `Packaging item "${line.code}" not found in Packaging Stock`; break; }
        if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
          error = `Packaging quantity for "${line.code}" must be greater than zero`;
          break;
        }
        packaging.push({
          item_id: item.id,
          item_code: item.item_code,
          item_name: item.description || item.item_code,
          unit: item.unit || "",
          quantity: line.quantity,
        });
      }
    }

    const record = error ? null : {
      product_code: code,
      product_name: String(values.product_name).trim(),
      category: values.category || "",
      carton_size: values.carton_size ?? 0,
      shelf_life_days: values.shelf_life_days ?? 0,
      default_machine: values.default_machine || "",
      standard_batch_cartons: values.standard_batch_cartons ?? 0,
      packaging_per_carton: packaging,
      active: values.active === undefined ? true : values.active,
    };

    return {
      row: idx + 2,
      code: code || "—",
      name: values.product_name || "—",
      category: values.category || "",
      carton_size: values.carton_size ?? "",
      shelf_life_days: values.shelf_life_days ?? "",
      machine: values.default_machine || "",
      packaging: packaging.length,
      error,
      record,
    };
  });

  const ready = preview.filter((r) => !r.error);
  return { preview, ready, errorCount: preview.length - ready.length };
}