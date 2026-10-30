import React from "react";

const STYLES = {
  Open: "bg-[#1e2740] text-[#e2e8f0]",
  "In Progress": "bg-[#00e5ff]/15 text-[#00e5ff] border border-[#00e5ff]/30",
  Overdue: "bg-[#ff4d4d]/15 text-[#ff4d4d] border border-[#ff4d4d]/30",
  Completed: "bg-[#ff9f43]/15 text-[#ff9f43] border border-[#ff9f43]/30",
  Verified: "bg-[#00ff9d]/15 text-[#00ff9d] border border-[#00ff9d]/30",
};

// Color-coded pill for the standard record statuses.
export default function StatusBadge({ status }) {
  if (!status) return <span className="text-sm text-[#a0aec0]">—</span>;
  const cls = STYLES[status] || "bg-[#1e2740] text-[#a0aec0]";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${cls}`}>
      {status}
    </span>
  );
}