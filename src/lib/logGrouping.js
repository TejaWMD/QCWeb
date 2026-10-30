export function groupByDate(logs, dateField) {
  const groups = {};
  logs.forEach((log) => {
    const date = log[dateField] || "Undated";
    if (!groups[date]) groups[date] = [];
    groups[date].push(log);
  });
  return Object.entries(groups)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({ date, items }));
}

export function formatDateHeader(dateStr) {
  if (!dateStr || dateStr === "Undated") return "Undated";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}