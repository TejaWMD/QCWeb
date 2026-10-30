// Shared invitation logic. An invitation is applied to the signed-in account once: the
// modules chosen on the invitation become the member's assigned modules, and an account
// invited as an administrator is promoted. An existing assignment is never overwritten,
// so edits made afterwards in User Management stay exactly as they are.

const VALID_MODULE_KEYS = [
  'dashboard',
  'shift_log',
  'operation_record',
  'overtime_record',
  'wastage_records',
  'baseline_capacity',
  'activity_logs',
];

const toArray = (value) => (Array.isArray(value) ? value : value?.items || []);

export const inviteModules = (invite) =>
  Array.isArray(invite?.permissions) ? VALID_MODULE_KEYS.filter((key) => invite.permissions.includes(key)) : [];

// Invitations for an address. Matched case-insensitively as well, because the address on
// the account can differ in case from the one that was invited.
export const findInvites = async (admin, email) => {
  const direct = await admin.entities.UserInvite.filter({ email }, { sort: '-created_date', limit: 10 });
  const invites = toArray(direct);
  if (invites.length) return invites;
  const all = await admin.entities.UserInvite.list('-created_date', 200);
  return toArray(all).filter((i) => (i.email || '').toLowerCase() === (email || '').toLowerCase());
};

// Applies the invitation to the caller's own account and reports the resulting access.
export const syncInvite = async (admin, caller) => {
  const invites = await findInvites(admin, caller.email);
  const invite = invites[0] || null;

  let applied = false;
  let role = caller.role;
  let permissions = Array.isArray(caller.permissions) ? caller.permissions : null;

  if (invite) {
    const patch = {};
    const modules = inviteModules(invite);
    // Fill in the assigned modules once, the first time this account is seen.
    if (!Array.isArray(caller.permissions) && modules.length) patch.permissions = modules;
    // An invitation for an administrator promotes the account; it never demotes.
    if (invite.role === 'admin' && caller.role !== 'admin') patch.role = 'admin';

    if (Object.keys(patch).length) {
      const updated = await admin.entities.User.update(caller.id, patch);
      applied = true;
      role = updated?.role || role;
      permissions = Array.isArray(updated?.permissions) ? updated.permissions : permissions;
    }
  }

  // An account counts as registered when it is an administrator, carries an invitation, or
  // already has modules assigned to it.
  const registered = role === 'admin' || !!invite || Array.isArray(permissions);

  return { invites, invite, applied, role, permissions, registered };
};