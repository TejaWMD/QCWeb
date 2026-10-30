import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { syncInvite } from '../../shared/inviteAccess.ts';

// Applies the invitation carried by the signed-in address: the modules chosen on the
// invitation become the account's assigned modules, and an invitation carrying the admin
// role promotes the account. It only ever fills an account that has no assignment yet.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!caller?.email || !caller?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { applied, role, permissions, registered } = await syncInvite(base44.asServiceRole, caller);
    return Response.json({ applied, role, permissions, registered });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}