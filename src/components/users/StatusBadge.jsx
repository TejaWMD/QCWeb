import React from "react";

const STYLES = {
  Active: "bg-emerald-100 text-emerald-700",
  Suspended: "bg-rose-100 text-rose-700",
  "Awaiting approval": "bg-amber-100 text-amber-700",
  Invited: "bg-sky-100 text-sky-700",
};

export default function StatusBadge({ label }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STYLES[label] || "bg-slate-100 text-slate-600"}`}>
      {label}
    </span>
  );
}