// Product Master import: reads CSV/Excel sheets, guesses the column mapping,
// cleans every row the way the datasheet spec requires, checks the calculated
// columns and upserts by Item Code. Nothing is ever deleted by an import.
import * as XLSX from "xlsx";
import { productService } from "@/services/productService";
import { base44 } from "@/api/base44Client";
import { actingUserName } from "@/lib/permissions";
import { eventStamp } from "@/lib/warehouse";
import {
  barcodeKey, checkBarcode, cleanBarcode, cleanCustomer, derivedFields, mergeNames, normalizeFileStatus,
  num, productCompleteness, productStatus, saveProductSettings,
} from "@/lib/productMaster";
import { ensureRecipeLinks } from "@/lib/recipeMaster";

const norm = (value) => (value || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");
const text = (value) => (value ?? "").toString().trim();
const upper = (value) => text(value).toUpperCase();
const CALC_TOLERANCE = 0.5;

// Every column the file can be mapped to.
export const MAPPING_TARGETS = [
  { key: "product_name", label: "Carton Description", required: true },
  { key: "product_code", label: "Item Code", required: true },
  { key: "recipe_name", label: "Recipe Name" },
  { key: "cooking_time_hr", label: "Cooking Time (hr)" },
  { key: "batch_output_kg", label: "Batch Output (kg)" },
  { key: "carton_size", label: "Pcs per Carton" },
  { key: "net_weight_kg", label: "Net Weight per Pc (kg)" },
  { key: "net_filling_kg", label: "Net Filling (kg/Carton) — checked" },
  { key: "cartons_per_batch", label: "Cartons per Batch — checked" },
  { key: "brand", label: "Brand" },
  { key: "line_type", label: "Line Type" },
  { key: "batch_prefix", label: "Batch Code" },
  { key: "shelf_life_months", label: "Shelf Life (Months)" },
  { key: "barcode", label: "SKU Barcode" },
  { key: "carton_barcode", label: "Carton Barcode" },
  { key: "customer", label: "Customer" },
  { key: "status", label: "Status (Active / Inactive)" },
  { key: "remarks", label: "Remarks" },
  { key: "default_machine", label: "Default Machine" },
];

export const CUSTOM_TARGET = "custom";
export const REQUIRED_TARGETS = MAPPING_TARGETS.filter((target) => target.required).map((target) => target.key);

const ALIASES = {
  product_name: ["item description/ carton description", "item description", "carton description", "product name", "product description", "description", "item name"],
  product_code: ["item code", "product code", "code", "sku", "item"],
  recipe_name: ["recipe", "recipe name"],
  cooking_time_hr: ["cooking time (hr)", "cooking time (hours)", "cooking time", "cook time", "process time"],
  batch_output_kg: ["batch output (kg)", "batch output", "output per batch"],
  carton_size: ["pcs per carton", "pieces per carton", "units per carton", "pcs/ctn"],
  net_weight_kg: ["net weight (kg)", "net weight", "nett weight (kg)", "net wt"],
  net_filling_kg: ["net filling (kg/carton)", "net filling", "filling (kg/carton)"],
  cartons_per_batch: ["carton/batch", "cartons per batch", "carton per batch", "ctn/batch"],
  brand: ["brand", "brand name"],
  line_type: ["packaging line code", "line code", "line type", "line", "packaging line"],
  batch_prefix: ["batch code", "batch prefix", "prefix"],
  shelf_life_months: ["shelf life (months)", "shelf life (month)", "shelf life"],
  barcode: ["new sku barcode", "sku barcode", "unit barcode", "barcode", "barcode (sku)", "ean", "gtin"],
  carton_barcode: ["new carton barcode", "carton barcode", "outer barcode", "carton ean"],
  customer: ["customer", "customer name", "channel", "customer/channel"],
  status: ["status (active/ na)", "status (active/na)", "status", "product status", "active/na"],
  remarks: ["remarks", "remark", "notes", "note", "comment"],
  default_machine: ["machine (tank)", "default machine", "machine", "tank", "cooking tank", "mixing tank"],
};

const ALL_ALIASES = new Set(Object.values(ALIASES).flat().map(norm));

// ---- reading ----------------------------------------------------------------
export const readSheet = async (file) => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", raw: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: "" });
  return raw.map((row) => row.map((cell) => text(cell)));
};

const looksLikeHeader = (row) => {
  const cells = row.filter(Boolean);
  if (cells.length < 2) return false;
  const hits = cells.filter((cell) => ALL_ALIASES.has(norm(cell))).length;
  return hits >= 2;
};

export const detectHeaderRow = (rows) => {
  for (let i = 0; i < Math.min(rows.length, 25); i += 1) {
    if (looksLikeHeader(rows[i])) return i;
  }
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i].filter(Boolean).length >= 2) return i;
  }
  return 0;
};

export const buildTable = (rows) => {
  const headerIndex = detectHeaderRow(rows);
  const headerRow = rows[headerIndex] || [];
  const width = Math.max(headerRow.length, ...rows.slice(headerIndex + 1).map((r) => r.length), 0);
  const columns = Array.from({ length: width }, (_, index) => ({
    index,
    label: text(headerRow[index]) || `Column ${index + 1}`,
  }));
  const seen = {};
  columns.forEach((column) => {
    const base = column.label;
    seen[base] = (seen[base] || 0) + 1;
    if (seen[base] > 1) column.label = `${base} (${seen[base]})`;
  });
  const dataRows = rows
    .slice(headerIndex + 1)
    .map((row, index) => ({ row, number: headerIndex + 2 + index }))
    .filter((entry) => entry.row.some((cell) => text(cell) !== ""));
  return { headerIndex, columns, rows: dataRows };
};

export const mappingSignature = (columns) => columns.map((c) => norm(c.label)).join("|");

// ---- mapping ----------------------------------------------------------------
const scoreColumn = (header) => {
  const name = norm(header);
  if (!name) return null;
  const exact = Object.entries(ALIASES).find(([, list]) => list.some((alias) => norm(alias) === name));
  if (exact) return exact[0];
  const partial = Object.entries(ALIASES).find(([, list]) => list.some((alias) => name.startsWith(norm(alias))));
  return partial ? partial[0] : null;
};

export const autoMapColumns = (columns) => {
  const mapping = {};
  const used = new Set();
  columns.forEach((column) => {
    const guess = scoreColumn(column.label);
    if (!guess || used.has(guess)) return;
    mapping[column.index] = guess;
    used.add(guess);
  });
  return mapping;
};

export const mappedTargets = (mapping = {}) => new Set(Object.values(mapping));

// ---- preview ----------------------------------------------------------------
const rowValues = (columns, row, mapping) => {
  const values = {};
  const custom = {};
  columns.forEach((column) => {
    const target = mapping[column.index];
    if (!target) return;
    const cell = text(row[column.index]);
    if (cell === "") return;
    if (target === CUSTOM_TARGET) { custom[column.label] = cell; return; }
    values[target] = cell;
  });
  if (Object.keys(custom).length) values.custom = custom;
  return values;
};

const baseStatus = (product) => productStatus(product);

export function buildImportPreview({ columns, rows, mapping, products = [], recipes = [] }) {
  const byCode = new Map(products.filter((p) => p.product_code).map((p) => [upper(p.product_code), p]));
  const takenBarcodes = new Map();
  products.forEach((product) => {
    [product.barcode, product.carton_barcode, ...(product.carton_skus || []).map((row) => row.barcode)]
      .forEach((code) => {
        const key = barcodeKey(code);
        if (key && !takenBarcodes.has(key)) takenBarcodes.set(key, `${product.product_code} · ${product.product_name}`);
      });
  });
  const existingRecipeNames = new Set(recipes.map((row) => upper(row.recipe_name)).filter(Boolean));
  const fileCodes = new Map();
  const fileBarcodes = new Map();
  const entries = [];

  rows.forEach((entry) => {
    const values = rowValues(columns, entry.row, mapping);
    const code = upper(values.product_code);
    const description = text(values.product_name);
    const existing = byCode.get(code) || null;
    const base = existing || {};
    const errors = [];
    const warnings = [];

    if (!code) errors.push("Item Code is missing");
    if (!description) errors.push("Carton Description is missing");
    if (code && fileCodes.has(code)) errors.push(`Item Code repeated in the file (row ${fileCodes.get(code)})`);
    if (code && !fileCodes.has(code)) fileCodes.set(code, entry.number);

    const pcs = values.carton_size !== undefined ? num(values.carton_size) : num(base.carton_size);
    const netWeightKg = values.net_weight_kg !== undefined
      ? num(values.net_weight_kg)
      : num(base.net_weight_kg) || num(base.target_net_weight_g) / 1000;
    const batchOutput = values.batch_output_kg !== undefined ? num(values.batch_output_kg) : num(base.batch_output_kg);
    const months = values.shelf_life_months !== undefined ? num(values.shelf_life_months) : num(base.shelf_life_months);
    const cookingHr = values.cooking_time_hr !== undefined
      ? num(values.cooking_time_hr)
      : num(base.cooking_time_hr) || num(base.cooking_time_min) / 60;
    const derived = derivedFields({ carton_size: pcs, net_weight_kg: netWeightKg, batch_output_kg: batchOutput, shelf_life_months: months, cooking_time_hr: cookingHr });

    // The file's calculated columns are only a check - the system value is stored.
    if (values.net_filling_kg !== undefined && Math.abs(num(values.net_filling_kg) - derived.net_filling_kg) > CALC_TOLERANCE) {
      warnings.push(`Net filling in file ${num(values.net_filling_kg)} vs calculated ${derived.net_filling_kg} — calculated value used`);
    }
    if (values.cartons_per_batch !== undefined && Math.abs(num(values.cartons_per_batch) - derived.cartons_per_batch) > CALC_TOLERANCE) {
      warnings.push(`Cartons per batch in file ${num(values.cartons_per_batch)} vs calculated ${derived.cartons_per_batch} — calculated value used`);
    }

    const status = values.status !== undefined ? normalizeFileStatus(values.status) : baseStatus(base);
    const customer = values.customer !== undefined ? cleanCustomer(values.customer) : cleanCustomer(base.customer || (base.channels || [])[0]);
    const skuBarcode = values.barcode !== undefined ? cleanBarcode(values.barcode) : cleanBarcode(base.barcode);
    const cartonBarcode = values.carton_barcode !== undefined
      ? cleanBarcode(values.carton_barcode)
      : cleanBarcode(base.carton_barcode || (base.carton_skus || [])[0]?.barcode);
    const recipeName = values.recipe_name !== undefined ? text(values.recipe_name) : text(base.recipe_name);

    [skuBarcode, cartonBarcode].filter(Boolean).forEach((barcode, index) => {
      const key = barcodeKey(barcode);
      const label = index === 0 ? "SKU" : "Carton";
      const other = fileBarcodes.get(key);
      if (other) {
        errors.push(`${label} barcode ${barcode} is also used on row ${other}`);
      } else {
        fileBarcodes.set(key, entry.number);
      }
      const owner = takenBarcodes.get(key);
      if (owner && (!existing || !owner.startsWith(`${existing.product_code} `))) {
        errors.push(`${label} barcode ${barcode} already belongs to ${owner}`);
      }
      const check = checkBarcode(barcode);
      if (!check.ok) warnings.push(`${label} barcode ${barcode}: ${check.reason}`);
    });

    const record = {
      ...base,
      product_code: code,
      product_name: description,
      product_name_original: text(values.product_name) || base.product_name_original || "",
      brand: values.brand !== undefined ? text(values.brand) : base.brand || "",
      recipe_name: recipeName,
      recipe_id: base.recipe_id || "",
      cooking_time_hr: cookingHr,
      cooking_time_min: derived.cooking_time_min,
      batch_output_kg: batchOutput,
      carton_size: pcs,
      net_weight_kg: netWeightKg,
      target_net_weight_g: derived.target_net_weight_g,
      net_filling_kg: derived.net_filling_kg,
      cartons_per_batch: derived.cartons_per_batch,
      standard_batch_cartons: derived.standard_batch_cartons,
      line_type: values.line_type !== undefined ? upper(values.line_type) : base.line_type || "",
      default_machine: values.default_machine !== undefined ? text(values.default_machine) : base.default_machine || "",
      batch_prefix: values.batch_prefix !== undefined ? upper(values.batch_prefix) : base.batch_prefix || "",
      shelf_life_months: months,
      shelf_life_days: derived.shelf_life_days,
      barcode: skuBarcode,
      carton_barcode: cartonBarcode,
      customer,
      channels: [customer],
      status,
      active: status === "Active",
      hidden: !!base.hidden,
      size_value: num(base.size_value),
      size_unit: base.size_unit || "",
      packing_time_min: num(base.packing_time_min),
      lower_tolerance_g: num(base.lower_tolerance_g),
      cost_per_kg: num(base.cost_per_kg),
      remarks: values.remarks !== undefined ? text(values.remarks) : base.remarks || "",
      notes: base.notes || "",
      carton_skus: [{ description, item_code: code, barcode: cartonBarcode, units_per_carton: pcs }],
      custom_fields: [
        ...(base.custom_fields || []),
        ...Object.entries(values.custom || {}).map(([label, value]) => ({ label, value })),
      ],
      packaging_per_carton: base.packaging_per_carton || [],
      default_label_layout: base.default_label_layout || "",
      deleted: !!base.deleted,
    };

    const completeness = productCompleteness(record);
    entries.push({
      row: entry.number,
      action: errors.length ? "error" : existing ? "update" : "create",
      existingId: existing?.id || "",
      existing,
      label: `${code || "—"} · ${description || "—"}`,
      record,
      errors,
      warnings,
      incomplete: completeness.incomplete,
      missing: completeness.core,
    });
  });

  const usable = entries.filter((entry) => entry.action !== "error");
  const recipeNames = [...new Set(usable.map((entry) => upper(entry.record.recipe_name)).filter(Boolean))];
  const newRecipes = recipeNames.filter((name) => !existingRecipeNames.has(name));

  return {
    entries,
    recipesToCreate: newRecipes,
    counts: {
      total: entries.length,
      create: usable.filter((entry) => entry.action === "create").length,
      update: usable.filter((entry) => entry.action === "update").length,
      errors: entries.filter((entry) => entry.action === "error").length,
      warnings: usable.filter((entry) => entry.warnings.length).length,
      recipes: newRecipes.length,
    },
  };
}

export const importableEntries = (entries = []) => entries.filter((entry) => entry.action !== "error");

// ---- applying ---------------------------------------------------------------
const chunks = (list, size) => {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

const display = (value) =>
  Array.isArray(value) ? value.join(", ") : value === true ? "Yes" : value === false ? "No" : value === undefined || value === null ? "" : String(value);

const typeOf = (value) => {
  if (Array.isArray(value)) return "array";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  return "text";
};

const diffFields = (before, after) =>
  Object.keys(after)
    .filter((key) => display(before[key]) !== display(after[key]))
    .map((key) => ({ field: key, type: typeOf(before[key]), old_value: display(before[key]), new_value: display(after[key]) }));

const fromStored = (type, value) => {
  if (type === "number") return num(value);
  if (type === "boolean") return value === "Yes";
  if (type === "array") return value ? value.split(", ").filter(Boolean) : [];
  return value;
};

export const runImport = async ({ user, fileName, entries, settings = {}, recipes = [] }) => {
  const usable = importableEntries(entries);
  const toCreate = usable.filter((entry) => entry.action === "create");
  const toUpdate = usable.filter((entry) => entry.action === "update");

  // Brands and customers met in the file join the master lists.
  const savedSettings = await saveProductSettings({
    settings: {
      ...settings,
      brands: mergeNames(settings.brands || [], usable.map((entry) => entry.record.brand)),
      channels: mergeNames(settings.channels || [], usable.map((entry) => entry.record.customer)),
    },
    user,
  });

  const changes = [];
  const saved = []; // { id, entry }

  for (const chunk of chunks(toCreate, 100)) {
    const records = chunk.map((entry) => entry.record);
    await productService.bulkUpsertProducts(records).catch((e) => console.warn("Supabase bulk insert warning:", e));
    chunk.forEach((entry) => {
      saved.push({ id: entry.existingId || entry.record.product_code, entry });
      changes.push({ product_id: entry.record.product_code, action: "create", label: entry?.label || entry.record.product_name, fields: [] });
    });
  }

  for (const chunk of chunks(toUpdate, 100)) {
    const records = chunk.map((entry) => ({ id: entry.existingId, ...entry.record }));
    await productService.bulkUpsertProducts(records).catch((e) => console.warn("Supabase bulk update warning:", e));
    chunk.forEach((entry) => {
      saved.push({ id: entry.existingId, entry });
      const fields = diffFields(entry.existing || {}, entry.record);
      if (fields.length) changes.push({ product_id: entry.existingId, action: "update", label: entry.label, fields });
    });
  }

  // One Recipe Master record per unique recipe name; products link to it.
  const { created: recipesCreated } = await ensureRecipeLinks({
    products: saved.map(({ id, entry }) => ({
      id,
      recipe_name: entry.record.recipe_name,
      cooking_time_hr: entry.record.cooking_time_hr,
      batch_output_kg: entry.record.batch_output_kg,
      product_code: entry.record.product_code,
      product_name: entry.record.product_name,
    })),
    recipes,
    user,
  });

  const warned = usable.filter((entry) => entry.warnings.length).length;
  const record = await base44.entities.ProductImport.create({
    file_name: fileName,
    imported_at: new Date().toISOString(),
    imported_by: actingUserName(user),
    created_count: toCreate.length,
    updated_count: toUpdate.length,
    skipped_count: entries.filter((entry) => entry.action === "error").length,
    warnings_count: warned,
    errors_count: entries.filter((entry) => entry.action === "error").length,
    recipes_created: recipesCreated,
    machines_created: [],
    changes,
    undone: false,
  });

  for (const change of changes.filter((row) => row.action === "update")) {
    await base44.entities.AuditLog.create({
      event_time: new Date().toISOString(),
      event_stamp: eventStamp(),
      user_name: actingUserName(user),
      module: "Product Master",
      action: "Updated",
      record_id: change.label,
      details: change.fields.map((field) => `${field.field}: ${field.old_value || "—"} → ${field.new_value || "—"}`).join("; "),
      old_value: change.fields.map((field) => field.old_value).join(" | "),
      new_value: change.fields.map((field) => field.new_value).join(" | "),
    });
  }

  await base44.entities.AuditLog.create({
    event_time: new Date().toISOString(),
    event_stamp: eventStamp(),
    user_name: actingUserName(user),
    module: "Product Master",
    action: "Imported",
    record_id: fileName,
    details: `${toCreate.length} created, ${toUpdate.length} updated, ${record.errors_count} error(s), ${record.warnings_count} warning(s), ${recipesCreated.length} recipe(s) created from ${fileName}`,
    old_value: "",
    new_value: `${toCreate.length + toUpdate.length} row(s) imported`,
  });

  return { record, savedSettings, recipesCreated };
};

export const undoImport = async ({ record, user }) => {
  const changes = record.changes || [];
  const createdIds = changes.filter((row) => row.action === "create").map((row) => row.product_id).filter(Boolean);
  if (createdIds.length) {
    try {
      await base44.entities.Product.deleteMany({ id: { $in: createdIds } });
    } catch {
      for (const id of createdIds) await base44.entities.Product.delete(id);
    }
  }
  const restores = changes
    .filter((row) => row.action === "update")
    .map((row) => {
      const payload = { id: row.product_id };
      (row.fields || []).forEach((field) => { payload[field.field] = fromStored(field.type, field.old_value); });
      return payload;
    })
    .filter((payload) => Object.keys(payload).length > 1);
  for (const chunk of chunks(restores, 100)) {
    await base44.entities.Product.bulkUpdate(chunk);
  }
  await base44.entities.ProductImport.update(record.id, {
    undone: true,
    undone_by: actingUserName(user),
    undone_at: new Date().toISOString(),
  });
  await base44.entities.AuditLog.create({
    event_time: new Date().toISOString(),
    event_stamp: eventStamp(),
    user_name: actingUserName(user),
    module: "Product Master",
    action: "Undone",
    record_id: record.file_name,
    details: `Import of ${record.file_name} undone — ${createdIds.length} product(s) removed, ${restores.length} restored`,
    old_value: `${record.created_count} created / ${record.updated_count} updated`,
    new_value: "undone",
  });
};