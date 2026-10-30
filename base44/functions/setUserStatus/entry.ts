import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// App user status changes are refused by the platform for ordinary app-user calls, so an
// administrator's request is elevated here after verifying the caller really is one.
const ALLOWED_STATUSES = ['active', 'suspended'];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (caller.role !== 'admin') {
      return Response.json({ error: 'Only administrators can manage member status' }, { status: 403 });
    }

    const body = await req.json();
    const userId = (body?.userId || '').toString().trim();
    const status = (body?.status || '').toString().trim();
    if (!userId || !ALLOWED_STATUSES.includes(status)) {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }
    if (userId === caller.id) {
      return Response.json({ error: 'You cannot change your own status' }, { status: 400 });
    }

    // The role on the token can be stale — confirm the caller is still an administrator.
    const all = await base44.asServiceRole.entities.User.list('-created_date', 200);
    const users = Array.isArray(all) ? all : all.items || [];
    const callerRecord = users.find((u) => u.id === caller.id);
    if (callerRecord?.role !== 'admin') {
      return Response.json({ error: 'Only administrators can manage member status' }, { status: 403 });
    }

    const target = users.find((u) => u.id === userId);
    if (!target) return Response.json({ error: 'User not found' }, { status: 404 });
    if (target.role === 'admin') {
      return Response.json({ error: 'Administrators cannot be suspended' }, { status: 400 });
    }
    if (target.status === status) return Response.json({ ok: true, unchanged: true });

    await base44.asServiceRole.entities.User.update(userId, { status });
    return Response.json({ ok: true, status, email: target.email });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}