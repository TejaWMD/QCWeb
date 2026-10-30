// Shared writer for the Activity History page. Every user action and every
// automatic (system) action lands in one place, so the history reads as a single
// timeline: who did what, in which module, on which record, and what changed.
import { base44 } from "@/api/base44Client";
import { actingUserName } from "@/lib/permissions";
import { eventStamp } from "@/lib/warehouse";

// Writes one history entry. An audit write must never block the action it
// records, so failures are swallowed.
export const logHistory = async ({
  user = null,
  actorType = "User",
  module,
  action,
  entity = "",
  recordId = "",
  details = "",
  oldValue = "",
  newValue = "",
  changes = [],
}) => {
  try {
    await base44.entities.AuditLog.create({
      event_time: new Date().toISOString(),
      event_stamp: eventStamp(),
      user_name: actorType === "System" ? "System" : actingUserName(user),
      actor_type: actorType,
      module,
      action,
      entity,
      record_id: recordId || "",
      details,
      old_value: oldValue,
      new_value: newValue,
      changes: Array.isArray(changes) ? changes : [],
    });
    return true;
  } catch {
    return false;
  }
};

// Something the app did on its own: an automatic status change, a record the
// system generated, a scheduled sync.
export const logSystemAction = (entry) => logHistory({ ...entry, user: null, actorType: "System" });