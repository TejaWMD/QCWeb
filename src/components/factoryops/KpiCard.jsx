import React from "react";

const TONES = {
  white: "text-white",
  muted: "text-[#a0aec0]",
  green: "text-[#00ff9d]",
  red: "text-[#ff4d4d]",
  orange: "text-[#ff9f43]",
  cyan: "text-[#00e5ff]",
};

// A dark KPI card for the Attention Dashboard: small title row with icon, a bold main
// value, sub text, colored stat lines and an optional cyan progress bar. With an
// onClick the card becomes a button that drills into the related records.
export default function KpiCard({ icon: Icon, title, value, valueSub, stats = [], alert = false, progress = null, onClick = null }) {
  const inner = (
    <>
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon className="w-4 h-4 text-[#00e5ff]" />}
        <span className="text-[11px] text-[#a0aec0] tracking-wide uppercase">{title}</span>
      </div>
      <div className="text-white text-xl font-bold leading-tight">{value}</div>
      {valueSub && <div className="text-[#a0aec0] text-xs mt-0.5">{valueSub}</div>}
      {stats.length > 0 && (
        <div className="mt-3 space-y-1">
          {stats.map((s, i) => (
            <div key={i} className={`text-xs ${TONES[s.tone] || TONES.white}`}>{s.text}</div>
          ))}
        </div>
      )}
      {progress && (
        <div className="mt-3">
          <div className="h-1.5 rounded-full bg-[#1e2740] overflow-hidden">
            <div className="h-full bg-[#00e5ff] rounded-full" style={{ width: `${Math.min(100, Math.max(0, progress.value))}%` }} />
          </div>
          {progress.label && <div className="text-[10px] text-[#a0aec0] mt-1">{progress.label}</div>}
        </div>
      )}
    </>
  );

  const base = `bg-[#131926] rounded-xl p-4 border ${alert ? "border-[#ff4d4d]" : "border-[#1e2740]"}`;

  if (!onClick) return <div className={base}>{inner}</div>;
  return (
    <button type="button" onClick={onClick} className={`${base} text-left w-full cursor-pointer hover:border-[#00e5ff] transition-colors`}>
      {inner}
    </button>
  );
}