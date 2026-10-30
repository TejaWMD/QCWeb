// Turns the app's two log sources into one row shape for the Activity History
// page: the Audit Trail (user and system actions across every module) and the
// production line Activity Log (field-level changes on shift log entries).

export const ACTIONS = ["Created", "Updated", "Deleted", "Verified"];

export const ACTION_TONES = {
  Created: "text-[#00e5ff] border-[#00e5ff]/40 bg-[#00e5ff]/10",
  Updated: "text-[#e2e8f0] border-[#3b4a68] bg-[#1e2740]",
  Deleted: "text-[#ff4d4d] border-[#ff4d4d]/40 bg-[#ff4d4d]/10",
  Verified: "text-[#00ff9d] border-[#00ff9d]/40 bg-[#00ff9d]/10",
};

const pad = (n) => String(n).padStart(2, "0");

const stampOf = (log) => {
  if (log.event_stamp) return log.event_stamp;
  const iso = log.event_time || log.created_date || "";
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return String(iso).slice(0, 19).replace("T", " ");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const ACTIVITY_ACTIONS = {
  "New Entry Created": "Created",
  "Data Modified": "Updated",
  "Data Deleted": "Deleted",
};

const baseRow = (log, changes) => {
  const stamp = stampOf(log);
  return {
    id: `${log.id}`,
    at: log.event_time || log.created_date || stamp,
    stamp,
    day: stamp.slice(0, 10),
    time: stamp.slice(11, 19),
    recordId: log.record_id || "",
    details: log.details || "",
    changes,
  };
};

export const auditRow = (log) => ({
  ...baseRow(log, Array.isArray(log.changes) && log.changes.length ? log.changes : []),
  id: `audit-${log.id}`,
  actor: log.user_name || "—",
  actorType: log.actor_type === "System" || log.user_name === "System" ? "System" : "User",
  module: log.module || "",
  action: log.action || "",
  entity: log.entity || "",
  oldValue: log.old_value || "",
  newValue: log.new_value || "",
  source: "Audit Trail",
});

export const activityRow = (log) => ({
  ...baseRow(log, Array.isArray(log.changes) ? log.changes : []),
  id: `activity-${log.id}`,
  actor: log.user_name || "—",
  actorType: "User",
  module: log.module || "",
  action: ACTIVITY_ACTIONS[log.action_type] || "Updated",
  entity: "ShiftLog",
  oldValue: "",
  newValue: "",
  source: "Production Line Log",
});

export const buildRows = (auditLogs = [], activityLogs = []) =>
  [...auditLogs.map(auditRow), ...activityLogs.map(activityRow)].sort((a, b) => String(b.at).localeCompare(String(a.at)));

export const moduleOptions = (rows = []) =>
  Array.from(new Set(rows.map((r) => r.module).filter(Boolean))).sort((a, b) => a.localeCompare(b));

// Every action actually present in the log, with the four core ones first so the
// filter also covers module-specific actions such as Started, Printed or Approved.
export const actionOptions = (rows = []) => {
  const present = Array.from(new Set(rows.map((r) => r.action).filter(Boolean)));
  const core = ACTIONS.filter((a) => present.includes(a));
  const rest = present.filter((a) => !ACTIONS.includes(a)).sort((a, b) => a.localeCompare(b));
  return [...core, ...rest];
};

export const filterRows = (rows, { from = "", to = "", actor = "all", action = "all", module = "all", search = "" } = {}) => {
  const needle = search.trim().toLowerCase();
  return rows.filter((r) => {
    if (from && r.day && r.day < from) return false;
    if (to && r.day && r.day > to) return false;
    if (actor !== "all" && r.actorType !== actor) return false;
    if (action !== "all" && r.action !== action) return false;
    if (module !== "all" && r.module !== module) return false;
    if (needle) {
      const hay = `${r.actor} ${r.module} ${r.action} ${r.details} ${r.recordId} ${r.changes.join(" ")}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
};

export const summarize = (rows = []) => {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  return {
    total: rows.length,
    today: rows.filter((r) => r.day === todayKey).length,
    system: rows.filter((r) => r.actorType === "System").length,
    users: new Set(rows.filter((r) => r.actorType === "User").map((r) => r.actor)).size,
    changes: rows.filter((r) => r.action === "Created" || r.action === "Updated" || r.action === "Deleted").length,
  };
};

// Export columns for the CSV download.
export const EXPORT_COLUMNS = [
  { label: "Timestamp", value: (r) => r.stamp },
  { label: "Performed By", value: (r) => r.actor },
  { label: "Actor Type", value: (r) => r.actorType },
  { label: "Module", value: (r) => r.module },
  { label: "Action", value: (r) => r.action },
  { label: "Data Table", value: (r) => r.entity },
  { label: "Details", value: (r) => r.details },
  { label: "Old Value", value: (r) => r.oldValue },
  { label: "New Value", value: (r) => r.newValue },
  { label: "Field Changes", value: (r) => r.changes.join(" | ") },
  { label: "Record ID", value: (r) => r.recordId },
  { label: "Log Source", value: (r) => r.source },
];