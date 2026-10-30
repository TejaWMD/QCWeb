import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  OPERATION_FIELDS,
  SHIFT_LOG_FIELDS,
  buildSnapshot,
  deletedDetail,
  logActivity,
} from '../../shared/activityLog.ts';

// Deletes a record together with every record linked to its session: a shift
// log removes its Operation, Overtime and Wastage mirrors, and an operation
// record removes the session it was branched from. The deletion is logged.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const shiftLogId = body?.shiftLogId || null;
    const operationLogId = body?.operationLogId || null;
    if (!shiftLogId && !operationLogId) {
      return Response.json({ error: 'shiftLogId or operationLogId is required' }, { status: 400 });
    }

    const admin = base44.asServiceRole;
    const moduleName = shiftLogId ? 'Shift Log' : 'Operation Record';
    let record = null;
    let sessionId = null;
    let shiftLog = null;

    if (shiftLogId) {
      record = await base44.entities.ShiftLog.get(shiftLogId).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
      if (!record) return Response.json({ error: 'Shift log not found' }, { status: 404 });
      sessionId = record.session_id || record.id;
      shiftLog = record;
    } else {
      record = await admin.entities.OperationLog.get(operationLogId).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
      if (!record) return Response.json({ error: 'Operation record not found' }, { status: 404 });
      sessionId = record.session_id || null;
      if (sessionId) {
        const shiftPage = await admin.entities.ShiftLog.filter({ session_id: sessionId }, { limit: 5 });
        shiftLog = shiftPage.items && shiftPage.items.length ? shiftPage.items[0] : null;
      }
    }

    // A member may remove their own entries; removing anyone else's is admin work.
    if (user.role !== 'admin' && record.created_by_id !== user.id) {
      return Response.json({ error: 'Only an administrator can remove this record' }, { status: 403 });
    }

    // Remove the mirrored records first; if any step fails the source record
    // stays intact and the caller sees the error.
    if (shiftLog) {
      await admin.entities.OperationLog.deleteMany({ session_id: sessionId });
      await admin.entities.OTLog.deleteMany({ session_id: sessionId });
      await admin.entities.WastageLog.deleteMany({ session_id: sessionId });
      await admin.entities.ShiftLog.delete(shiftLog.id);
    } else {
      // A legacy operation entry that never had a shift log session.
      await admin.entities.OperationLog.delete(operationLogId);
      await admin.entities.OTLog.deleteMany({ operation_log_id: operationLogId });
      await admin.entities.WastageLog.deleteMany({ operation_log_id: operationLogId });
      sessionId = null;
    }

    await logActivity(admin, {
      user,
      module: moduleName,
      actionType: 'Data Deleted',
      record,
      sessionId,
      changes: buildSnapshot(record, moduleName === 'Shift Log' ? SHIFT_LOG_FIELDS : OPERATION_FIELDS),
      details: deletedDetail(moduleName, record),
    });

    return Response.json({ deleted: true, sessionId, module: moduleName });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}