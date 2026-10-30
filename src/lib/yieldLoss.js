// Shared logic for the Yield & Loss module: settings, role gates, the yield maths,
// the packaging waste comparison and the giveaway calculations. Data is reused from
// Batch Records, Goods Issued (PackagingMovement), Packaging Stock, Product Master,
// Recipe Master and the Daily Packaging Entry (ShiftLog) rather than duplicated.
import { base44 } from "@/api/base44Client";
import { actingUserName, appRoleOf, isAdminUser } from "@/lib/permissions";
import { eventStamp } from "@/lib/warehouse";
import { num } from "@/lib/planning";

const upper = (v) => (v || "").trim().toUpperCase();

export const YIELD_SETTINGS_KEY = "yield_loss";
export const DISPOSITIONS = ["Reused in new batch", "Reprocessed", "Downgraded / sold as B-grade", "Discarded"];
export const SHIFTS = ["Morning", "Night"];
export const DEFAULT_WASTE_REASONS = ["Changeover", "Jam", "Misprint", "Damaged roll", "Setup", "Other"];
export const DEFAULT_REWORK_REASONS = ["Off-spec viscosity", "Overfill", "Label error", "Machine start-up", "Power interruption", "Expired material", "Other"];
export const DEFAULT_SETTINGS = {
  id: "",
  yield_tolerance_pct: 1.5,
  packaging_waste_threshold_pct: 3,
  max_rework_pct: 2,
  waste_reasons: DEFAULT_WASTE_REASONS,
  rework_reasons: DEFAULT_REWORK_REASONS,
};

// ---- roles -----------------------------------------------------------------
const role = (user) => appRoleOf(user);
// Production staff enter the data, supervisors verify it, QA and Admin own the settings.
export const canEnterYieldLoss = (user) =>
  isAdminUser(user) || ["manager", "supervisor", "operator", "qa_officer"].includes(role(user));
export const canVerifyYieldLoss = (user) =>
  isAdminUser(user) || ["manager", "supervisor", "qa_officer"].includes(role(user));
export const canApproveRework = (user) => isAdminUser(user) || ["qa_officer", "manager"].includes(role(user));
export const canEditYieldSettings = (user) => isAdminUser(user) || role(user) === "qa_officer";

// A verifier can never be the person who entered the record.
export const canVerifyRecord = (user, record) =>
  canVerifyYieldLoss(user) && record?.status !== "Verified" && record?.owner_id !== user?.id;

// ---- settings --------------------------------------------------------------
const cleanList = (value, fallback) =>
  Array.isArray(value) && value.length ? value.map((v) => String(v).trim()).filter(Boolean) : fallback;

export const loadYieldSettings = async () => {
  const page = await base44.entities.YieldLossSettings.filter({ key: YIELD_SETTINGS_KEY }, { limit: 1 });
  const doc = (page.items || [])[0] || {};
  return {
    id: doc.id || "",
    yield_tolerance_pct: doc.yield_tolerance_pct == null ? DEFAULT_SETTINGS.yield_tolerance_pct : num(doc.yield_tolerance_pct),
    packaging_waste_threshold_pct:
      doc.packaging_waste_threshold_pct == null ? DEFAULT_SETTINGS.packaging_waste_threshold_pct : num(doc.packaging_waste_threshold_pct),
    max_rework_pct: doc.max_rework_pct == null ? DEFAULT_SETTINGS.max_rework_pct : num(doc.max_rework_pct),
    waste_reasons: cleanList(doc.waste_reasons, DEFAULT_WASTE_REASONS),
    rework_reasons: cleanList(doc.rework_reasons, DEFAULT_REWORK_REASONS),
  };
};

export const saveYieldSettings = async ({ settings, user }) => {
  const payload = {
    key: YIELD_SETTINGS_KEY,
    yield_tolerance_pct: num(settings.yield_tolerance_pct),
    packaging_waste_threshold_pct: num(settings.packaging_waste_threshold_pct),
    max_rework_pct: num(settings.max_rework_pct),
    waste_reasons: cleanList(settings.waste_reasons, DEFAULT_WASTE_REASONS),
    rework_reasons: cleanList(settings.rework_reasons, DEFAULT_REWORK_REASONS),
    updated_by: actingUserName(user),
  };
  if (settings.id) return base44.entities.YieldLossSettings.update(settings.id, payload);
  return base44.entities.YieldLossSettings.create(payload);
};

// ---- loaders ---------------------------------------------------------------
export const loadBatchYields = async () => {
  const rows = await base44.entities.BatchYield.list("-shift_date", 1500).catch(() => []);
  return Array.isArray(rows) ? rows : [];
};
export const loadPackagingWastes = async () => {
  const rows = await base44.entities.PackagingWaste.list("-waste_date", 1500).catch(() => []);
  return Array.isArray(rows) ? rows : [];
};
export const loadFillChecks = async () => {
  const rows = await base44.entities.FillCheck.list("-check_date", 1500).catch(() => []);
  return Array.isArray(rows) ? rows : [];
};
export const loadReworks = async () => {
  const rows = await base44.entities.ReworkRecord.list("-rework_date", 1500).catch(() => []);
  return Array.isArray(rows) ? rows : [];
};
export const loadIssues = async () => {
  const rows = await base44.entities.PackagingMovement.list("-created_date", 2000).catch(() => []);
  return Array.isArray(rows) ? rows : [];
};
export const loadShiftEntries = async () => {
  const rows = await base44.entities.ShiftLog.list("-shift_date", 800).catch(() => []);
  return Array.isArray(rows) ? rows : [];
};

// ---- maths -----------------------------------------------------------------
export const fmtKg = (v) => `${num(v).toLocaleString("en-US", { maximumFractionDigits: 2 })} kg`;
export const fmtPct = (v) => `${num(v).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
export const round1 = (v) => Math.round(num(v) * 10) / 10;

// Mass to kg, so litres of liquid ingredients count as kg.
export const kgFrom = (qty, unit) => {
  const n = num(qty);
  const u = (unit || "").trim().toLowerCase();
  if (u === "g" || u === "ml") return n / 1000;
  if (["kg", "l", "lt", "litre", "liter"].includes(u)) return n;
  return 0;
};

// Ingredient kg issued to a batch: PackagingMovements with type Use that carry the
// batch number, its order number, or the same line and date, limited to the item
// codes on the product's active recipe.
export const issuedIngredientsForBatch = ({ record, order, recipe, movements = [] }) => {
  const codes = new Set((recipe?.ingredients || []).map((i) => upper(i.item_code)).filter(Boolean));
  const batch = upper(record?.batch_number);
  const orderNo = upper(record?.order_number || order?.order_number);
  const line = upper(record?.machine);
  const date = record?.production_date || "";

  const lines = (movements || [])
    .filter((m) => {
      if ((m.type || "").toLowerCase() !== "use") return false;
      // Recipe ingredients by code, plus anything issued as a raw material in kg.
      const isRecipeItem = codes.has(upper(m.item_code));
      const rawMaterial = upper(m.category) === "RAW MATERIAL" && kgFrom(m.quantity, m.unit) > 0;
      if (!isRecipeItem && !rawMaterial) return false;
      if (batch && upper(m.batch_number) === batch) return true;
      if (orderNo && upper(m.production_order) === orderNo) return true;
      return !!line && upper(m.production_line) === line && m.movement_date === date;
    })
    .map((m) => ({
      item_code: m.item_code || "",
      item_name: m.item_name || m.item_code || "Material",
      quantity: num(m.quantity),
      unit: m.unit || "",
      kg: kgFrom(m.quantity, m.unit),
    }));

  return {
    kg: lines.reduce((sum, l) => sum + l.kg, 0),
    lines,
    lineCount: lines.length,
    hasRecipe: !!recipe,
    ingredientCount: (recipe?.ingredients || []).length,
  };
};

export const outputKgFor = ({ cartons, cartonSize, netWeightG }) =>
  (num(cartons) * num(cartonSize) * num(netWeightG)) / 1000;

export const yieldPctFor = (outputKg, inputKg) => (num(inputKg) > 0 ? (num(outputKg) / num(inputKg)) * 100 : 0);

// Variance against the recipe standard; red when the shortfall beats the tolerance.
export const yieldVariance = ({ yieldPct, standardPct, tolerancePct }) => {
  const variance = num(yieldPct) - num(standardPct);
  const within = num(standardPct) <= 0 || variance >= -Math.abs(num(tolerancePct));
  return { variance_pct: round1(variance), within_tolerance: within };
};

// Pieces issued from Packaging Stock to a line on a day.
export const packagingUsedForLine = ({ movements = [], dateStr, line }) => {
  const rows = (movements || []).filter(
    (m) =>
      (m.type || "") === "Use" &&
      m.movement_date === dateStr &&
      (!line || upper(m.production_line) === upper(line))
  );
  const pieces = rows
    .filter((m) => ["pcs", "pc", "piece", "pieces", "unit", "units"].includes((m.unit || "").trim().toLowerCase()))
    .reduce((sum, m) => sum + num(m.quantity), 0);
  return { rows, pieces, total: rows.reduce((sum, m) => sum + num(m.quantity), 0) };
};

export const wasteSummary = ({ cartons, labels, pouches, usedUnits, thresholdPct }) => {
  const wasteUnits = num(cartons) + num(labels) + num(pouches);
  const pct = num(usedUnits) > 0 ? (wasteUnits / num(usedUnits)) * 100 : 0;
  return {
    waste_units: wasteUnits,
    waste_pct: round1(pct),
    exceeded: num(usedUnits) > 0 && pct > num(thresholdPct),
  };
};

// Waste the Daily Packaging Entry already captured for that line, date and shift, so
// the same figures are never asked for twice.
const SHIFT_WASTE_FIELDS = { labels: "label_waste", pouches: "pouch_waste", cartons: "carton_box_waste", film_m: "foil_waste" };

export const shiftEntryWaste = ({ entries = [], dateStr, line, shift }) => {
  const match = (entries || []).find(
    (e) =>
      e.shift_date === dateStr &&
      (!line || upper(e.production_line) === upper(line)) &&
      (!shift || e.shift_type === shift)
  );
  if (!match) return null;
  const pulled = Object.fromEntries(Object.entries(SHIFT_WASTE_FIELDS).map(([field, key]) => [field, num(match[key])]));
  const usedFromEntry = ["label_used", "pouch_used", "carton_box_used", "foil_used"].reduce((sum, key) => sum + num(match[key]), 0);
  return { id: match.id, ...pulled, usedFromEntry, hasWaste: Object.values(pulled).some((v) => v > 0) };
};

// Average, giveaway and the cost of that giveaway for one fill check.
export const fillSummary = ({ samples = [], targetG, lowerG, packs = 0, costPerKg = 0 }) => {
  const values = (samples || []).map(num).filter((v) => v > 0);
  const target = num(targetG);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const giveaway = values.length && target > 0 ? avg - target : 0;
  const underweight = num(lowerG) > 0 ? values.filter((v) => v < num(lowerG)).length : 0;
  const costPerPack = (Math.max(0, giveaway) / 1000) * num(costPerKg);
  return {
    sample_count: values.length,
    avg_g: Math.round(avg * 100) / 100,
    giveaway_g: Math.round(giveaway * 100) / 100,
    giveaway_pct: target > 0 ? round1((giveaway / target) * 100) : 0,
    underweight_count: underweight,
    compliance_risk: underweight > 0,
    cost_per_batch: Math.round(costPerPack * num(packs) * 100) / 100,
  };
};

// RW-28102026-01 style lot IDs, one sequence per day.
export const nextReworkLotId = (existing = [], dateStr) => {
  const [y, m, d] = (dateStr || "").split("-");
  const stamp = y ? `${d}${m}${y}` : "";
  const prefix = `RW-${stamp}-`;
  const highest = (existing || []).reduce((max, r) => {
    const id = r.rework_lot_id || "";
    if (!id.startsWith(prefix)) return max;
    const seq = Number(id.slice(prefix.length));
    return Number.isFinite(seq) ? Math.max(max, seq) : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(2, "0")}`;
};

export const reworkPctFor = (quantityKg, batchOutputKg) =>
  num(batchOutputKg) > 0 ? round1((num(quantityKg) / num(batchOutputKg)) * 100) : 0;

// ---- audit -----------------------------------------------------------------
export const logYieldAudit = async ({ user, action, recordId, details, oldValue = "", newValue = "" }) => {
  try {
    await base44.entities.AuditLog.create({
      event_time: new Date().toISOString(),
      event_stamp: eventStamp(),
      user_name: actingUserName(user),
      module: "Yield & Loss",
      action,
      record_id: recordId || "",
      details,
      old_value: oldValue,
      new_value: newValue,
    });
  } catch {
    // The saved record stands even if the audit entry cannot be written.
  }
};