// Shared activity-log helpers. Every write path in the app records one entry
// here, so the Activity Logs page is the single audit trail for the pipeline.

// The plant runs on Malaysian time (no daylight saving).
const APP_UTC_OFFSET_HOURS = 8;

// Material components tracked on shift log records (mirrors src/lib/shiftLogConstants.js).
export const WASTE_COMPONENTS = [
  ["bottle", "Bottle"],
  ["jar", "Jar"],
  ["plastic", "Plastic"],
  ["pouch", "Pouch"],
  ["foil", "Foil"],
  ["cup", "Cup"],
  ["tub", "Tub"],
  ["cap", "Cap"],
  ["lid", "Lid"],
  ["packet", "Packet"],
  ["shrink_label", "Shrink Label"],
  ["label", "Label"],
  ["extra_sticker", "Extra Sticker"],
  ["carton_box", "Carton Box"],
];

export const WASTE_KEYS = WASTE_COMPONENTS.map((component) => component[0]);

const MATERIAL_FIELDS = WASTE_COMPONENTS.flatMap(([key, label]) => [
  [`${key}_used`, `${label} Used`],
  [`${key}_waste`, `${label} Waste`],
]);

// Fields captured for a Shift Log submission / edit, in display order.
export const SHIFT_LOG_FIELDS = [
  ["shift_date", "Date"],
  ["shift_type", "Shift"],
  ["production_line", "Production Line"],
  ["task", "Task"],
  ["product_name", "Product"],
  ["product_type", "Product Type"],
  ["batch_number", "Batch / Lot"],
  ["planned_cartons", "Planned Cartons"],
  ["pcs_per_carton", "Pcs / Carton"],
  ["planned_qty", "Planned Qty"],
  ["actual_output", "Actual Output"],
  ["rejected_qty", "Rejected Qty"],
  ["start_time", "Start Time"],
  ["end_time", "End Time"],
  ["break_duration", "Break Duration"],
  ["ot_duration_hours", "Overtime Duration"],
  ["hourly_ot_rate", "Hourly OT Rate"],
  ["downtime_min", "Downtime"],
  ["staff_count", "Staff Count"],
  ["staff_name", "Staff Names"],
  ["status", "Status"],
  ...MATERIAL_FIELDS,
];

// Fields captured for an Operation Record submission / edit.
export const OPERATION_FIELDS = [
  ["ot_date", "Date"],
  ["production_line", "Production Line"],
  ["product_sku", "Product / SKU"],
  ["task", "Task"],
  ["staff_count", "Staff Count"],
  ["staff_name", "Staff Name"],
  ["ot_objective", "Objective"],
  ["ot_start", "OT Start"],
  ["ot_end", "OT End"],
  ["hourly_ot_rate", "Hourly OT Rate"],
  ["planned_ot_qty", "Planned Qty"],
  ["actual_good_output", "Good Output"],
  ["rejected_wasted_qty", "Rejected / Wasted Qty"],
  ["downtime_min", "Downtime"],
];

const TEXT_FIELDS = [
  "shift_date", "shift_type", "production_line", "task", "product_name", "product_type",
  "batch_number", "staff_name", "status", "ot_date", "product_sku", "ot_objective",
];
const TIME_FIELDS = ["start_time", "end_time"];
const DATETIME_FIELDS = ["ot_start", "ot_end"];
const HOUR_FIELDS = ["ot_duration_hours", "break_duration"];
const MINUTE_FIELDS = ["downtime_min"];
const MONEY_FIELDS = ["hourly_ot_rate"];

const num = (value) => Number(value) || 0;
const isBlank = (value) => value === null || value === undefined || value === "";

// "YYYY-MM-DD HH:MM:SS" in plant time.
export function eventStamp(date = new Date()) {
  const shifted = new Date(date.getTime() + APP_UTC_OFFSET_HOURS * 3600000);
  return shifted.toISOString().slice(0, 19).replace("T", " ");
}

// A recorded value as it should read inside a log line.
export function formatValue(field, value) {
  if (isBlank(value)) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (TEXT_FIELDS.indexOf(field) >= 0) return String(value);
  if (TIME_FIELDS.indexOf(field) >= 0) return String(value).slice(0, 5);
  if (DATETIME_FIELDS.indexOf(field) >= 0) return `${String(value).slice(0, 10)} ${String(value).slice(11, 16)}`;
  if (HOUR_FIELDS.indexOf(field) >= 0) return `${num(value).toFixed(1)} hrs`;
  if (MINUTE_FIELDS.indexOf(field) >= 0) return `${num(value)} min`;
  if (MONEY_FIELDS.indexOf(field) >= 0) return `RM ${num(value).toFixed(2)}`;
  return num(value).toLocaleString("en-US");
}

// Two recorded values count as the same when only their formatting differs.
export function sameValue(before, after) {
  if (before === after) return true;
  if (isBlank(before)) return isBlank(after);
  if (isBlank(after)) return false;
  const a = Number(before);
  const b = Number(after);
  if (Number.isFinite(a) && Number.isFinite(b)) return a === b;
  return String(before) === String(after);
}

// Every recorded field whose value actually changed. Values that only differ in
// stored formatting (a timestamp with or without seconds, say) read the same and
// are not reported.
export function buildChangedFields(before, after, fields) {
  return fields
    .filter(([key]) => !sameValue(before ? before[key] : undefined, after ? after[key] : undefined))
    .map(([key, label]) => ({
      field: key,
      label,
      from: formatValue(key, before ? before[key] : undefined),
      to: formatValue(key, after ? after[key] : undefined),
    }))
    .filter((change) => change.from !== change.to);
}

export function changeLines(changes) {
  return changes.map((change) => `${change.label}: ${change.from} → ${change.to}`);
}

// The values a brand new entry carried (only the fields that were filled in).
export function buildSnapshot(record, fields, max = 24) {
  const filled = fields.filter(([key]) => {
    const value = record ? record[key] : undefined;
    return value !== null && value !== undefined && value !== "" && value !== 0 && value !== false;
  });
  return filled.slice(0, max).map(([key, label]) => `${label}: ${formatValue(key, record[key])}`);
}

const lineOf = (record) => {
  const line = record ? record.production_line : "";
  return line ? String(line).split(" - ")[0] : "";
};

const where = (record) => {
  const line = lineOf(record);
  return line ? ` on ${line}` : "";
};

export function newEntryDetail(moduleName, record) {
  const parts = [`Submitted new ${moduleName} entry${where(record)}`];
  const rejected = num(record && record.rejected_qty !== undefined ? record.rejected_qty : record && record.rejected_wasted_qty);
  if (rejected > 0) parts.push(`with ${rejected.toLocaleString("en-US")} rejected pcs`);
  const otHours = num(record ? record.ot_duration_hours : 0);
  if (otHours > 0) parts.push(`${parts.length > 1 ? "and" : "with"} ${otHours.toFixed(1)} hrs overtime`);
  return parts.join(" ");
}

export function modifiedDetail(moduleName, record, changes) {
  if (!changes.length) return `Saved ${moduleName} entry with no field changes${where(record)}`;
  if (changes.length === 1) {
    const change = changes[0];
    return `Updated ${change.label} from ${change.from} to ${change.to}${where(record)}`;
  }
  const shown = changes.slice(0, 3).map((change) => `${change.label} ${change.from} → ${change.to}`).join("; ");
  const more = changes.length > 3 ? ` (+${changes.length - 3} more)` : "";
  return `Updated ${changes.length} fields${where(record)}: ${shown}${more}`;
}

export function deletedDetail(moduleName, record) {
  const product = (record && (record.product_name || record.product_sku)) || "";
  return `Deleted ${moduleName} entry${where(record)}${product ? ` (${product})` : ""}`;
}

// Writes one activity record. Callers pass the service-role client so the audit
// entry lands even when the underlying tables are admin-gated.
export async function logActivity(client, entry) {
  const now = new Date();
  return client.entities.ActivityLog.create({
    event_time: now.toISOString(),
    event_stamp: eventStamp(now),
    user_name: (entry.user && (entry.user.full_name || entry.user.email)) || "Unknown user",
    user_email: (entry.user && entry.user.email) || "",
    user_id: (entry.user && entry.user.id) || "",
    action_type: entry.actionType,
    module: entry.module,
    record_id: (entry.record && entry.record.id) || "",
    session_id: entry.sessionId || (entry.record && entry.record.session_id) || "",
    details: entry.details || "",
    changes: entry.changes || [],
  });
}