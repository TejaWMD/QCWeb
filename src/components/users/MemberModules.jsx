import React from "react";
import { MODULES } from "@/lib/permissions";

const labelFor = (key) => MODULES.find((m) => m.key === key)?.label || key;

// Compact view of the modules a member can open.
export default function MemberModules({ modules = [], all = false, note }) {
  if (all) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 whitespace-nowrap">
        All modules
      </span>
    );
  }

  if (!modules.length) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-600 whitespace-nowrap">
        No modules assigned
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1 max-w-xs">
      {modules.map((key) => (
        <span key={key} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 whitespace-nowrap">
          {labelFor(key)}
        </span>
      ))}
      {note && <span className="text-xs text-slate-400">{note}</span>}
    </div>
  );
}