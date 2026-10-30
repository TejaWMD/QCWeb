import { lineCode } from "@/lib/shiftLogConstants";

// Efficiency target used across the dashboard
export const EFFICIENCY_TARGET = 90;

// Planned downtime causes; everything else counts as unplanned
const PLANNED_REASONS = ["Changeover"];

// Planned vs Actual achievement % per production line
export function buildEfficiencyData(logs) {
  const map = new Map();
  logs.forEach((l) => {
    const line = lineCode(l.production_line || "—");
    if (!map.has(line)) map.set(line, { line, planned: 0, actual: 0 });
    const d = map.get(line);
    d.planned += l.planned_qty || 0;
    d.actual += l.actual_output || 0;
  });
  return [...map.values()]
    .sort((a, b) => a.line.localeCompare(b.line))
    .map((d) => ({
      line: d.line,
      target: EFFICIENCY_TARGET,
      actual: d.planned > 0 ? Math.round((d.actual / d.planned) * 100) : 0,
    }));
}

// Downtime remarks are stored as: "Jamming (08:10-08:30, 20 min): remark; ..."
export function parseDowntimeEntries(remarks) {
  if (!remarks) return [];
  const re = /([^;()]+?)\s*\(([^,()]*),\s*(\d+)\s*min\)/g;
  const out = [];
  let match;
  while ((match = re.exec(remarks)) !== null) {
    out.push({ reason: match[1].trim() || "Others", minutes: Number(match[3]) || 0 });
  }
  return out;
}

// Per-line planned/unplanned downtime + Pareto series by cause
export function buildDowntimeData(logs) {
  const byLine = new Map();
  const byReason = new Map();

  logs.forEach((l) => {
    const line = lineCode(l.production_line || "—");
    if (!byLine.has(line)) byLine.set(line, { line, planned: 0, unplanned: 0 });
    const row = byLine.get(line);

    let counted = 0;
    parseDowntimeEntries(l.downtime_remarks).forEach((e) => {
      counted += e.minutes;
      byReason.set(e.reason, (byReason.get(e.reason) || 0) + e.minutes);
      if (PLANNED_REASONS.includes(e.reason)) row.planned += e.minutes;
      else row.unplanned += e.minutes;
    });

    // Any recorded minutes not explained in the remarks roll into "Others"
    const leftover = (l.downtime_min || 0) - counted;
    if (leftover > 0) {
      row.unplanned += leftover;
      byReason.set("Others", (byReason.get("Others") || 0) + leftover);
    }
  });

  const lines = [...byLine.values()]
    .map((r) => ({ ...r, total: r.planned + r.unplanned }))
    .filter((r) => r.total > 0)
    .sort((a, b) => a.line.localeCompare(b.line));

  const sorted = [...byReason.entries()]
    .map(([reason, minutes]) => ({ reason, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
  const totalMin = sorted.reduce((s, r) => s + r.minutes, 0);
  let cumulative = 0;
  const pareto = sorted.map((r) => {
    cumulative += r.minutes;
    return { ...r, cumulative: totalMin > 0 ? Number(((cumulative / totalMin) * 100).toFixed(1)) : 0 };
  });

  return { lines, pareto, totalMinutes: totalMin };
}