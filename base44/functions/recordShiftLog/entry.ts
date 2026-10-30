import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { syncMirrors } from '../../shared/shiftLogSync.ts';
import {
  SHIFT_LOG_FIELDS,
  buildChangedFields,
  buildSnapshot,
  changeLines,
  newEntryDetail,
  modifiedDetail,
  logActivity,
} from '../../shared/activityLog.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Saving a shift log follows the module access: a member who has been granted the
    // Shift Log module can add and save entries, an account without it cannot.
    if (user.role !== 'admin') {
      const modules = Array.isArray(user.permissions) ? user.permissions : [];
      if (!modules.includes('shift_log')) {
        return Response.json({ error: 'Your account does not have the Shift Log module' }, { status: 403 });
      }
    }

    const body = await req.json().catch(() => ({}));
    const s = body?.shiftLog;
    if (!s || !s.shift_date || !s.production_line) {
      return Response.json({ error: 'Missing shiftLog payload (shift_date and production_line required)' }, { status: 400 });
    }
    const shiftLogId = body?.shiftLogId || null;

    // 1. Resolve the shared session id and persist the shift log. New
    //    submissions get a fresh session id; edits keep the stored one.
    let existing = null;
    if (shiftLogId) {
      existing = await base44.entities.ShiftLog.get(shiftLogId).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
      if (!existing) return Response.json({ error: 'Shift log not found' }, { status: 404 });
    }
    const sessionId = existing?.session_id || existing?.id || crypto.randomUUID();
    const persisted = { ...s, session_id: sessionId, record_batch: 'current' };
    const shiftLog = shiftLogId
      ? await base44.entities.ShiftLog.update(shiftLogId, persisted)
      : await base44.entities.ShiftLog.create(persisted);

    // 2. Sync the mirrored tables in the same transaction. Every create goes
    //    into a rollback journal: if any step fails, everything this run
    //    created is removed so the tables never keep partially synced data.
    const admin = base44.asServiceRole;
    const journal = [];
    let mirrors = null;
    try {
      mirrors = await syncMirrors(admin, persisted, sessionId, journal);

      // 3. Record the submission or the exact fields that changed.
      const changed = shiftLogId ? buildChangedFields(existing, persisted, SHIFT_LOG_FIELDS) : [];
      const activity = await logActivity(admin, {
        user,
        module: 'Shift Log',
        actionType: shiftLogId ? 'Data Modified' : 'New Entry Created',
        record: shiftLog,
        sessionId,
        changes: shiftLogId ? changeLines(changed) : buildSnapshot(persisted, SHIFT_LOG_FIELDS),
        details: shiftLogId ? modifiedDetail('Shift Log', persisted, changed) : newEntryDetail('Shift Log', persisted),
      });
      journal.push(['ActivityLog', activity.id]);
    } catch (e) {
      // Roll back every record this run created; on a new submission the
      // shift log itself goes too, so nothing is left half-synced.
      for (let i = journal.length - 1; i >= 0; i--) {
        try { await admin.entities[journal[i][0]].delete(journal[i][1]); } catch {}
      }
      if (!shiftLogId) {
        try { await base44.entities.ShiftLog.delete(shiftLog.id); } catch {}
      }
      return Response.json({ error: `Sync failed and was rolled back: ${e.message}` }, { status: 500 });
    }

    return Response.json({
      shiftLog,
      sessionId,
      operationLogId: mirrors.operationLogId,
      otLogId: mirrors.otLogId,
      wastageLogId: mirrors.wastageLogId,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}