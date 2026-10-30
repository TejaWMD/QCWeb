// Shared shift log -> mirrored records pipeline. One shift log session is the
// source of truth: the Operation, Overtime and Wastage records are re-derived
// from it in a single pass so every page reads the same numbers.

import { WASTE_KEYS } from "./activityLog.ts";

const num = (value) => Number(value) || 0;
const str = (value) => (value === null || value === undefined ? "" : String(value));

export const toDate = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null;
  const dt = new Date(`${dateStr}T${timeStr}:00`);
  return isNaN(dt.getTime()) ? null : dt.toISOString();
};

const timeToMinutes = (value) => {
  const [hours, minutes] = String(value || "").slice(0, 5).split(":");
  const h = Number(hours);
  const m = Number(minutes);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

// Overtime on a shift log runs past 17:00, forward across midnight.
// Both arguments are "HH:MM" times.
export const otHoursFromTimes = (start, end) => {
  const sMin = timeToMinutes(start);
  const eMin = timeToMinutes(end);
  if (sMin === null || eMin === null) return 0;
  if (eMin <= sMin) return Math.max(0, 1440 - Math.max(sMin, 17 * 60)) / 60;
  if (eMin <= 17 * 60) return 0;
  return (eMin - Math.max(sMin, 17 * 60)) / 60;
};

const objectiveOf = (s) =>
  s.downtime_remarks
    ? `Regular shift run (${s.downtime_remarks.split(";")[0].split("(")[0].trim()})`
    : "Regular shift run";

// Used / wasted quantities for every tracked material component.
const materialFields = (s) =>
  Object.fromEntries(
    WASTE_KEYS.flatMap((k) => [[`${k}_used`, num(s[`${k}_used`])], [`${k}_waste`, num(s[`${k}_waste`])]])
  );

// Full Operation Record payload mirrored from a shift log submission.
export const buildOperationPayload = (s, sessionId) => ({
  ot_date: s.shift_date,
  production_line: s.production_line,
  product_sku: s.product_name || s.batch_number || "",
  product_name: str(s.product_name),
  product_type: str(s.product_type),
  batch_number: str(s.batch_number),
  task: str(s.task),
  staff_count: num(s.staff_count),
  staff_name: str(s.staff_name),
  ot_objective: objectiveOf(s),
  ot_start: toDate(s.shift_date, s.start_time),
  ot_end: toDate(s.shift_date, s.end_time),
  hourly_ot_rate: num(s.hourly_ot_rate),
  planned_cartons: num(s.planned_cartons),
  pcs_per_carton: num(s.pcs_per_carton),
  planned_ot_qty: num(s.planned_qty),
  actual_good_output: num(s.actual_output),
  rejected_wasted_qty: num(s.rejected_qty),
  downtime_min: num(s.downtime_min),
  session_id: sessionId,
  record_batch: "current",
});

// Overtime Record payload for sessions that ran into overtime.
export const buildOtPayload = (s, sessionId, operationLogId) => ({
  ot_date: s.shift_date,
  operation_log_id: operationLogId,
  session_id: sessionId,
  shift_type: s.shift_type || "Morning",
  production_line: s.production_line,
  task: str(s.task),
  product_type: str(s.product_type),
  product_name: str(s.product_name),
  product_sku: s.product_name || s.batch_number || "",
  batch_number: str(s.batch_number),
  planned_ot_qty: num(s.planned_qty),
  actual_good_output: num(s.actual_output),
  rejected_wasted_qty: num(s.rejected_qty),
  planned_cartons: num(s.planned_cartons),
  pcs_per_carton: num(s.pcs_per_carton),
  // Overtime is only the hours run after 17:00, the same rule the shift log uses.
  ot_duration_hours: Number(otHoursFromTimes(s.start_time, s.end_time).toFixed(2)),
  staff_count: num(s.staff_count),
  staff_name: str(s.staff_name),
  start_time: str(s.start_time),
  end_time: str(s.end_time),
  ot_objective: objectiveOf(s),
  ot_start: toDate(s.shift_date, s.start_time),
  ot_end: toDate(s.shift_date, s.end_time),
  hourly_ot_rate: num(s.hourly_ot_rate),
  downtime_min: num(s.downtime_min),
  ...materialFields(s),
  record_batch: "current",
});

// Wastage Record payload for sessions with rejected pieces or material waste.
export const buildWastagePayload = (s, sessionId, operationLogId) => ({
  date: s.shift_date,
  production_line: s.production_line,
  product_name: str(s.product_name),
  product_type: str(s.product_type),
  batch_number: str(s.batch_number),
  operation_log_id: operationLogId,
  session_id: sessionId,
  total_waste: num(s.rejected_qty),
  ...Object.fromEntries(WASTE_KEYS.map((k) => [`${k}_waste`, num(s[`${k}_waste`])])),
});

// The shift log values an Operation Record edit carries back onto its session,
// so the session (and everything derived from it) stays the source of truth.
export const shiftLogPatchFromOperation = (operation, shiftLog) => {
  const start = operation.ot_start ? String(operation.ot_start).slice(11, 16) : shiftLog.start_time || "";
  const end = operation.ot_end ? String(operation.ot_end).slice(11, 16) : shiftLog.end_time || "";
  const patch = {
    shift_date: operation.ot_date || shiftLog.shift_date,
    production_line: operation.production_line || shiftLog.production_line,
    product_name: operation.product_sku || shiftLog.product_name,
    batch_number: operation.batch_number || shiftLog.batch_number,
    task: operation.task || shiftLog.task,
    staff_count: num(operation.staff_count),
    staff_name: str(operation.staff_name),
    start_time: start,
    end_time: end,
    hourly_ot_rate: num(operation.hourly_ot_rate),
    planned_qty: num(operation.planned_ot_qty),
    actual_output: num(operation.actual_good_output),
    rejected_qty: num(operation.rejected_wasted_qty),
    downtime_min: num(operation.downtime_min),
    record_batch: operation.record_batch || shiftLog.record_batch || "current",
  };
  // Overtime is recomputed from the edited times when both are known.
  patch.ot_duration_hours = start && end
    ? Number(otHoursFromTimes(start, end).toFixed(2))
    : num(shiftLog.ot_duration_hours);
  return patch;
};

// Upserts the Operation / Overtime / Wastage mirrors for one shift log session.
// The caller passes a rollback journal that collects every record created here,
// so a failure later in the same transaction can undo them.
export async function syncMirrors(admin, shiftLog, sessionId, journal, options = {}) {
  let operationLogId = options.operationLogId || null;
  let otLogId = null;
  let wastageLogId = null;

  // Core sync: create or update the linked Operation Record.
  if (!options.skipOperation) {
    const opPage = await admin.entities.OperationLog.filter({ session_id: sessionId }, { limit: 5 });
    const opPayload = buildOperationPayload(shiftLog, sessionId);
    if (opPage.items && opPage.items.length) {
      operationLogId = opPage.items[0].id;
      await admin.entities.OperationLog.update(operationLogId, opPayload);
    } else {
      const op = await admin.entities.OperationLog.create(opPayload);
      operationLogId = op.id;
      journal.push(["OperationLog", op.id]);
    }
  }

  // Conditional overtime routing: overtime duration or cost above zero keeps
  // the linked Overtime Record in sync; cleared or zero removes it.
  const otHours = num(shiftLog.ot_duration_hours);
  const otCost = otHours * num(shiftLog.staff_count) * num(shiftLog.hourly_ot_rate);
  const otPage = await admin.entities.OTLog.filter({ session_id: sessionId }, { limit: 5 });
  if (otHours > 0 || otCost > 0) {
    const otPayload = buildOtPayload(shiftLog, sessionId, operationLogId);
    if (otPage.items && otPage.items.length) {
      otLogId = otPage.items[0].id;
      await admin.entities.OTLog.update(otLogId, otPayload);
    } else {
      const ot = await admin.entities.OTLog.create(otPayload);
      otLogId = ot.id;
      journal.push(["OTLog", ot.id]);
    }
  } else if (otPage.items && otPage.items.length) {
    await admin.entities.OTLog.deleteMany({ session_id: sessionId });
  }

  // Conditional wastage routing: rejected pieces or material waste above zero
  // keeps the linked Wastage Record in sync; cleared removes it.
  const rejected = num(shiftLog.rejected_qty);
  const materialWaste = WASTE_KEYS.reduce((total, key) => total + num(shiftLog[`${key}_waste`]), 0);
  const wastagePage = await admin.entities.WastageLog.filter({ session_id: sessionId }, { limit: 5 });
  if (rejected > 0 || materialWaste > 0) {
    const wastagePayload = buildWastagePayload(shiftLog, sessionId, operationLogId);
    if (wastagePage.items && wastagePage.items.length) {
      wastageLogId = wastagePage.items[0].id;
      await admin.entities.WastageLog.update(wastageLogId, wastagePayload);
    } else {
      const wastage = await admin.entities.WastageLog.create(wastagePayload);
      wastageLogId = wastage.id;
      journal.push(["WastageLog", wastage.id]);
    }
  } else if (wastagePage.items && wastagePage.items.length) {
    await admin.entities.WastageLog.deleteMany({ session_id: sessionId });
  }

  return { operationLogId, otLogId, wastageLogId };
}