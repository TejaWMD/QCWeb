import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { otHoursFromTimes, shiftLogPatchFromOperation, syncMirrors } from '../../shared/shiftLogSync.ts';
import {
  OPERATION_FIELDS,
  SHIFT_LOG_FIELDS,
  buildChangedFields,
  buildSnapshot,
  changeLines,
  newEntryDetail,
  modifiedDetail,
  logActivity,
} from '../../shared/activityLog.ts';

// Overtime is only branched when the operation entry actually records it: a start and
// an end time spanning a positive number of hours. A session running past midnight is
// counted forward, matching how the Overtime Record page reads a row.
function overtimeHours(entry) {
  if (!entry.ot_start || !entry.ot_end) return 0;
  let hours = (new Date(entry.ot_end) - new Date(entry.ot_start)) / 3600000;
  if (isNaN(hours)) return 0;
  if (hours < 0) hours += 24;
  return hours > 0 ? hours : 0;
}

function wastageQty(entry) {
  return Number(entry.rejected_wasted_qty) || 0;
}

// The Overtime Record branched from the operation entry, linked back by operation record id.
function buildOvertimePayload(entry, operationLogId) {
  return {
    operation_log_id: operationLogId,
    ot_date: entry.ot_date,
    production_line: entry.production_line,
    product_name: entry.product_sku || '',
    product_sku: entry.product_sku || '',
    planned_cartons: Number(entry.planned_cartons) || 0,
    pcs_per_carton: Number(entry.pcs_per_carton) || 0,
    planned_ot_qty: Number(entry.planned_ot_qty) || 0,
    actual_good_output: Number(entry.actual_good_output) || 0,
    rejected_wasted_qty: wastageQty(entry),
    downtime_min: Number(entry.downtime_min) || 0,
    staff_count: Number(entry.staff_count) || 0,
    staff_name: entry.staff_name || '',
    ot_objective: entry.ot_objective || '',
    ot_start: entry.ot_start,
    ot_end: entry.ot_end,
    hourly_ot_rate: Number(entry.hourly_ot_rate) || 0,
    planned_cartons: Number(entry.planned_cartons) || 0,
    pcs_per_carton: Number(entry.pcs_per_carton) || 0,
    // Overtime is only the hours run after 17:00, the same rule the shift log uses.
    ot_duration_hours: Number(
      otHoursFromTimes(
        String(entry.ot_start || '').slice(11, 16),
        String(entry.ot_end || '').slice(11, 16)
      ).toFixed(2)
    ),
    record_batch: entry.record_batch || 'current',
  };
}

// The Wastage Record branched from the operation entry. The operation entry carries one
// rejected / wasted figure rather than a component breakdown, so it is stored as the
// total wastage for that entry.
function buildWastagePayload(entry, operationLogId) {
  return {
    operation_log_id: operationLogId,
    date: entry.ot_date,
    production_line: entry.production_line,
    product_name: entry.product_sku || '',
    total_waste: wastageQty(entry),
  };
}

const recordFields = (record) =>
  Object.fromEntries(
    Object.entries(record).filter(([key]) => !['id', 'created_date', 'updated_date', 'created_by_id'].includes(key))
  );

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const entry = body?.operationLog;
    if (!entry || !entry.ot_date || !entry.production_line || !entry.product_sku) {
      return Response.json({ error: 'Missing operation log payload' }, { status: 400 });
    }
    const operationLogId = body?.operationLogId || null;

    // ---- Correcting an existing record: the edit is carried back onto the
    //      shift log session it was branched from, the linked Overtime and
    //      Wastage records are re-derived, and every change is logged.
    if (operationLogId) {
      const before = await base44.entities.OperationLog.get(operationLogId).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
      if (!before) return Response.json({ error: 'Operation record not found' }, { status: 404 });
      if (user.role !== 'admin' && before.created_by_id !== user.id) {
        return Response.json({ error: 'You can only change records you entered' }, { status: 403 });
      }

      const admin = base44.asServiceRole;
      const journal = [];
      let shiftLogTarget = null;
      let shiftLogBefore = null;

      try {
        const sessionId = before.session_id || '';
        if (sessionId) {
          const shiftPage = await admin.entities.ShiftLog.filter({ session_id: sessionId }, { limit: 5 });
          shiftLogTarget = shiftPage.items && shiftPage.items.length ? shiftPage.items[0] : null;
        }

        // Re-derive the session, then the linked Overtime and Wastage records.
        if (shiftLogTarget) {
          shiftLogBefore = recordFields(shiftLogTarget);
          const patch = shiftLogPatchFromOperation(entry, shiftLogTarget);
          await admin.entities.ShiftLog.update(shiftLogTarget.id, patch);
          await syncMirrors(
            admin,
            { ...shiftLogTarget, ...patch },
            sessionId,
            journal,
            { skipOperation: true, operationLogId }
          );
        }

        // The corrected operation record keeps the fields only it carries.
        const updated = await admin.entities.OperationLog.update(operationLogId, {
          ...entry,
          ...(before.session_id ? { session_id: before.session_id } : {}),
          record_batch: entry.record_batch || before.record_batch || 'current',
        });

        const changed = buildChangedFields(before, updated, OPERATION_FIELDS);
        const activity = await logActivity(admin, {
          user,
          module: 'Operation Record',
          actionType: 'Data Modified',
          record: updated,
          sessionId: before.session_id || '',
          changes: changeLines(changed),
          details: modifiedDetail('Operation Record', updated, changed),
        });
        journal.push(['ActivityLog', activity.id]);
      } catch (e) {
        // Undo everything this run created and restore the two source records.
        for (let i = journal.length - 1; i >= 0; i--) {
          try { await admin.entities[journal[i][0]].delete(journal[i][1]); } catch {}
        }
        if (shiftLogTarget && shiftLogBefore) {
          try { await admin.entities.ShiftLog.update(shiftLogTarget.id, shiftLogBefore); } catch {}
        }
        try { await admin.entities.OperationLog.update(operationLogId, recordFields(before)); } catch {}
        return Response.json({ error: `Sync failed and was rolled back: ${e.message}` }, { status: 500 });
      }

      return Response.json({ operationLogId, updated: true });
    }

    // ---- New entry: the raw entry always goes to the Operation Records table
    //      first, then branches into Overtime and Wastage.
    const operationLog = await base44.entities.OperationLog.create({
      ...entry,
      record_batch: entry.record_batch || 'current',
    });

    const hasOvertime = overtimeHours(entry) > 0;
    let otLogId = null;
    let otError = null;
    if (hasOvertime) {
      try {
        const otLog = await base44.entities.OTLog.create(buildOvertimePayload(entry, operationLog.id));
        otLogId = otLog.id;
      } catch (e) {
        otError = e.message;
      }
    }

    const hasWastage = wastageQty(entry) > 0;
    let wastageLogId = null;
    let wastageError = null;
    if (hasWastage) {
      try {
        const wastageLog = await base44.entities.WastageLog.create(buildWastagePayload(entry, operationLog.id));
        wastageLogId = wastageLog.id;
      } catch (e) {
        wastageError = e.message;
      }
    }

    await logActivity(base44.asServiceRole, {
      user,
      module: 'Operation Record',
      actionType: 'New Entry Created',
      record: operationLog,
      sessionId: operationLog.session_id || '',
      changes: buildSnapshot(operationLog, OPERATION_FIELDS),
      details: newEntryDetail('Operation Record', operationLog),
    });

    return Response.json({
      operationLogId: operationLog.id,
      overtime: { branched: hasOvertime, otLogId, error: otError },
      wastage: { branched: hasWastage, wastageLogId, error: wastageError },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}