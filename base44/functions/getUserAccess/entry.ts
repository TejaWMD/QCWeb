import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { syncInvite } from '../../shared/inviteAccess.ts';

// Access check for the signed-in account. It applies the invitation for the address (the
// modules chosen on it become the assigned modules) and reports the state the app should
// show: suspended, awaiting approval, not registered, or granted.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!caller?.email || !caller?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invites, applied, role, permissions, registered } = await syncInvite(base44.asServiceRole, caller);
    const state = { applied, role, permissions, registered };

    if (role === 'admin') return Response.json({ access: 'granted', ...state });
    if (caller.status === 'suspended') return Response.json({ access: 'suspended', ...state });
    if (invites.some((i) => i.status === 'pending')) return Response.json({ access: 'awaiting_approval', ...state });
    if (!registered) return Response.json({ access: 'not_registered', ...state });
    return Response.json({ access: 'granted', ...state });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}