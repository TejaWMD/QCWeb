import React from "react";

export default function MetricCard({ label, value, subtext, icon: Icon, valueColor = "text-slate-800", subtextColor = "text-slate-500" }) {
  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 flex items-start justify-between">
      <div>
        <p className="text-sm font-bold [font-family:'Alfabet',_sans-serif] text-[#12197d]">{label}</p>
        <p className={`text-3xl font-bold mt-1 ${valueColor}`}>{value}</p>
        <p className={`text-sm mt-1 ${subtextColor}`}>{subtext}</p>
      </div>
      {Icon &&
      <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-slate-600" />
        </div>
      }
    </div>);

}