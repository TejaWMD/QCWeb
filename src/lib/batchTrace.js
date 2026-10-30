// Links a saved batch to the production order it came from, the downtime events
// logged while it ran, and the ingredient / packaging lots it consumed. The lot
// link works both ways: batch → supplier lots, and supplier lot → finished batches.
import { base44 } from "@/api/base44Client";
import { actingUserName } from "@/lib/permissions";
import { num } from "@/lib/planning";
import { activeRecipeFor } from "@/lib/recipeMaster";
import { loadReceipts, localDateStr } from "@/lib/production";
import { todayStr } from "@/lib/warehouse";

const upper = (v) => (v || "").trim().toUpperCase();

// ---- order link ------------------------------------------------------------
// Saving a batch marks it on the order and adds its cartons to the produced total.
export const recordBatchOnOrder = async ({ order, batchNumber, cartons, recordId, user }) => {
  if (!order) return null;
  const entries = order.recorded_batches || [];
  if (entries.some((e) => upper(e.batch_number) === upper(batchNumber))) return order;
  const recorded_batches = [
    ...entries,
    {
      batch_number: batchNumber,
      cartons: num(cartons),
      record_id: recordId || "",
      recorded_date: new Date().toISOString(),
      recorded_by: actingUserName(user),
    },
  ];
  const produced_cartons = recorded_batches.reduce((sum, e) => sum + num(e.cartons), 0);
  const updated = await base44.entities.ProductionOrder.update(order.id, { recorded_batches, produced_cartons });
  return updated || { ...order, recorded_batches, produced_cartons };
};

// ---- loaders ---------------------------------------------------------------
export const loadDowntimes = async () => {
  const rows = await base44.entities.Downtime.list("-created_date", 1500).catch(() => []);
  return Array.isArray(rows) ? rows : [];
};

export const loadMovements = async () => {
  const rows = await base44.entities.PackagingMovement.list("-created_date", 2000).catch(() => []);
  return Array.isArray(rows) ? rows : [];
};

export { loadReceipts as loadLotReceipts };

// The recipe is shared by every product with the same recipe name, so the lookup
// goes through the product's recipe link (product id accepted as well).
export const productRecipe = (recipes, product) => activeRecipeFor(recipes, product);

// ---- downtime --------------------------------------------------------------
const stampOn = (dateStr, timeStr) => {
  const [y, m, d] = (dateStr || "").split("-").map(Number);
  const [hh, mm] = (timeStr || "00:00").split(":").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, hh || 0, mm || 0).getTime();
};

// Downtime on the same machine, inside the order's actual (or planned) window when
// that window falls on the batch production date, otherwise on the same day.
export const downtimeInBatchWindow = ({ record, order, downtimes = [] }) => {
  const machine = upper(record?.machine);
  const date = record?.production_date || "";
  if (!machine || !date) return [];
  const start = order?.actual_start ? new Date(order.actual_start) : order?.planned_start ? new Date(order.planned_start) : null;
  const end = order?.actual_end ? new Date(order.actual_end) : order?.planned_end ? new Date(order.planned_end) : null;
  const useWindow = !!start && !!end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && localDateStr(start) === date;

  return (downtimes || [])
    .filter((d) => {
      if (d.is_demo) return false;
      if (upper(d.production_line) !== machine) return false;
      if (!useWindow) return d.shift_date === date;
      if (d.shift_date !== date) return false;
      const from = stampOn(d.shift_date, d.start_time || "00:00");
      const to = stampOn(d.shift_date, d.end_time || d.start_time || "23:59");
      return from != null && to != null && from < end.getTime() && to > start.getTime();
    })
    .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
};

// ---- lots ------------------------------------------------------------------
export const ingredientLotsForBatch = ({ recipe, receipts = [] }) =>
  (recipe?.ingredients || []).map((ing) => {
    const code = upper(ing.item_code);
    const lots = (receipts || [])
      .filter((r) => upper(r.item_code) === code)
      .map((r) => ({
        lot: r.batch_number || "—",
        supplier: r.supplier || "",
        quantity: num(r.quantity),
        unit: r.unit || ing.unit || "",
        expiry_date: r.expiry_date || "",
        date_received: r.date_received || "",
        rack_location: r.rack_location || "",
      }))
      .sort((a, b) => (b.date_received || "").localeCompare(a.date_received || ""));
    return {
      code: ing.item_code || "",
      name: ing.material_name || ing.item_code || "Material",
      unit: ing.unit || "",
      perBatch: num(ing.quantity_per_batch),
      lots,
    };
  });

export const packagingIssuedForBatch = ({ record, movements = [] }) => {
  const orderNo = upper(record?.order_number);
  const machine = upper(record?.machine);
  const date = record?.production_date || "";

  const lines = (movements || []).filter((m) => {
    const kind = (m.type || "").toLowerCase();
    const isIssue = kind === "use" || (m.source || "").toLowerCase() === "goods issued";
    if (!isIssue) return false;
    if (orderNo && upper(m.production_order) === orderNo) return true;
    return !!machine && upper(m.production_line) === machine && m.movement_date === date;
  });

  const grouped = new Map();
  lines.forEach((m) => {
    const key = upper(m.item_code) || m.item_id || m.item_name;
    const entry = grouped.get(key) || {
      code: m.item_code || "",
      name: m.item_name || m.item_code || "Packaging",
      unit: m.unit || "",
      quantity: 0,
      lots: [],
    };
    entry.quantity += num(m.quantity);
    entry.lots.push({
      lot: m.batch_number || "—",
      rack_location: m.rack_location || "",
      movement_date: m.movement_date || "",
      production_order: m.production_order || "",
      source: m.source || "",
      quantity: num(m.quantity),
    });
    grouped.set(key, entry);
  });
  return Array.from(grouped.values()).sort((a, b) => (a.code || "").localeCompare(b.code || ""));
};

// Forward trace: which finished batches consumed a supplier lot (ingredient lots
// from goods receipts, packaging lots from stock movements).
export const batchesUsingLot = ({ lot, records = [], recipes = [], receipts = [], movements = [] }) => {
  const target = upper(lot);
  if (!target) return [];
  const codes = new Set((receipts || []).filter((r) => upper(r.batch_number) === target).map((r) => upper(r.item_code)));
  const orderNumbers = new Set(
    (movements || []).filter((m) => upper(m.batch_number) === target).map((m) => upper(m.production_order)).filter(Boolean)
  );

  return (records || [])
    .map((record) => {
      const reasons = [];
      if (codes.size) {
        const recipe = productRecipe(recipes, record.product_id);
        const used = (recipe?.ingredients || []).find((ing) => codes.has(upper(ing.item_code)));
        if (used) reasons.push(`Ingredient: ${used.material_name || used.item_code}`);
      }
      if (orderNumbers.size && orderNumbers.has(upper(record.order_number))) reasons.push("Packaging issued to this order");
      return reasons.length ? { record, via: reasons.join(" · ") } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (b.record.production_date || "").localeCompare(a.record.production_date || ""));
};

// Everything received and issued under one lot number, for the forward trace header.
export const lotDetails = ({ lot, receipts = [], movements = [] }) => {
  const target = upper(lot);
  return {
    receipts: (receipts || []).filter((r) => upper(r.batch_number) === target),
    movements: (movements || []).filter((m) => upper(m.batch_number) === target),
  };
};

// ---- today's schedule ------------------------------------------------------
export const todaysSchedule = ({ orders = [], machines = [], now = new Date() }) => {
  const today = todayStr(now);
  const scheduled = (orders || []).filter(
    (o) => !o.deleted && o.status !== "Cancelled" && localDateStr(o.planned_start) === today
  );
  const isLate = (o) => o.status !== "Completed" && new Date(o.planned_end || o.planned_start).getTime() < now.getTime();

  const planned = scheduled.filter((o) => o.status === "Planned" && !isLate(o)).length;
  const inProgress = scheduled.filter((o) => o.status === "In Progress" && !isLate(o)).length;
  const completed = scheduled.filter((o) => o.status === "Completed").length;
  const delayed = scheduled.filter(isLate).length;

  const busy = new Set(scheduled.map((o) => o.machine).filter(Boolean));
  const idle = (machines || [])
    .filter((m) => m.status !== "Under Maintenance" && !busy.has(m.name))
    .map((m) => m.name);

  return { total: scheduled.length, planned, inProgress, completed, delayed, idle };
};