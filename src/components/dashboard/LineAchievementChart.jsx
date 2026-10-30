import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function LineAchievementChart({ data }) {
  const lowest = data.reduce((min, d) => d.actual < min.actual ? d : min, data[0] || { line: "—" });

  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 flex flex-col">
      <h3 className="font-semibold text-slate-800 [font-family:'Bungee',_system-ui]">Line Achievement Performance</h3>
      <p className="text-sm text-slate-500 mb-3">Target vs Actual (%)</p>
      <div className="flex-1 min-h-[180px]">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="line" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} unit="%" />
            <Tooltip formatter={(v) => `${v}%`} />
            <Bar dataKey="target" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="actual" radius={[4, 4, 0, 0]}>
              {data.map((d, i) =>
              <Cell key={i} fill={d.actual >= 90 ? "#22c55e" : "#ef4444"} />
              )}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200 text-sm">
        <span className="text-green-600 font-medium">Target Threshold: 90%</span>
        <span className="text-red-500 font-medium">Lowest: {lowest.line}</span>
      </div>
    </div>);

}