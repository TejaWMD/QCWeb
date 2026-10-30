import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Edits a member's role and the modules assigned to them. App role and module changes are
// refused by the platform for ordinary app-user calls, so an administrator's request is
// elevated here after verifying the caller really is an administrator.
const ALLOWED_ROLES = ['admin', 'user'];
const ALLOWED_APP_ROLES = ['operator', 'supervisor', 'qa_officer', 'manager'];
const ASSIGNABLE_MODULE_KEYS = [
  'attention_dashboard',
  'dashboard',
  'shift_log',
  'operation_record',
  'overtime_record',
  'wastage_records',
  'baseline_capacity',
  'activity_logs',
  'downtime',
  'staffing',
  'qa_haccp',
  'task_matrix',
  'capa_tracker',
  'kpi_scorecards',
  'audit_trail',
];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (caller.role !== 'admin') {
      return Response.json({ error: 'Only administrators can change member access' }, { status: 403 });
    }

    const body = await req.json();
    const userId = (body?.userId || '').toString().trim();
    const hasRole = body?.role !== undefined && body?.role !== null;
    const hasModules = body?.permissions !== undefined && body?.permissions !== null;
    const hasAppRole = body?.app_role !== undefined && body?.app_role !== null;
    const hasLine = body?.line !== undefined && body?.line !== null;
    const role = hasRole ? body.role.toString().trim() : null;
    const appRole = hasAppRole ? body.app_role.toString().trim() : null;
    const line = hasLine ? body.line.toString().trim() : null;

    if (!userId || (!hasRole && !hasModules && !hasAppRole && !hasLine)) {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }
    if (hasRole && !ALLOWED_ROLES.includes(role)) {
      return Response.json({ error: 'Invalid role' }, { status: 400 });
    }
    if (hasAppRole && appRole !== '' && !ALLOWED_APP_ROLES.includes(appRole)) {
      return Response.json({ error: 'Invalid app role' }, { status: 400 });
    }
    let permissions = null;
    if (hasModules) {
      if (!Array.isArray(body.permissions)) {
        return Response.json({ error: 'Invalid modules' }, { status: 400 });
      }
      permissions = ASSIGNABLE_MODULE_KEYS.filter((key) => body.permissions.includes(key));
    }

    // The role on the token can be stale — confirm the caller is still an administrator.
    const all = await base44.asServiceRole.entities.User.list('-created_date', 200);
    const users = Array.isArray(all) ? all : all.items || [];
    const callerRecord = users.find((u) => u.id === caller.id);
    if (callerRecord?.role !== 'admin') {
      return Response.json({ error: 'Only administrators can change member access' }, { status: 403 });
    }

    // Never let an administrator change their own access, so the account cannot lock itself out.
    if (userId === caller.id) {
      return Response.json({ error: 'You cannot change your own access' }, { status: 400 });
    }

    const target = users.find((u) => u.id === userId);
    if (!target) return Response.json({ error: 'User not found' }, { status: 404 });

    // Always keep at least one administrator in the app.
    if (hasRole && target.role === 'admin' && role !== 'admin') {
      const admins = users.filter((u) => u.role === 'admin');
      if (admins.length <= 1) {
        return Response.json({ error: 'At least one administrator must remain' }, { status: 400 });
      }
    }

    const patch = {};
    if (hasRole && target.role !== role) patch.role = role;
    if (hasModules) patch.permissions = permissions;
    if (hasAppRole) patch.app_role = appRole || null;
    if (hasLine) patch.line = line || null;
    if (!Object.keys(patch).length) {
      return Response.json({ ok: true, unchanged: true, role: target.role, permissions: target.permissions || permissions });
    }

    const updated = await base44.asServiceRole.entities.User.update(userId, patch);
    return Response.json({
      ok: true,
      email: target.email,
      role: updated?.role ?? target.role,
      permissions: Array.isArray(updated?.permissions) ? updated.permissions : permissions,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}